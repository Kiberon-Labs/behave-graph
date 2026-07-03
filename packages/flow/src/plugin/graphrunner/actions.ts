import type { GraphSession } from '@/system/graphSession';
import type { GraphRunnerClient } from './client';
import type { GraphRunner } from './runner';
import { executing } from '@/annotations';
import { sleep } from '@/util/sleep';
import { type ValueJSON } from '@kiberon-labs/behave-graph';

// Helper to clear executing state from all nodes of a session
async function clearAllExecutingStates(session: GraphSession) {
  await sleep(1); // Delay to allow any final traces to process
  session.nodeStore.getState().setNodes((nodes) =>
    nodes.map((node) => {
      if ('data' in node && node.data.annotations?.[executing]) {
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
    })
  );
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

  // Listen for trace events
  client.on('trace', async (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    const traceStore = session.traceStore.getState();
    if (message.event === 'start') {
      let name = message.nodeId;
      if (
        message.data &&
        typeof message.data === 'object' &&
        'typeName' in message.data
      ) {
        const typeName = (message.data as { typeName?: unknown }).typeName;
        if (typeof typeName === 'string') {
          name = typeName;
        }
      }
      traceStore.addSpan({
        nodeId: message.nodeId,
        name,
        // `?? `not `||`: the worker sends run-relative ms, so 0 is a valid (and
        // common, for the first node) start , `||` fell back to the main thread's
        // performance.now(), producing huge, wrong-clock timestamps.
        start: message.timestamp ?? performance.now(),
        // Open span: NaN until the matching `end` event arrives. The store/render
        // treat NaN as "still running"; a literal end let it render mis-sized.
        end: Number.NaN
        // lane omitted: let the store allocate/free lanes so concurrent spans
        // stack instead of all piling into lane 0.
      });

      // Mark node as executing
      session.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) =>
          node.id === message.nodeId && 'data' in node
            ? {
              ...node,
              data: {
                ...node.data,
                annotations: {
                  ...node.data.annotations,
                  [executing]: true
                }
              }
            }
            : node
        )
      );
    } else if (message.event === 'end') {
      traceStore.updateSpan(message.nodeId, {
        end: message.timestamp ?? performance.now()
      });

      //Delay to allow UI to show executing state
      await sleep(1);

      // Mark node as no longer executing
      session.nodeStore.getState().setNodes((nodes) =>
        nodes.map((node) =>
          node.id === message.nodeId && 'data' in node
            ? {
              ...node,
              data: {
                ...node.data,
                annotations: {
                  ...node.data.annotations,
                  [executing]: false
                }
              }
            }
            : node
        )
      );
    }
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

  // Listen for variable change events from server
  client.on('variableChanged', (message) => {
    const session = sessionFor(message.runId);
    if (!session) return;
    const variableStore = session.variableStore.getState();
    const id = message.variableName;

    const existingVariable = variableStore.variables[id];

    if (existingVariable) {
      variableStore.setVariable(id, {
        ...existingVariable,
        initialValue: message.newValue as ValueJSON
      });
    } else {
      const inferredType = typeof message.newValue;
      variableStore.setVariable(id, {
        id,
        name: message.variableName,
        valueTypeName: inferredType === 'object' ? 'string' : inferredType,
        initialValue: message.newValue as ValueJSON
      });
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
