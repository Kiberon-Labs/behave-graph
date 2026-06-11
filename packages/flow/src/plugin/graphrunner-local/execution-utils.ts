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
  ServerEvent
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

/**
 * Setup tracing for a run
 */
export function setupTracing(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext
): void {
  run.engine.onNodeExecutionStart.addListener((node) => {
    run.performance.nodesExecuted++;
    ctx.sendMessage({
      type: 'trace',
      runId: run.runId,
      graphId,
      nodeId: node.id,
      event: 'start',
      data: { typeName: node.description.typeName },
      timestamp: Date.now() - run.startedAt
    });
  });

  run.engine.onNodeExecutionEnd.addListener((node) => {
    ctx.sendMessage({
      type: 'trace',
      runId: run.runId,
      graphId,
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
export async function executeGraphLifecycle(
  run: ActiveRun,
  graphId: string,
  ctx: MessageContext,
  options?: {
    tickInterval?: number;
    onStepComplete?: () => Promise<void>;
    autoEnd?: boolean;
  }
): Promise<void> {
  try {
    const eventEmitter = run.registry.dependencies?.ILifecycleEventEmitter as
      | ILifecycleEventEmitter
      | undefined;

    // Execute start event
    if (run.executionPhase === 'start') {
      if (
        eventEmitter?.startEvent &&
        eventEmitter.startEvent.listenerCount > 0
      ) {
        eventEmitter.startEvent.emit();
        await run.engine.executeAllAsync();
      }
      run.executionPhase = 'tick';
    }

    // Execute tick events
    if (run.executionPhase === 'tick') {
      if (eventEmitter?.tickEvent && eventEmitter.tickEvent.listenerCount > 0) {
        while (!run.isPaused && run.status === 'running') {
          eventEmitter.tickEvent.emit();
          await run.engine.executeAllAsync();
          run.currentTick++;

          if (options?.onStepComplete) {
            await options.onStepComplete();
          }

          if (run.isPaused || run.status !== 'running') {
            return;
          }

          await sleep((options?.tickInterval ?? 50) / 1000);
        }
      } else {
        run.executionPhase = 'end';
      }
    }

    // Execute end event
    if (run.executionPhase === 'end' && !run.isPaused) {
      if (eventEmitter?.endEvent && eventEmitter.endEvent.listenerCount > 0) {
        eventEmitter.endEvent.emit();
        await run.engine.executeAllAsync();
      }
      run.executionPhase = 'completed';
    }

    // Complete if not paused
    if (!run.isPaused && !options?.autoEnd) {
      run.status = 'completed';
      const elapsedMs = Date.now() - run.startedAt;

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
    }
  } catch (error) {
    run.status = 'error';
    const errorMessage = error instanceof Error ? error.message : String(error);
    ctx.sendError('NODE_EXECUTION_ERROR', errorMessage, {
      runId: run.runId,
      graphId
    });
    run.engine.dispose();
    throw error;
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
