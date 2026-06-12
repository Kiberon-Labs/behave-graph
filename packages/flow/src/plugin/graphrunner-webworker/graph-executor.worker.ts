import { Engine, type IRegistry } from '@kiberon-labs/behave-graph';
import type {
  GraphRunnerMessage,
  ServerGraphRunnerMessage,
  ServerVariable,
  ServerEvent
} from '../graphrunner/types.js';
import type { SessionFactory, Session } from '../graphrunner/session.js';
import {
  type ActiveRun,
  type MessageContext,
  generateId,
  handleHello,
  handleCreateSession,
  handleGetCapabilities,
  createForwardingLogger,
  prepareRegistryWithDependencies,
  parseAndValidateGraph,
  setupTracing,
  setupVariableChangeTracking,
  executeGraphLifecycle,
  handleGetServerVariables,
  handleGetServerEvents,
  handleGetSocketConstraints,
  handleGetNodeTypes
} from '../graphrunner-local/execution-utils.js';

/**
 * Session context provided to lifecycle hooks
 */
export interface SessionContext {
  sessionId: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

/**
 * Run context provided to lifecycle hooks
 */
export interface RunContext {
  runId: string;
  graphId: string;
  sessionId: string;
  inputs?: unknown;
  options?: { trace?: boolean };
}

/**
 * Lifecycle hooks for customizing graph worker behavior
 */
export interface GraphWorkerHooks {
  /**
   * Called when a new session is created
   * Can return metadata to associate with the session
   */
  onSessionCreated?: (
    sessionId: string,
    metadata?: Record<string, unknown>
  ) =>
    | void
    | Promise<void>
    | Record<string, unknown>
    | Promise<Record<string, unknown>>;

  /**
   * Called when a session is closed
   */
  onSessionClosed?: (context: SessionContext) => void | Promise<void>;

  /**
   * Called before a graph run starts
   * Can return false to prevent the run
   */
  onRunStart?: (
    context: RunContext
  ) => boolean | Promise<boolean> | void | Promise<void>;

  /**
   * Called when a graph run completes successfully
   */
  onRunComplete?: (context: RunContext, run: ActiveRun) => void | Promise<void>;

  /**
   * Called when a graph run encounters an error
   */
  onRunError?: (context: RunContext, error: Error) => void | Promise<void>;

  /**
   * Called when a graph run is stopped
   */
  onRunStopped?: (context: RunContext, reason: string) => void | Promise<void>;

  /**
   * Called on any incoming message, before processing
   * Can return false to prevent default handling
   */
  onMessage?: (message: GraphRunnerMessage) => boolean | void;
}

/**
 * Options for initializing the graph worker
 */
export interface GraphWorkerOptions {
  /**
   * The registry containing node definitions
   */
  registry: IRegistry;

  /**
   * Server variables to expose to graphs
   */
  variables?: ServerVariable[];

  /**
   * Server events to expose to graphs
   */
  serverEvents?: ServerEvent[];

  /**
   * Lifecycle hooks for customizing behavior
   */
  hooks?: GraphWorkerHooks;

  /**
   * Custom message handlers for extending the protocol
   */
  customMessageHandlers?: Record<
    string,
    (message: unknown, ctx: MessageContext) => void
  >;

