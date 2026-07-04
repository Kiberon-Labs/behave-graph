import type { GraphSession } from '@/system/graphSession';
import type { GraphRunnerClient } from './client';
import type { GraphRunner } from './runner';
import { executing } from '@/annotations';
import { type ValueJSON } from '@kiberon-labs/behave-graph';
import type { TraceBatchEvent } from './types';

/**
 * Per-session batcher for the `executing` node annotation.
 *
 * Trace events arrive per node execution (start + end), which at display-rate
 * ticking means hundreds of events per frame. Writing the annotation straight
 * through did a full O(nodes) copy-map of the node array per event; instead,
 * accumulate the net executing state here and apply it once per animation
 * frame with a single identity-preserving setNodes pass.
 */
type ExecutingBatch = {
  pending: Map<string, boolean>;
  scheduled: boolean;
};

const executingBatches = new WeakMap<GraphSession, ExecutingBatch>();

const scheduleFrame = (cb: () => void): void => {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(cb);
  } else {
    setTimeout(cb, 16);
  }
};

function flushExecutingState(session: GraphSession, batch: ExecutingBatch) {
  batch.scheduled = false;
  if (batch.pending.size === 0) return;
  const updates = batch.pending;
  batch.pending = new Map();

  session.nodeStore.getState().setNodes((nodes) => {
    let changed = false;
    const next = nodes.map((node) => {
      if (!('data' in node)) return node;
      const target = updates.get(node.id);
      if (target === undefined) return node;
      if (Boolean(node.data.annotations?.[executing]) === target) return node;
      changed = true;
      return {
        ...node,
        data: {
          ...node.data,
          annotations: {
            ...node.data.annotations,
            [executing]: target
          }
        }
      };
    });
    // Keep the original array identity when nothing changed so selector-based
    // subscribers (the React Flow canvas) skip the re-render entirely.
    return changed ? next : nodes;
  });
}

function markExecuting(session: GraphSession, nodeId: string, state: boolean) {
  let batch = executingBatches.get(session);
  if (!batch) {
    batch = { pending: new Map(), scheduled: false };
    executingBatches.set(session, batch);
  }
  batch.pending.set(nodeId, state);
  if (!batch.scheduled) {
    batch.scheduled = true;
    scheduleFrame(() => flushExecutingState(session, batch));
  }
}

// Clear executing state from all nodes of a session, dropping any queued
// per-node updates so a pending flush can't re-highlight after the run ended.
function clearAllExecutingStates(session: GraphSession) {
  const batch = executingBatches.get(session);
  if (batch) batch.pending.clear();
  session.nodeStore.getState().setNodes((nodes) => {
    let changed = false;
    const next = nodes.map((node) => {
      if ('data' in node && node.data.annotations?.[executing]) {
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            annotations: {
              ...node.data.annotations,
              [executing]: false
            }
          }
        };
      }
      return node;
    });
    return changed ? next : nodes;
  });
}

/** Apply one trace event to the session's trace spans + executing annotation. */
function processTraceEvent(session: GraphSession, ev: TraceBatchEvent) {
  const traceStore = session.traceStore.getState();
  if (ev.event === 'start') {
    let name = ev.nodeId;
    if (ev.data && typeof ev.data === 'object' && 'typeName' in ev.data) {
      const typeName = (ev.data as { typeName?: unknown }).typeName;
      if (typeof typeName === 'string') {
        name = typeName;
      }
    }
    traceStore.addSpan({
      nodeId: ev.nodeId,
      name,
      // `??` not `||`: the worker sends run-relative ms, so 0 is a valid (and
      // common, for the first node) start , `||` fell back to the main thread's
      // performance.now(), producing huge, wrong-clock timestamps.
      start: ev.timestamp ?? performance.now(),
      // Open span: NaN until the matching `end` event arrives. The store/render
      // treat NaN as "still running"; a literal end let it render mis-sized.
      end: Number.NaN
      // lane omitted: let the store allocate/free lanes so concurrent spans
      // stack instead of all piling into lane 0.
    });
    markExecuting(session, ev.nodeId, true);
  } else if (ev.event === 'end') {
    traceStore.updateSpan(ev.nodeId, {
      end: ev.timestamp ?? performance.now()
    });
    markExecuting(session, ev.nodeId, false);
  }
}

/**
 * Clients that already have listeners attached. Guards against double-wiring when
 * both the plugin's `runner.connect()` and a host (e.g. the webworker runner)
 * call {@link setupClientEventListeners} on the same client , which would record
 * every trace span, log and event twice.
 */
const wiredClients = new WeakSet<GraphRunnerClient>();

/**
 * Setup persistent event listeners on the shared client. Registered once when
 * the client connects; every message is routed to the session that started its
 * run (via {@link GraphRunner.runIndex}), so concurrent graphs stay isolated.
 *
 * Idempotent per client: calling it again with the same client is a no-op.
 */
