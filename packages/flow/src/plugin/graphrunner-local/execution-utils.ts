/**
 * Shared graph execution utilities for both local and worker runners
 */

import {
  Engine,
  type GraphInstance,
  type ILifecycleEventEmitter,
  readGraphFromJSON,
  validateGraph,
  ManualLifecycleEventEmitter,
  DefaultLogger,
  type ILogger,
  type IRegistry,
  writeNodeSpecsToJSON,
  type NodeSpecJSON,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import type {
  GraphRunnerCapabilities,
  RunStatus,
  ServerGraphRunnerMessage,
  ServerVariable,
  ServerEvent,
  TraceBatchEvent
} from '../graphrunner/types.js';
import { sleep } from '@kiberon-labs/behave-graph';

export interface ActiveRun {
  runId: string;
  graphId: string;
  engine: Engine;
  graphInstance: GraphInstance;
  registry: IRegistry;
  status: RunStatus;
  startedAt: number;
  performance: {
    nodesExecuted: number;
    eventsEmitted: number;
    variableChanges: number;
  };
  isPaused: boolean;
  executionPhase: 'start' | 'tick' | 'end' | 'completed';
  currentTick: number;
  /**
   * Flushes any trace events still buffered by {@link setupTracing}. Set when
   * tracing is enabled; call before emitting `completed`/`stopped` so the
   * client receives the tail of the trace while the run id is still routable.
   */
  flushTracing?: () => void;
}

export interface MessageContext {
  sendMessage: (message: ServerGraphRunnerMessage) => void;
  sendError: (
    code: string,
    message: string,
    details?: Record<string, unknown>
  ) => void;
}

/**
 * Create a logger that forwards messages through a callback
 */
export function createForwardingLogger(
  runId: string,
  graphId: string,
  onLog: (message: ServerGraphRunnerMessage) => void
): ILogger {
  const baseLogger = new DefaultLogger();

  return {
    log: (severity: string, text: string) => {
      baseLogger.log(severity as any, text);
      onLog({
        type: 'log',
        runId,
        graphId,
        level: severity,
        message: text
      });
    }
  };
}

/**
 * Prepare a registry with required dependencies injected
 */
export function prepareRegistryWithDependencies(
  registry: IRegistry,
  logger: ILogger
): IRegistry {
  // Ensure lifecycle event emitter and logger are available in registry
  if (
    !registry.dependencies?.ILifecycleEventEmitter ||
    !registry.dependencies?.ILogger
  ) {
    // Create a new registry with required dependencies injected
    return {
      ...registry,
      dependencies: {
        ...registry.dependencies,
        ILifecycleEventEmitter:
          registry.dependencies?.ILifecycleEventEmitter ||
          new ManualLifecycleEventEmitter(),
        ILogger: logger
      }
    };
  } else {
    // Replace the existing logger
    return {
      ...registry,
      dependencies: {
        ...registry.dependencies,
        ILogger: logger
      }
    };
  }
}

/**
 * Parse and validate a graph
 */
export function parseAndValidateGraph(
  graphData: GraphJSON,
  registry: IRegistry
): { graphInstance: GraphInstance; errors: string[] } {
  const graphInstance = readGraphFromJSON({
    graphJson: graphData,
    registry
  });

  const errors = validateGraph(graphInstance);
  return { graphInstance, errors };
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Handle hello message
 */
export function handleHello(
  message: { type: 'hello'; protocolVersion: string },
  serverId: string,
  ctx: MessageContext
): void {
  ctx.sendMessage({
    type: 'welcome',
    protocolVersion: message.protocolVersion,
    serverId,
    authenticated: true,
    userId: 'local-user'
  });
}

/**
 * Handle createSession message
 */
export function handleCreateSession(
  _message: { type: 'createSession'; metadata?: Record<string, unknown> },
  ctx: MessageContext
): string {
  const sessionId = generateId('session');
  ctx.sendMessage({
    type: 'sessionCreated',
    sessionId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });
  return sessionId;
}

/**
 * Handle getCapabilities message
 */
export function handleGetCapabilities(ctx: MessageContext): void {
  const capabilities: GraphRunnerCapabilities = {
    trace: true,
    validation: true,
    graphRegistry: false,
    eventFiltering: false,
    batchOperations: false,
    runHistory: false,
    runtimeMetadata: true,
    maxConcurrentRuns: 10
  };

  ctx.sendMessage({
    type: 'capabilities',
    capabilities
  });
}

/** Flush buffered trace events roughly once per frame. */
const TRACE_FLUSH_INTERVAL_MS = 16;
/** Safety valve: flush early if a single window buffers this many events. */
const TRACE_FLUSH_MAX_EVENTS = 2048;

/**
 * Setup tracing for a run.
 *
 * Node execution events are buffered and flushed as a single `traceBatch`
 * message per flush window instead of one `trace` message per event. A graph
 * ticking at display rate executes every node twice per frame (start + end);
 * sending each event individually made the message pipeline (store updates,
 * postMessage for the worker runner) the dominant per-frame cost.
 */
export function setupTracing(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext
): void {
  let buffer: TraceBatchEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (buffer.length === 0) return;
    const events = buffer;
    buffer = [];
    ctx.sendMessage({
      type: 'traceBatch',
      runId: run.runId,
      graphId,
      events
    });
  };
  run.flushTracing = flush;

  const push = (event: TraceBatchEvent) => {
    buffer.push(event);
    if (buffer.length >= TRACE_FLUSH_MAX_EVENTS) {
      flush();
      return;
    }
    if (flushTimer === undefined) {
      flushTimer = setTimeout(flush, TRACE_FLUSH_INTERVAL_MS);
    }
  };

  run.engine.onNodeExecutionStart.addListener((node) => {
    run.performance.nodesExecuted++;
    push({
      nodeId: node.id,
      event: 'start',
      data: { typeName: node.description.typeName },
      timestamp: Date.now() - run.startedAt
    });
  });

  run.engine.onNodeExecutionEnd.addListener((node) => {
    push({
      nodeId: node.id,
      event: 'end',
      data: { typeName: node.description.typeName },
      timestamp: Date.now() - run.startedAt
    });
  });
}

/**
 * Setup variable change tracking for a run
 */
export function setupVariableChangeTracking(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext
): void {
  // Track old values so we can report them in the change event
  const variableOldValues = new Map<string, unknown>();

  const variables = Object.values(run.graphInstance.variables);

  for (const variable of variables) {
    // Store initial value as the "old" value
    variableOldValues.set(variable.id, variable.get());

    variable.onChanged.addListener(() => {
      run.performance.variableChanges++;
      const oldValue = variableOldValues.get(variable.id);
      const newValue = variable.get();

      // Update tracked value for next change
      variableOldValues.set(variable.id, newValue);

      ctx.sendMessage({
        type: 'variableChanged',
        runId: run.runId,
        graphId,
        variableName: variable.name,
        oldValue,
        newValue
      });
    });
  }
}

/**
 * Execute a graph through its lifecycle phases
 */
/**
 * The single graph-execution lifecycle shared by both runners (the in-browser
 * local transport and the web-worker runner). It drives the start → tick → end →
 * completed phase machine and emits the `completed` / error messages; runner-
 * specific behaviour (how fibers are stepped, tick timing, and what to do on
 * completion/error) is injected via {@link ExecuteGraphLifecycleOptions} hooks so
 * neither runner keeps its own copy of this logic.
 */
export interface ExecuteGraphLifecycleOptions {
  /** Tick timing when no {@link tickStrategy} is given. Defaults to 50ms. */
  tickInterval?: number;
  /**
   * When true, the run finalizes (end phase, `completed` message, engine
   * dispose) once its flows drain. Defaults to false: the run idles in the
   * tick phase, keeping event-node subscriptions live and draining any fibers
   * they commit, until it is explicitly stopped.
   */
  autoEnd?: boolean;
  /**
   * Run the engine's pending fibers for the current phase. Defaults to
   * `run.engine.executeAllAsync()`; the local runner injects a pause-aware
   * executor that also honours its step-delay / speed settings.
   */
  executeStep?: () => Promise<void>;
  /** Timing between tick iterations. Defaults to `sleep(tickInterval)`. */
  tickStrategy?: () => Promise<void>;
  /** Invoked after each tick iteration. */
  onStepComplete?: () => Promise<void>;
  /**
   * Invoked after a natural completion — the run is marked completed, the
   * `completed` message has been sent, and the engine disposed. Lets a runner
   * run session hooks and sync its own state (e.g. the local panel's status).
   */
  onComplete?: () => void | Promise<void>;
  /**
   * Invoked on error (after the run is marked errored, before the engine is
   * disposed and the error rethrown). Replaces the default `sendError`.
   */
  onError?: (error: Error) => void | Promise<void>;
}

/** True when a lifecycle event has at least one listener attached. */
function hasListeners(event?: { listenerCount: number }): boolean {
  return !!event && event.listenerCount > 0;
}

/**
 * Run the `start` lifecycle phase: emit the start event (if anyone is
 * listening) and drain the fibers it commits, then advance to the tick phase.
 */
async function runStartPhase(
  run: ActiveRun,
  eventEmitter: ILifecycleEventEmitter | undefined,
  executeStep: () => Promise<unknown>
): Promise<void> {
  if (run.executionPhase !== 'start') return;
  if (hasListeners(eventEmitter?.startEvent)) {
    eventEmitter!.startEvent.emit();
    await executeStep();
  }
  run.executionPhase = 'tick';
}

/**
 * Run the `tick` phase until the run is paused or stopped. Returns `true` when
 * the loop yielded control mid-tick (paused/stopped) so the caller should bail
 * out without finalizing.
 *
 * A run stays alive here even with no tick listeners: completing it would
 * dispose the engine and tear down event-node subscriptions (ai/onToolCall,
 * ai/onMessage, custom triggers) that fire out-of-band, after the start flow has
 * drained. The loop keeps draining fibers those events commit. Pass
 * `autoEnd: true` to restore the finalize-when-drained behaviour for
 * fire-and-forget runs.
 */
async function runTickPhase(
  run: ActiveRun,
  eventEmitter: ILifecycleEventEmitter | undefined,
  executeStep: () => Promise<unknown>,
  tickStrategy: () => Promise<unknown>,
  options?: ExecuteGraphLifecycleOptions
): Promise<boolean> {
  if (run.executionPhase !== 'tick') return false;

  const hasTickListeners = hasListeners(eventEmitter?.tickEvent);
  const autoEnd = options?.autoEnd ?? false;
  if (!hasTickListeners && autoEnd) {
    run.executionPhase = 'end';
    return false;
  }

  while (!run.isPaused && run.status === 'running') {
    if (hasTickListeners) {
      eventEmitter!.tickEvent.emit();
      run.currentTick++;
    }
    await executeStep();

    if (options?.onStepComplete) {
      await options.onStepComplete();
    }

    if (run.isPaused || run.status !== 'running') {
      return true;
    }

    await tickStrategy();
  }
  return false;
}

/**
 * Run the `end` lifecycle phase: emit the end event (if listened) and drain,
 * then mark the run as reaching the `completed` phase.
 */
async function runEndPhase(
  run: ActiveRun,
  eventEmitter: ILifecycleEventEmitter | undefined,
  executeStep: () => Promise<unknown>
): Promise<void> {
  if (run.executionPhase !== 'end' || run.isPaused) return;
  if (hasListeners(eventEmitter?.endEvent)) {
    eventEmitter!.endEvent.emit();
    await executeStep();
  }
  run.executionPhase = 'completed';
}

/**
 * Finalize a run that ran out of fibers and isn't paused. Only autoEnd runs
 * advance this far; by default a run idles in the tick phase until stopped.
 */
async function finalizeCompletedRun(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext,
  options?: ExecuteGraphLifecycleOptions
): Promise<void> {
  if (
    run.executionPhase !== 'completed' ||
    run.isPaused ||
    !(options?.autoEnd ?? false)
  ) {
    return;
  }

  run.status = 'completed';
  const elapsedMs = Date.now() - run.startedAt;

  // Deliver any buffered trace events before `completed` , the client
  // unregisters the run id on completion and would drop a late batch.
  run.flushTracing?.();

  ctx.sendMessage({
    type: 'completed',
    runId: run.runId,
    graphId,
    completedAt: Date.now(),
    elapsedMs,
    result: null,
    performance: run.performance
  });

  run.engine.dispose();
  await options?.onComplete?.();
}

/** Mark the run errored, notify, dispose the engine, and rethrow. */
async function handleLifecycleError(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext,
  error: unknown,
  options?: ExecuteGraphLifecycleOptions
): Promise<never> {
  run.status = 'error';
  run.flushTracing?.();
  const err = error instanceof Error ? error : new Error(String(error));
  if (options?.onError) {
    await options.onError(err);
  } else {
    ctx.sendError('NODE_EXECUTION_ERROR', err.message, {
      runId: run.runId,
      graphId
    });
  }
  run.engine.dispose();
  throw error;
}

export async function executeGraphLifecycle(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext,
  options?: ExecuteGraphLifecycleOptions
): Promise<void> {
  const executeStep =
    options?.executeStep ?? (() => run.engine.executeAllAsync());
  const tickStrategy =
    options?.tickStrategy ??
    (() => sleep((options?.tickInterval ?? 50) / 1000));

  try {
    const eventEmitter = run.registry.dependencies?.ILifecycleEventEmitter as
      | ILifecycleEventEmitter
      | undefined;

    await runStartPhase(run, eventEmitter, executeStep);

    const yielded = await runTickPhase(
      run,
      eventEmitter,
      executeStep,
      tickStrategy,
      options
    );
    if (yielded) return;

    await runEndPhase(run, eventEmitter, executeStep);
    await finalizeCompletedRun(run, graphId, ctx, options);
  } catch (error) {
    await handleLifecycleError(run, graphId, ctx, error, options);
  }
}

/**
 * Handle getServerVariables message
 */
export function handleGetServerVariables(
  variables: ServerVariable[],
  ctx: MessageContext
): void {
  ctx.sendMessage({
    type: 'serverVariables',
    variables
  });
}

/**
 * Handle getServerEvents message
 */
export function handleGetServerEvents(
  events: ServerEvent[],
  ctx: MessageContext
): void {
  ctx.sendMessage({
    type: 'serverEvents',
    events
  });
}

/**
 * Handle getSocketConstraints message
 */
export function handleGetSocketConstraints(
  message: {
    nodeType: string;
    socketName: string;
  },
  registry: IRegistry,
  ctx: MessageContext
): void {
  const nodeSpec = writeNodeSpecsToJSON(registry).find(
    (spec) => spec.type === message.nodeType
  );
  if (!nodeSpec) {
    ctx.sendError('INVALID_GRAPH', `Node type not found: ${message.nodeType}`);
    return;
  }

  const socket = [...nodeSpec.inputs, ...nodeSpec.outputs].find(
    (s) => s.name === message.socketName
  );

  if (!socket) {
    ctx.sendError(
      'INVALID_GRAPH',
      `Socket not found: ${message.socketName} on node ${message.nodeType}`
    );
    return;
  }

  const constraints: {
    type: 'enum' | 'range' | 'pattern' | 'custom';
    choices?: Array<{ value: unknown; label: string }>;
    min?: number;
    max?: number;
    pattern?: string;
    validator?: string;
  } = {
    type: 'custom'
  };

  if ('choices' in socket && Array.isArray(socket.choices)) {
    constraints.type = 'enum';
    constraints.choices = socket.choices.map(
      (choice: { text: string; value: unknown } | string) =>
        typeof choice === 'string'
          ? { value: choice, label: choice }
          : { value: choice.value, label: choice.text }
    );
  }

  ctx.sendMessage({
    type: 'socketConstraints',
    nodeType: message.nodeType,
    socketName: message.socketName,
    valueType: socket.valueType,
    constraints
  });
}

/**
 * Handle getNodeTypes message
 */
export function handleGetNodeTypes(
  registry: IRegistry,
  ctx: MessageContext
): void {
  let nodes: NodeSpecJSON[] = [];

  if (registry.nodes) {
    nodes = writeNodeSpecsToJSON(registry);
  }

  ctx.sendMessage({
    type: 'nodeTypes',
    nodes
  });
}