  /**
   * Factory function for creating custom session objects
   * Uses the existing SessionFactory interface from session.ts
   */
  sessionFactory?: SessionFactory;
}

/**
 * Initialize the graph worker
 * @param options - Configuration options including registry and customizations
 */
export function initializeGraphWorker(options: GraphWorkerOptions): void {
  const registry = options.registry;
  const variables = options.variables ?? [];
  const events = options.serverEvents ?? [];
  const hooks = options.hooks ?? {};
  const customHandlers = options.customMessageHandlers ?? {};
  const sessionFactory = options.sessionFactory;

  // Worker state
  const activeRuns = new Map<string, ActiveRun>();
  let sessionId: string | null = null;
  let session: Session | null = null;

  /**
   * Send a message to the main thread
   */
  function sendMessage(message: ServerGraphRunnerMessage): void {
    self.postMessage({
      type: 'message',
      data: message
    });
  }

  /**
   * Send an error to the main thread
   */
  function sendError(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    sendMessage({
      type: 'error',
      code: code as any,
      message,
      ...details
    });
  }

  const ctx: MessageContext = { sendMessage, sendError };

  /**
   * Handle incoming messages from main thread
   */
  async function handleMessage(message: GraphRunnerMessage): Promise<void> {
    // Call onMessage hook if provided
    if (hooks.onMessage) {
      const shouldContinue = hooks.onMessage(message);
      if (shouldContinue === false) {
        return;
      }
    }

    // Check for custom handlers
    const customHandler = customHandlers[message.type];
    if (customHandler) {
      customHandler(message, ctx);
      return;
    }

    switch (message.type) {
      case 'hello':
        handleHello(message, 'webworker-runner', ctx);
        break;
      case 'createSession':
        await handleCreateSessionWithHooks(message);
        break;
      case 'getCapabilities':
        handleGetCapabilities(ctx);
        break;
      case 'getServerVariables':
        handleGetServerVariables(variables, ctx);
        break;
      case 'getServerEvents':
        handleGetServerEvents(events, ctx);
        break;
      case 'getSocketConstraints':
        handleGetSocketConstraints(
          { nodeType: message.nodeType, socketName: message.socketName },
          registry,
          ctx
        );
        break;
      case 'getNodeTypes':
        handleGetNodeTypes(registry, ctx);
        break;
      case 'runGraph':
        await handleRunGraphWithHooks(message);
        break;
      case 'stopGraph':
        await handleStopGraphWithHooks(message);
        break;
      case 'getStatus':
        handleGetStatus(message);
        break;
      case 'closeSession':
        await handleCloseSessionWithHooks(message);
        break;

      default:
        sendError(
          'PROTOCOL_VIOLATION',
          `Unsupported message type: ${(message as any).type}`
        );
    }
  }

  /**
   * Handle createSession with lifecycle hooks
   */
  async function handleCreateSessionWithHooks(message: {
    type: 'createSession';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    sessionId = handleCreateSession(message, ctx);

    let sessionMetadata = message.metadata ?? {};

    // Call onSessionCreated hook if provided
    if (hooks.onSessionCreated) {
      try {
        const hookResult = await hooks.onSessionCreated(
          sessionId,
          message.metadata
        );
        if (hookResult && typeof hookResult === 'object') {
          sessionMetadata = { ...sessionMetadata, ...hookResult };
        }
      } catch (error) {
        console.error('Error in onSessionCreated hook:', error);
      }
    }

    // Use custom session factory if provided, otherwise create default session
    if (sessionFactory) {
      try {
        session = sessionFactory.createSession(sessionId, {
          metadata: sessionMetadata
        });
      } catch (error) {
        console.error('Error in sessionFactory:', error);
        // Fallback to default session
        session = {
          sessionId,
          metadata: sessionMetadata,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
          config: { metadata: sessionMetadata },
          activeRuns: new Set(),
          state: {}
        };
      }
    } else {
      session = {
        sessionId,
        metadata: sessionMetadata,
        createdAt: Date.now(),
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        config: { metadata: sessionMetadata },
        activeRuns: new Set(),
        state: {}
      };
    }
  }

  /**
   * Handle closeSession with lifecycle hooks
   */
  async function handleCloseSessionWithHooks(message: {
    type: 'closeSession';
    sessionId: string;
  }): Promise<void> {
    // Call onSessionClosed hook if provided
    if (hooks.onSessionClosed && session) {
      try {
        await hooks.onSessionClosed({
          sessionId: session.sessionId,
          metadata: session.metadata,
          createdAt: session.createdAt
        });
      } catch (error) {
        console.error('Error in onSessionClosed hook:', error);
      }
    }

    for (const run of activeRuns.values()) {
      run.engine.dispose();
    }
    activeRuns.clear();

    sendMessage({
      type: 'sessionClosed',
      sessionId: message.sessionId
    });

    sessionId = null;
    session = null;
  }

  /**
   * Handle runGraph with lifecycle hooks
   */
  async function handleRunGraphWithHooks(message: {
    type: 'runGraph';
    sessionId: string;
    graphId: string;
    graph?: unknown;
    inputs?: unknown;
    options?: { trace?: boolean };
  }): Promise<void> {
    const runContext: RunContext = {
      runId: '', // Will be set below
      graphId: message.graphId,
      sessionId: message.sessionId,
      inputs: message.inputs,
      options: message.options
    };

    // Call onRunStart hook if provided
    if (hooks.onRunStart) {
      try {
        const shouldContinue = await hooks.onRunStart(runContext);
        if (shouldContinue === false) {
          sendMessage({
            type: 'stopped',
            runId: runContext.runId,
            graphId: message.graphId,
            reason: 'Cancelled by onRunStart hook'
          });
          return;
        }
      } catch (error) {
        console.error('Error in onRunStart hook:', error);
      }
    }

    await handleRunGraph(message, runContext);
  }

  /**
   * Handle stopGraph with lifecycle hooks
   */
  async function handleStopGraphWithHooks(message: {
    type: 'stopGraph';
    sessionId: string;
    runId: string;
  }): Promise<void> {
    const run = activeRuns.get(message.runId);
    if (!run) {
      sendError('RUN_NOT_FOUND', 'Run not found', { runId: message.runId });
      return;
    }

    const runContext: RunContext = {
      runId: message.runId,
      graphId: run.graphId,
      sessionId: message.sessionId
    };

    const reason = 'User requested stop';

    // Call onRunStopped hook if provided
    if (hooks.onRunStopped) {
      try {
        await hooks.onRunStopped(runContext, reason);
      } catch (error) {
        console.error('Error in onRunStopped hook:', error);
      }
    }

    run.status = 'stopped';
    run.engine.dispose();
    activeRuns.delete(message.runId);

    sendMessage({
      type: 'stopped',
      runId: message.runId,
      graphId: run.graphId,
      reason
    });
  }

  async function handleRunGraph(
    message: {
      type: 'runGraph';
      sessionId: string;
      graphId: string;
      graph?: unknown;
      inputs?: unknown;
      options?: { trace?: boolean };
    },
    runContext: RunContext
  ): Promise<void> {
    const runId = generateId('run');
    runContext.runId = runId;

    try {
      if (!message.graph) {
        sendError('INVALID_GRAPH', 'Graph not provided', {
          runId,
          graphId: message.graphId
        });
        return;
      }

      // Create logger
      const logger = createForwardingLogger(
        runId,
        message.graphId,
        sendMessage
      );

      // Prepare registry with dependencies
      const registryWithDeps = prepareRegistryWithDependencies(
        registry,
        logger
      );

      // Parse and validate graph
      const { graphInstance, errors } = parseAndValidateGraph(
        message.graph,
        registryWithDeps
      );

      if (errors.length > 0) {
        sendError('VALIDATION_FAILED', errors.join('; '), {
          runId,
          graphId: message.graphId
        });
        return;
      }

      // Create engine
      const engine = new Engine(graphInstance, registryWithDeps);

      // Create run record
      const run: ActiveRun = {
        runId,
        graphId: message.graphId,
        engine,
        graphInstance,
        registry: registryWithDeps,
        status: 'running',
        startedAt: Date.now(),
        performance: {
          nodesExecuted: 0,
          eventsEmitted: 0,
          variableChanges: 0
        },
        isPaused: false,
        executionPhase: 'start',
        currentTick: 0
      };

      activeRuns.set(runId, run);

      // Send run started
      sendMessage({
        type: 'runStarted',
        runId,
        graphId: message.graphId,
        startedAt: run.startedAt
      });

      // Set up variable change tracking
      setupVariableChangeTracking(run, message.graphId, ctx);

      // Set up tracing if requested
      if (message.options?.trace) {
        setupTracing(run, message.graphId, ctx);
      }

      // Execute graph
      executeGraphLifecycle(run, message.graphId, ctx)
        .then(async () => {
          // Call onRunComplete hook if provided
          if (hooks.onRunComplete) {
            try {
              await hooks.onRunComplete(runContext, run);
            } catch (error) {
              console.error('Error in onRunComplete hook:', error);
            }
          }
        })
        .catch(async (error) => {
          console.error('Graph execution error:', error);

          // Call onRunError hook if provided
          if (hooks.onRunError) {
            try {
              await hooks.onRunError(runContext, error);
            } catch (hookError) {
              console.error('Error in onRunError hook:', hookError);
            }
          }
        })
        .finally(() => {
          activeRuns.delete(runId);
        });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      sendError('NODE_EXECUTION_ERROR', errorMessage, {
        runId,
        graphId: message.graphId
      });

      // Call onRunError hook if provided
      if (hooks.onRunError) {
        try {
          await hooks.onRunError(runContext, error as Error);
        } catch (hookError) {
          console.error('Error in onRunError hook:', hookError);
        }
      }
    }
  }

  function handleStopGraph(message: {
    type: 'stopGraph';
    sessionId: string;
    runId: string;
  }): void {
    const run = activeRuns.get(message.runId);
    if (!run) {
      sendError('RUN_NOT_FOUND', 'Run not found', { runId: message.runId });
      return;
    }

    run.status = 'stopped';
    run.engine.dispose();
    activeRuns.delete(message.runId);

    sendMessage({
      type: 'stopped',
      runId: message.runId,
      graphId: run.graphId,
      reason: 'User requested stop'
    });
  }

  function handleGetStatus(message: {
    type: 'getStatus';
    sessionId: string;
    runId: string;
  }): void {
    const run = activeRuns.get(message.runId);
    if (!run) {
      sendError('RUN_NOT_FOUND', 'Run not found', { runId: message.runId });
      return;
    }

    const elapsedMs = Date.now() - run.startedAt;

    sendMessage({
      type: 'status',
      runId: run.runId,
      graphId: run.graphId,
      status: run.status,
      startedAt: run.startedAt,
      elapsedMs,
      performance: run.performance,
      startedGraphs: []
    });
  }

  function handleCloseSession(message: {
    type: 'closeSession';
    sessionId: string;
  }): void {
    for (const run of activeRuns.values()) {
      run.engine.dispose();
    }
    activeRuns.clear();

    sendMessage({
      type: 'sessionClosed',
      sessionId: message.sessionId
    });

    sessionId = null;
  }

  /**
   * Main message handler
   */
  self.onmessage = (event: MessageEvent) => {
    const message = event.data.message;
    void handleMessage(message);
  };
}