export function setupClientEventListeners(
  client: GraphRunnerClient,
  runner: GraphRunner
) {
  if (wiredClients.has(client)) return;
  wiredClients.add(client);

  // Resolve the session that owns a given run id, or null if unknown.
  const sessionFor = (runId: string): GraphSession | null =>
    runner.runIndex.get(runId)?.session ?? null;

  // Batched trace events (one message per flush window, many events inside).
  client.on('traceBatch', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    for (const ev of message.events) {
      processTraceEvent(session, ev);
    }
  });

  // Single trace events , kept for remote servers that predate `traceBatch`.
  client.on('trace', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    processTraceEvent(session, message);
  });

  // Listen for log messages
  client.on('log', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    const formattedMessage = `[${message.runId}/${message.graphId}] ${message.message}${message.data !== undefined ? ` ${JSON.stringify(message.data)}` : ''}`;
    session.logsStore.getState().append({
      time: new Date(),
      data: {
        message: formattedMessage
      },
      type: message.level as any
    });
  });

  // Listen for variable change events from server. A tick-driven graph writes
  // variables every frame, so coalesce to the latest value per variable and
  // apply once per animation frame instead of one store write per change.
  const pendingVariableUpdates = new Map<GraphSession, Map<string, unknown>>();
  let variableFlushScheduled = false;

  const flushVariableUpdates = () => {
    variableFlushScheduled = false;
    for (const [session, updates] of pendingVariableUpdates) {
      const variableStore = session.variableStore.getState();
      for (const [id, newValue] of updates) {
        const existingVariable = variableStore.variables[id];
        if (existingVariable) {
          variableStore.setVariable(id, {
            ...existingVariable,
            initialValue: newValue as ValueJSON
          });
        } else {
          const inferredType = typeof newValue;
          variableStore.setVariable(id, {
            id,
            name: id,
            valueTypeName: inferredType === 'object' ? 'string' : inferredType,
            initialValue: newValue as ValueJSON
          });
        }
      }
    }
    pendingVariableUpdates.clear();
  };

  client.on('variableChanged', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    let updates = pendingVariableUpdates.get(session);
    if (!updates) {
      updates = new Map();
      pendingVariableUpdates.set(session, updates);
    }
    updates.set(message.variableName, message.newValue);
    if (!variableFlushScheduled) {
      variableFlushScheduled = true;
      scheduleFrame(flushVariableUpdates);
    }
  });

  // Run lifecycle events
  client.on('completed', (message) => {
    const controller = runner.runIndex.get(message.runId);
    if (!controller) return;
    controller.session.editor.notifications.success(
      `Graph completed: ${message.graphId}`
    );
    controller.finishRun();
    clearAllExecutingStates(controller.session);
  });

  client.on('error', (message) => {
    if (!message.runId) return;
    const controller = runner.runIndex.get(message.runId);
    if (!controller) return;
    controller.session.editor.notifications.error(
      `Graph failed: ${message.graphId}`
    );
    controller.finishRun();
    clearAllExecutingStates(controller.session);
  });

  client.on('stopped', (message) => {
    const controller = runner.runIndex.get(message.runId);
    if (!controller) return;
    controller.session.editor.notifications.info(
      `Graph stopped: ${message.graphId}`
    );
    controller.finishRun();
    clearAllExecutingStates(controller.session);
  });

  // Realtime state change listeners
  client.on('nodeRemoved', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    session.nodeStore
      .getState()
      .setNodes((nodes) => nodes.filter((node) => node.id !== message.nodeId));
    session.editor.notifications.info(`Node removed: ${message.nodeId}`);
  });

  client.on('linkCreated', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    session.editor.notifications.info(
      `Link created: ${message.fromNodeId}/${message.fromSocket} -> ${message.toNodeId}/${message.toSocket}`
    );
  });

  client.on('linkRemoved', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    session.editor.notifications.info(
      `Link removed: ${message.fromNodeId}/${message.fromSocket} -> ${message.toNodeId}/${message.toSocket}`
    );
  });

  client.on('nodeParamUpdated', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    session.editor.notifications.info(`Parameter updated on ${message.nodeId}`);
  });

  client.on('affectedNodes', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    session.nodeStore.getState().setNodes((nodes) =>
      nodes.map((node) => {
        if (message.nodeIds.includes(node.id)) {
          return {
            ...node,
            data: {
              ...node.data,
              annotations: {
                ...node.data?.annotations,
                [executing]: true
              }
            }
          };
        }
        return node;
      })
    );
    session.editor.notifications.info(
      `Executing ${message.reason}: ${message.nodeIds.length} node(s)`
    );
  });
}
