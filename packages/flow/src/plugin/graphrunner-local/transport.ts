/**
 * Local (in-browser) transport implementation for graph execution
 * Executes graphs directly using the local Engine instead of a remote server
 */

import type {
  GraphRunnerMessage,
  RunStatus,
  GraphRunnerCapabilities,
  ServerVariable,
  ServerEvent,
  ServerGraphRunnerMessage,
  RunGraphMessage,
  HelloMessage,
  CreateSessionMessage,
  GetNodeTypesMessage,
  GetStatusMessage,
  CloseSessionMessage,
  StopGraphMessage,
  GetSocketConstraintsMessage,
  AddNodeMessage,
  RemoveNodeMessage,
  UpdateSocketValueMessage,
  UpdateNodeParamMessage,
  CreateLinkMessage,
  RemoveLinkMessage,
  DirectExecuteNodeMessage
} from '../graphrunner/types.js';
import type {
  ITransport,
  IExecutionControl,
  TransportState
} from '../graphrunner/transport.js';
import {
  Engine,
  type GraphInstance,
  type ILifecycleEventEmitter,
  readGraphFromJSON,
  validateGraph,
  DefaultLogger,
  type ILogger,
  Link,
  makeGraphApi,
  runSubgraph,
  DEFAULT_SUBGRAPH_MAX_DEPTH
} from '@kiberon-labs/behave-graph';
import type {
  IRegistry,
  IGraphApi,
  GraphJSON
} from '@kiberon-labs/behave-graph';
import type { StoreApi } from 'zustand';
import type { LocalGraphRunnerStore } from './store.js';
import { sleep } from '@kiberon-labs/behave-graph';
import {
  setupTracing,
  setupVariableChangeTracking,
  prepareRegistryWithDependencies,
  handleGetServerVariables,
  handleGetServerEvents,
  handleGetSocketConstraints,
  handleGetNodeTypes,
  executeGraphLifecycle,
  type ActiveRun as BaseActiveRun,
  type MessageContext
} from './execution-utils.js';
import {
  SessionManager,
  type Session,
  type SessionConfig,
  type SessionFactory
} from '../graphrunner/session.js';
import { createNode } from '@kiberon-labs/behave-graph';

/**
 * Local run record. Extends the shared {@link BaseActiveRun} (used by both the
 * local and worker runners) with the session + tick bookkeeping that only the
 * local, interactively-controllable transport needs.
 */
interface ActiveRun extends BaseActiveRun {
  sessionId: string;
  maxTicks: number;
}

/**
 * Local transport that executes graphs in the browser using the Engine
 */
export class LocalTransport implements ITransport, IExecutionControl {
  private state: TransportState = 'disconnected';
  private messageHandlers: Array<(message: ServerGraphRunnerMessage) => void> =
    [];
  private stateChangeHandlers: Array<(state: TransportState) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private registry: IRegistry;
  private sessionManager: SessionManager;
  private activeRuns = new Map<string, ActiveRun>();
  private store: StoreApi<LocalGraphRunnerStore> | null = null;
  private variables: ServerVariable[];
  private serverEvents: ServerEvent[];
  private resolveGraph?: (id: string) => GraphJSON | undefined;

  constructor(
    registry: IRegistry,
    options?: {
      store?: StoreApi<LocalGraphRunnerStore>;
      variables?: ServerVariable[];
      serverEvents?: ServerEvent[];
      sessionFactory?: SessionFactory;
      /**
       * Resolve a referenced graph's JSON by id, enabling Call Subgraph nodes.
       */
      resolveGraph?: (id: string) => GraphJSON | undefined;
    }
  ) {
    this.registry = registry;
    this.store = options?.store ?? null;
    this.variables = options?.variables ?? [];
    this.serverEvents = options?.serverEvents ?? [];
    this.sessionManager = new SessionManager(options?.sessionFactory);
    this.resolveGraph = options?.resolveGraph;
  }

  /**
   * Create a logger that forwards log messages to the client
   */
  private createTransportLogger(runId: string, graphId: string): ILogger {
    const baseLogger =
      (this.registry.dependencies?.ILogger as ILogger) || new DefaultLogger();

    return {
      log: (severity: string, text: string) => {
        baseLogger.log(severity as any, text);
        this.notifyMessage({
          type: 'log',
          runId,
          graphId,
          level: severity,
          message: text
        });
      }
    };
  }

  getState(): TransportState {
    return this.state;
  }

  async connect(): Promise<void> {
    this.setState('connected');
  }

  disconnect(): void {
    // Clean up all active runs
    for (const run of this.activeRuns.values()) {
      run.engine.dispose();
    }
    this.activeRuns.clear();

    // Close all sessions
    for (const session of this.sessionManager.getActiveSessions()) {
      void this.sessionManager.closeSession(session.sessionId);
    }

    this.setState('disconnected');
    this.updateStoreActiveRuns();
  }

  send(message: GraphRunnerMessage): void {
    // Handle messages synchronously in the browser
    try {
      this.handleMessage(message);
    } catch (error) {
      this.notifyError(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  onMessage(handler: (message: ServerGraphRunnerMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onStateChange(handler: (state: TransportState) => void): void {
    this.stateChangeHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  removeAllHandlers(): void {
    this.messageHandlers = [];
    this.stateChangeHandlers = [];
    this.errorHandlers = [];
  }

  private setState(newState: TransportState): void {
    this.state = newState;
    this.stateChangeHandlers.forEach((handler) => handler(newState));
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach((handler) => handler(error));
  }

  private notifyMessage(message: ServerGraphRunnerMessage): void {
    this.messageHandlers.forEach((handler) => handler(message));
  }
  updateStoreActiveRuns(): void {
    if (this.store) {
      this.store.getState().setActiveRuns(this.activeRuns.size);
    }
  }

  private updateStoreExecutionState(
    isExecuting: boolean,
    isPaused: boolean
  ): void {
    if (this.store) {
      this.store.getState().setIsExecuting(isExecuting);
      this.store.getState().setIsPaused(isPaused);
    }
  }

  private getExecutionDelay(): number {
    if (this.store) {
      const { stepDelay, executionSpeed } = this.store.getState();
      // Apply speed multiplier and step delay
      return (
        stepDelay + (executionSpeed < 1.0 ? (1.0 - executionSpeed) * 100 : 0)
      );
    }
    return 0;
  }

  private getExecutionStepLimit(): number {
    return 1;
  }

  private getTickInterval(): number {
    if (this.store) {
      return this.store.getState().tickInterval;
    }
    return 50; // Default 50ms
  }

  /**
   * Get the default sleep-based tick strategy
   */
  private createSleepTickStrategy(tickInterval: number): () => Promise<void> {
    return async () => {
      await sleep(tickInterval / 1000); // Convert ms to seconds
    };
  }

  private generateId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleMessage(message: GraphRunnerMessage): void {
    switch (message.type) {
      case 'hello':
        this.handleHello(message);
        break;
      case 'createSession':
        this.handleCreateSession(message);
        break;
      case 'getCapabilities':
        this.handleGetCapabilities();
        break;
      case 'getServerVariables':
        this.handleGetServerVariables(message);
        break;
      case 'getServerEvents':
        this.handleGetServerEvents(message);
        break;
      case 'getSocketConstraints':
        this.handleGetSocketConstraints(message);
        break;
      case 'getNodeTypes':
        this.handleGetNodeTypes(message);
        break;
      case 'runGraph':
        this.handleRunGraph(message);
        break;
      case 'stopGraph':
        this.handleStopGraph(message);
        break;
      case 'getStatus':
        this.handleGetStatus(message);
        break;
      case 'closeSession':
        this.handleCloseSession(message);
        break;
      case 'addNode':
        this.handleAddNode(message);
        break;
      case 'removeNode':
        this.handleRemoveNode(message);
        break;
      case 'updateSocketValue':
        this.handleUpdateSocketValue(message);
        break;
      case 'updateNodeParam':
        this.handleUpdateNodeParam(message);
        break;
      case 'createLink':
        this.handleCreateLink(message);
        break;
      case 'removeLink':
        this.handleRemoveLink(message);
        break;
      case 'directExecuteNode':
        this.handleDirectExecuteNode(message);
        break;
      default:
        this.sendError(
          'PROTOCOL_VIOLATION',
          `Unsupported message type: ${(message as GraphRunnerMessage).type}`
        );
    }
  }

  private handleHello(message: HelloMessage): void {
    this.notifyMessage({
      type: 'welcome',
      protocolVersion: message.protocolVersion,
      serverId: 'local-runner',
      authenticated: true,
      userId: 'local-user'
    });
  }

  private handleCreateSession(message: CreateSessionMessage): void {
    const sessionId = this.generateId('session');
    const sessionConfig: SessionConfig = {
      metadata: message.metadata
    };

    const session = this.sessionManager.createSession(sessionId, sessionConfig);

    this.notifyMessage({
      type: 'sessionCreated',
      sessionId: session.sessionId,
      expiresAt: session.expiresAt
    });
  }

  private handleGetCapabilities(): void {
    // Get default capabilities, can be overridden by session
    const capabilities: GraphRunnerCapabilities = {
      trace: true,
      validation: true,
      graphRegistry: false,
      eventFiltering: false,
      batchOperations: false,
      runHistory: false,
      runtimeMetadata: true,
      maxConcurrentRuns: 10,
      realtime: true,
      maxConcurrentDynamicRuns: 10,
      updateGranularity: 'socket'
    };

    this.notifyMessage({
      type: 'capabilities',
      capabilities
    });
  }

  private handleGetServerVariables(_message: {
    type: 'getServerVariables';
    sessionId: string;
  }): void {
    handleGetServerVariables(this.variables, {
      sendMessage: this.notifyMessage.bind(this),
      sendError: (code, msg, details) => this.sendError(code, msg, details)
    });
  }

  private handleGetServerEvents(_message: {
    type: 'getServerEvents';
    sessionId: string;
  }): void {
    handleGetServerEvents(this.serverEvents, {
      sendMessage: this.notifyMessage.bind(this),
      sendError: (code, msg, details) => this.sendError(code, msg, details)
    });
  }

  private handleGetSocketConstraints(
    message: GetSocketConstraintsMessage
  ): void {
    handleGetSocketConstraints(
      { nodeType: message.nodeType, socketName: message.socketName },
      this.registry,
      {
        sendMessage: this.notifyMessage.bind(this),
        sendError: (code, msg, details) => this.sendError(code, msg, details)
      }
    );
  }

  private handleGetNodeTypes(_message: GetNodeTypesMessage): void {
    handleGetNodeTypes(this.registry, {
      sendMessage: this.notifyMessage.bind(this),
      sendError: (code, msg, details) => this.sendError(code, msg, details)
    });
  }

  private async handleRunGraph(message: RunGraphMessage): Promise<void> {
    const runId = this.generateId('run');

    try {
      // Get session for this run
      const session = this.sessionManager.getSession(message.sessionId);
      if (!session) {
        this.sendError('SESSION_NOT_FOUND', 'Session not found', {
          runId,
          graphId: message.graphId
        });
        return;
      }

      if (!message.graph) {
        this.sendError('INVALID_GRAPH', 'Graph not provided', {
          runId,
          graphId: message.graphId
        });
        return;
      }

      // Create transport logger that forwards log messages to the client
      const transportLogger = this.createTransportLogger(
        runId,
        message.graphId
      );

      // Ensure lifecycle event emitter and logger are available in registry
      let registryToUse = this.registry;

      // Apply session registry overrides if provided
      if (session.config.registryOverrides) {
        registryToUse = {
          ...registryToUse,
          ...session.config.registryOverrides
        };
      }

      // Inject the lifecycle event emitter (if absent) and the forwarding logger
      // , shared with the worker runner.
      registryToUse = prepareRegistryWithDependencies(
        registryToUse,
        transportLogger
      );

      // Inject the subgraph resolver so Call Subgraph nodes can run referenced
      // graphs. runSubgraph builds a cycle/depth-guarded IGraphApi for nested
      // calls; the active graph id seeds the call stack so a graph calling back
      // to the active graph (or itself) is detected as a cycle and refused.
      if (this.resolveGraph) {
        const resolveGraph = this.resolveGraph;
        const activeGraphId = message.graphId;
        const graphApi: IGraphApi = {
          getGraph: (id) => resolveGraph(id),
          runGraph: (id, inputs) => {
            const childGraph = resolveGraph(id);
            return childGraph
              ? runSubgraph({
                graphJson: childGraph,
                registry: registryToUse,
                inputs,
                resolveGraph,
                graphId: id,
                stack: [activeGraphId],
                maxDepth: DEFAULT_SUBGRAPH_MAX_DEPTH
              })
              : Promise.resolve({});
          }
        };
        registryToUse = {
          ...registryToUse,
          dependencies: { ...registryToUse.dependencies, IGraphApi: graphApi }
        };
      }

      // Parse graph with registry that has lifecycle event emitter
      const graphInstance = readGraphFromJSON({
        graphJson: message.graph,
        registry: registryToUse
      });

      // Validate graph
      const errors = validateGraph(graphInstance);
      if (errors.length > 0) {
        this.sendError('VALIDATION_FAILED', errors.join('; '), {
          runId,
          graphId: message.graphId
        });
        return;
      }

      // Create engine - it will now have access to lifecycle event emitter through graph instance
      const engine = new Engine(graphInstance, registryToUse);

      // Merge execution options: message options override session defaults
      const executionOptions = {
        ...session.config.defaultExecutionOptions,
        ...message.options
      };

      // Create run record
      const run: ActiveRun = {
        runId,
        sessionId: message.sessionId,
        graphId: message.graphId,

        engine,
        graphInstance,
        registry: registryToUse,
        status: 'running',
        startedAt: Date.now(),
        performance: {
          nodesExecuted: 0,
          eventsEmitted: 0,
          variableChanges: 0
        },
        isPaused: false,
        executionPhase: 'start',
        currentTick: 0,
        maxTicks: Infinity // No limit - tick events run until stopped
      };

      this.activeRuns.set(runId, run);
      this.sessionManager.addRunToSession(message.sessionId, runId);

      // Call session hook for run started
      if (session.config.hooks?.onRunStarted) {
        await session.config.hooks.onRunStarted(
          session,
          runId,
          message.graphId
        );
      }

      // Send run started
      this.notifyMessage({
        type: 'runStarted',
        runId,
        graphId: message.graphId,
        startedAt: run.startedAt
      });

      // Update store state
      this.updateStoreActiveRuns();
      this.updateStoreExecutionState(true, false);

      // Set up variable change tracking
      setupVariableChangeTracking(run, message.graphId, {
        sendMessage: this.notifyMessage.bind(this),
        sendError: (code, msg, details) => this.sendError(code, msg, details)
      });

      // Set up tracing , shared with the worker runner so the trace event shape
      // and timestamps stay consistent across runners.
      if (executionOptions.trace) {
        setupTracing(run, message.graphId, {
          sendMessage: this.notifyMessage.bind(this),
          sendError: (code, msg, details) => this.sendError(code, msg, details)
        });
      }

      // Execute graph asynchronously
      const autoEnd = executionOptions.autoEnd ?? true;
      this.executeGraph(run, message.graphId, autoEnd, session);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Get session for error hook
      const session = this.sessionManager.getSession(message.sessionId);
      if (session?.config.hooks?.onRunError) {
        await session.config.hooks.onRunError(
          session,
          runId,
          message.graphId,
          error instanceof Error ? error : new Error(errorMessage)
        );
      }

      this.sendError('NODE_EXECUTION_ERROR', errorMessage, {
        runId,
        graphId: message.graphId
      });
    }
  }

  private async executeGraph(
    run: ActiveRun,
    graphId: string,
    autoEnd: boolean,
    session: Session
  ): Promise<void> {
    const ctx: MessageContext = {
      sendMessage: this.notifyMessage.bind(this),
      sendError: (code, message, details) =>
        this.sendError(code, message, details)
    };

    // Tick timing: the session's custom strategy if provided, else a sleep based
    // on the configured tick interval.
    const tickStrategy =
      session.config.tickStrategy ||
      this.createSleepTickStrategy(
        session.config.executionSettings?.tickInterval ?? this.getTickInterval()
      );

    // Tear the run down and re-sync the panel's running / active-runs state.
    const cleanup = (): void => {
      this.activeRuns.delete(run.runId);
      this.sessionManager.removeRunFromSession(run.sessionId, run.runId);
      this.updateStoreActiveRuns();
      this.updateStoreExecutionState(false, false);
    };

    try {
      await executeGraphLifecycle(run, graphId, ctx, {
        autoEnd,
        // Pause-aware executor that also honours the local step-delay / speed.
        executeStep: () => this.executeWithPauseSupport(run),
        tickStrategy,
        onComplete: async () => {
          if (session.config.hooks?.onRunCompleted) {
            await session.config.hooks.onRunCompleted(
              session,
              run.runId,
              graphId,
              null
            );
          }
          cleanup();
        },
        onError: async (error) => {
          if (session.config.hooks?.onRunError) {
            await session.config.hooks.onRunError(
              session,
              run.runId,
              graphId,
              error
            );
          }
          this.sendError('NODE_EXECUTION_ERROR', error.message, {
            runId: run.runId,
            graphId
          });
          cleanup();
        }
      });
    } catch {
      // The error was already reported + cleaned up by the onError hook; this
      // method is fire-and-forget, so swallow the lifecycle's rethrow.
    }
  }

  /**
   * Execute engine with pause support - executes one step at a time with configurable delay
   */
  private async executeWithPauseSupport(run: ActiveRun): Promise<void> {
    const session = this.sessionManager.getSession(run.sessionId);

    // Get settings from session, fallback to store
    const stepDelay =
      session?.config.executionSettings?.stepDelay ??
      this.store?.getState().stepDelay ??
      0;
    const executionSpeed =
      session?.config.executionSettings?.executionSpeed ??
      this.store?.getState().executionSpeed ??
      1.0;

    const stepLimit = this.getExecutionStepLimit();
    const delay =
      stepDelay + (executionSpeed < 1.0 ? (1.0 - executionSpeed) * 100 : 0);

    // Loop while engine has pending work and not paused
    while (run.engine.hasPending() && !run.isPaused) {
      // Execute limited number of steps
      await run.engine.executeAllAsync(5, stepLimit);

      // Apply delay between successive calls
      if (delay > 0 && run.engine.hasPending() && !run.isPaused) {
        await sleep(delay / 1000);
      }
    }
  }

  /**
   * Pause execution of a running graph
   */
  public pauseExecution(runId: string): void {
    const run = this.activeRuns.get(runId);
    if (!run) {
      this.updateStoreExecutionState(true, true);
      throw new Error(`Run not found: ${runId}`);
    }
    run.isPaused = true;
    run.status = 'running'; // Keep as running but paused
  }

  /**
   * Resume execution of a paused graph
   */
  public async resumeExecution(runId: string): Promise<void> {
    this.updateStoreExecutionState(true, false);
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const session = this.sessionManager.getSession(run.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${run.sessionId}`);
    }

    run.isPaused = false;
    // Continue execution from where we left off
    await this.executeGraph(run, run.graphId, true, session);
  }

  /**
   * Step forward one execution step
   */
  public async stepExecution(runId: string): Promise<void> {
    const run = this.activeRuns.get(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const eventEmitter = run.registry.dependencies?.ILifecycleEventEmitter as
      | ILifecycleEventEmitter
      | undefined;

    // Execute one step based on current phase
    if (run.executionPhase === 'start') {
      if (
        eventEmitter?.startEvent &&
        eventEmitter.startEvent.listenerCount > 0
      ) {
        eventEmitter.startEvent.emit();
      }
      // Execute one fiber step
      await run.engine.executeAllSync(5, 1);

      // Check if we should move to next phase
      if (!run.engine.hasPending()) {
        run.executionPhase = 'tick';
      }
    } else if (run.executionPhase === 'tick') {
      if (run.currentTick < run.maxTicks) {
        if (
          eventEmitter?.tickEvent &&
          eventEmitter.tickEvent.listenerCount > 0 &&
          !run.engine.hasPending()
        ) {
          eventEmitter.tickEvent.emit();
        }
        // Execute one fiber step
        await run.engine.executeAllSync(5, 1);

        // Check if current tick is done
        if (!run.engine.hasPending()) {
          run.currentTick++;
          if (run.currentTick >= run.maxTicks) {
            run.executionPhase = 'end';
          }
        }
      } else {
        run.executionPhase = 'end';
      }
    } else if (run.executionPhase === 'end') {
      if (
        eventEmitter?.endEvent &&
        eventEmitter.endEvent.listenerCount > 0 &&
        !run.engine.hasPending()
      ) {
        eventEmitter.endEvent.emit();
      }
      // Execute one fiber step
      await run.engine.executeAllSync(5, 1);

      // Check if we're done
      if (!run.engine.hasPending()) {
        run.executionPhase = 'completed';

        // Run completed successfully
        run.status = 'completed';
        const elapsedMs = Date.now() - run.startedAt;
        const result = null;

        // Call session hook for run completed
        const session = this.sessionManager.getSession(run.sessionId);
        if (session?.config.hooks?.onRunCompleted) {
          await session.config.hooks.onRunCompleted(
            session,
            run.runId,
            run.graphId,
            result
          );
        }

        this.notifyMessage({
          type: 'completed',
          runId: run.runId,
          graphId: run.graphId,
          completedAt: Date.now(),
          elapsedMs,
          result,
          performance: run.performance
        });

        // Cleanup
        run.engine.dispose();
        this.activeRuns.delete(run.runId);
        this.sessionManager.removeRunFromSession(run.sessionId, run.runId);
        // Keep the panel's running/active-runs state in sync when stepping
        // reaches the end of the graph.
        this.updateStoreActiveRuns();
        this.updateStoreExecutionState(false, false);
      }
    }
  }

  /**
   * Check if a run is currently paused
   */
  public isPaused(runId: string): boolean {
    const run = this.activeRuns.get(runId);
    return run?.isPaused ?? false;
  }

  private handleStopGraph(message: StopGraphMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', 'Run not found', {
        runId: message.runId
      });
      return;
    }

    run.status = 'stopped';
    this.updateStoreActiveRuns();
    this.updateStoreExecutionState(false, false);
    run.engine.dispose();
    this.activeRuns.delete(message.runId);
    this.sessionManager.removeRunFromSession(run.sessionId, message.runId);

    this.notifyMessage({
      type: 'stopped',
      runId: message.runId,
      graphId: run.graphId,
      reason: 'User requested stop'
    });
  }

  private handleGetStatus(message: GetStatusMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', 'Run not found', {
        runId: message.runId
      });
      return;
    }

    const elapsedMs = Date.now() - run.startedAt;

    this.notifyMessage({
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

  private async handleCloseSession(
    message: CloseSessionMessage
  ): Promise<void> {
    const session = this.sessionManager.getSession(message.sessionId);

    if (session) {
      // Clean up all runs in this session
      for (const run of this.activeRuns.values()) {
        if (run.sessionId === message.sessionId) {
          run.engine.dispose();
          this.activeRuns.delete(run.runId);
        }
      }

      this.updateStoreActiveRuns();
      this.updateStoreExecutionState(false, false);

      // Close the session (calls session hooks)
      await this.sessionManager.closeSession(message.sessionId);
    }

    this.notifyMessage({
      type: 'sessionClosed',
      sessionId: message.sessionId
    });
  }

  private sendError(
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    this.notifyMessage({
      type: 'error',
      code: code as any,
      message,
      ...details
    });
  }

  // Realtime modification handlers

  private handleAddNode(message: AddNodeMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    try {
      run.graphInstance.nodes[message.nodeId] = createNode({
        id: message.nodeId,
        nodeTypeName: message.nodeType,
        nodeConfiguration: message.nodeData?.configuration || {},
        registry: run.registry,
        graph: makeGraphApi({
          ...run.registry,
          variables: run.graphInstance.variables,
          customEvents: run.graphInstance.customEvents
        })
      });

      this.notifyMessage({
        type: 'nodeAdded',
        runId: message.runId,
        graphId: run.graphId,
        nodeId: message.nodeId,
        nodeType: message.nodeType,
        nodeData: message.nodeData
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to add node: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleRemoveNode(message: RemoveNodeMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    const node = run.graphInstance.nodes?.[message.nodeId];
    if (!node) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Node ${message.nodeId} not found in graph`
      );
      return;
    }

    try {
      // Clean up links connected to this node's sockets
      for (const socket of [...(node.inputs || []), ...(node.outputs || [])]) {
        // Clear all links by removing them one by one
        while (socket.links.length > 0) {
          socket.links.pop();
        }
      }

      // Also clean up links pointing TO this node from other nodes
      for (const otherNode of Object.values(run.graphInstance.nodes || {})) {
        if (otherNode && otherNode !== node) {
          for (const inputSocket of otherNode.inputs || []) {
            for (let i = inputSocket.links.length - 1; i >= 0; i--) {
              const link = inputSocket.links[i];
              if (link && link.nodeId === message.nodeId) {
                inputSocket.links.splice(i, 1);
              }
            }
          }
        }
      }

      // Remove the node from the graph
      delete run.graphInstance.nodes[message.nodeId];

      // Notify client
      this.notifyMessage({
        type: 'nodeRemoved',
        runId: message.runId,
        graphId: run.graphId,
        nodeId: message.nodeId
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to remove node: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleUpdateSocketValue(message: UpdateSocketValueMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    const node = run.graphInstance.nodes?.[message.nodeId];
    if (!node) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Node ${message.nodeId} not found in graph`
      );
      return;
    }

    try {
      // Find the socket by name
      const socket = node.inputs.find((s) => s.name === message.socketName);
      if (!socket) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Socket ${message.socketName} not found on node`
        );
        return;
      }

      // Update the socket value
      socket.value = message.value;

      // Notify about the change
      this.notifyMessage({
        type: 'trace',
        runId: message.runId,
        graphId: run.graphId,
        nodeId: message.nodeId,
        event: 'socketUpdated',
        data: { socketName: message.socketName, value: message.value },
        timestamp: Date.now() - run.startedAt
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to update socket: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleUpdateNodeParam(message: UpdateNodeParamMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    const node = run.graphInstance.nodes?.[message.nodeId];
    if (!node) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Node ${message.nodeId} not found in graph`
      );
      return;
    }

    try {
      // Store old value for delta
      const oldValue = node.configuration[message.paramName];

      // Update the parameter
      node.configuration[message.paramName] = message.value;

      // Notify about the change
      this.notifyMessage({
        type: 'nodeParamUpdated',
        runId: message.runId,
        graphId: run.graphId,
        nodeId: message.nodeId,
        paramName: message.paramName,
        oldValue,
        newValue: message.value
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to update parameter: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleCreateLink(message: CreateLinkMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    try {
      const fromNode = run.graphInstance.nodes?.[message.fromNodeId];
      const toNode = run.graphInstance.nodes?.[message.toNodeId];

      if (!fromNode) {
        this.sendError('NODE_EXECUTION_ERROR', `Src node not found in graph`);
        return;
      }
      if (!toNode) {
        this.sendError('NODE_EXECUTION_ERROR', `Dest node not found in graph`);
        return;
      }

      // Find the output socket on the source node
      const fromSocket = fromNode.outputs.find(
        (s) => s.name === message.fromSocket
      );
      if (!fromSocket) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Output socket ${message.fromSocket} not found on source node`
        );
        return;
      }

      // Find the input socket on the target node
      const toSocket = toNode.inputs.find((s) => s.name === message.toSocket);
      if (!toSocket) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Input socket ${message.toSocket} not found on target node`
        );
        return;
      }

      // Create the link
      const link = new Link(message.fromNodeId, message.fromSocket);
      toSocket.links.push(link);

      // Notify about the change
      this.notifyMessage({
        type: 'linkCreated',
        runId: message.runId,
        graphId: run.graphId,
        fromNodeId: message.fromNodeId,
        fromSocket: message.fromSocket,
        toNodeId: message.toNodeId,
        toSocket: message.toSocket
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to create link: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleRemoveLink(message: RemoveLinkMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    try {
      const toNode = run.graphInstance.nodes?.[message.toNodeId];
      if (!toNode) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Target node ${message.toNodeId} not found in graph`
        );
        return;
      }

      // Find the input socket on the target node
      const toSocket = toNode.inputs.find((s) => s.name === message.toSocket);
      if (!toSocket) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Input socket ${message.toSocket} not found on target node`
        );
        return;
      }

      // Remove the matching link
      for (let i = toSocket.links.length - 1; i >= 0; i--) {
        const link = toSocket.links[i];
        if (
          link &&
          link.nodeId === message.fromNodeId &&
          link.socketName === message.fromSocket
        ) {
          toSocket.links.splice(i, 1);
        }
      }

      // Notify about the change
      this.notifyMessage({
        type: 'linkRemoved',
        runId: message.runId,
        graphId: run.graphId,
        fromNodeId: message.fromNodeId,
        fromSocket: message.fromSocket,
        toNodeId: message.toNodeId,
        toSocket: message.toSocket
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to remove link: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private handleDirectExecuteNode(message: DirectExecuteNodeMessage): void {
    const run = this.activeRuns.get(message.runId);
    if (!run) {
      this.sendError('RUN_NOT_FOUND', `Run ${message.runId} not found`);
      return;
    }

    try {
      const node = run.graphInstance.nodes?.[message.nodeId];
      if (!node) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Node ${message.nodeId} not found in graph`
        );
        return;
      }

      // Find and update the input socket
      const inputSocket = node.inputs.find(
        (s) => s.name === message.inputSocketName
      );
      if (!inputSocket) {
        this.sendError(
          'NODE_EXECUTION_ERROR',
          `Input socket ${message.inputSocketName} not found on node`
        );
        return;
      }

      inputSocket.value = message.inputValue;

      // Get downstream nodes
      const downstreamNodes = this.getDownstreamNodes(
        message.nodeId,
        run.graphInstance
      );
      const nodesToExecute = [message.nodeId, ...downstreamNodes];

      // Execute the node and downstream
      this.notifyMessage({
        type: 'affectedNodes',
        runId: message.runId,
        graphId: run.graphId,
        nodeIds: nodesToExecute,
        reason: 'direct-execution'
      });
    } catch (error) {
      this.sendError(
        'NODE_EXECUTION_ERROR',
        `Failed to execute node: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private getDownstreamNodes(nodeId: string, graph: GraphInstance): string[] {
    const downstream = new Set<string>();
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const currentNode = graph.nodes?.[currentId];
      if (!currentNode) {
        continue;
      }

      // Find all nodes that depend on this one via output socket links
      for (const outputSocket of currentNode.outputs) {
        for (const link of outputSocket.links) {
          if (!visited.has(link.nodeId)) {
            downstream.add(link.nodeId);
            queue.push(link.nodeId);
          }
        }
      }
    }

    return Array.from(downstream);
  }
}
