import {
  registerCoreProfile,
  validateRegistry,
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  validateGraph,
  Engine,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import type {
  IStateService,
  GraphJSON,
  ILifecycleEventEmitter,
  ILogger
} from '@kiberon-labs/behave-graph';
import * as fs from 'fs';
import * as path from 'path';

import type { ServerConfig } from './config';
import type { Session, GraphRun, ServerTransport } from './types';
import { createDefaultConfig } from './config';
import { ServerState } from './state';
import { sendError, send, validateSession, generateId } from './utils';
import { TransportLogger } from './logger';
import {
  GraphRunnerMessage,
  ITransport,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';

/**
 * Transport-agnostic Graph Runner Server implementing the Behave-Graph Execution Protocol
 */
export class GraphRunnerServer {
  private state: ServerState;
  private config: Required<ServerConfig>;
  private cleanupInterval?: NodeJS.Timeout;

  private constructor(state: ServerState, config: Required<ServerConfig>) {
    this.state = state;
    this.config = config;

    // Periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Every minute

    console.log('GraphRunner server initialized');
  }

  /**
   * Create a new GraphRunnerServer instance
   */
  static async create(
    transport: ITransport<ServerGraphRunnerMessage, GraphRunnerMessage>,
    config: ServerConfig = {}
  ): Promise<GraphRunnerServer> {
    const finalConfig = createDefaultConfig(config);

    // Simple in-memory state service
    const stateMap = new Map<string, unknown>();
    const stateService: IStateService = {
      getState: (key: string) => stateMap.get(key),
      setState: (key: string, value: unknown) => {
        stateMap.set(key, value);
      },
      storeEvent: () => {}, // No-op for server
      rehydrateState: async () => {}, // No-op for server
      syncState: async () => {}, // No-op for server
      syncAndClearState: async () => {}, // No-op for server
      resetState: async () => {
        stateMap.clear();
      }
    };

    // Load registry (custom or default)
    const registry = await GraphRunnerServer.loadRegistry(
      finalConfig.customRegistryPath
    );

    // Validate registry
    const registryErrors = validateRegistry(registry);
    if (registryErrors.length > 0) {
      console.error('Registry validation errors:', registryErrors);
      throw new Error(
        `Registry has ${registryErrors.length} validation errors`
      );
    }

    const state = new ServerState(registry);
    const server = new GraphRunnerServer(state, finalConfig);
    server.connectTransport(transport);

    return server;
  }

  /**
   * Load registry from custom path or use default core profile
   */
  private static async loadRegistry(customRegistryPath: string) {
    if (customRegistryPath) {
      // Try both .ts and .js extensions relative to the graph file
      const basePath = customRegistryPath.replace(/\.(ts|js)$/, '');
      const possiblePaths = [
        `${basePath}.js`, // Compiled JS takes priority
        `${basePath}.ts`,
        customRegistryPath // Original path as fallback
      ];

      console.log(
        `Searching for custom registry at: ${possiblePaths.join(', ')}`
      );

      for (const registryPath of possiblePaths) {
        if (fs.existsSync(registryPath)) {
          console.log(`Found and loading custom registry from ${registryPath}`);
          return await GraphRunnerServer.loadCustomRegistry(registryPath);
        }
      }

      console.log(
        `Custom registry not found (tried: ${possiblePaths.join(', ')}), using default core profile`
      );
    }

    console.log('Using default core profile registry');
    // Default: use core profile with transport logger
    return registerCoreProfile({
      values: {},
      nodes: {},
      dependencies: {
        ILogger: new TransportLogger(),
        ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
      }
    });
  }

  /**
   * Dynamically import a custom registry from a file path
   */
  private static async loadCustomRegistry(registryPath: string) {
    try {
      // Try loading as-is first
      let registryModule;
      try {
        registryModule = await import(registryPath);
      } catch (err) {
        // If direct import fails, try with file:// protocol for absolute paths
        const fileUrl = registryPath.startsWith('file://')
          ? registryPath
          : `file://${registryPath.replace(/\\/g, '/')}`;
        registryModule = await import(fileUrl);
      }

      // Check for named export 'registry' or default export
      const registry = registryModule.registry ?? registryModule.default;

      if (!registry) {
        throw new Error(
          'Custom registry file must export a registry as default export or named "registry" export'
        );
      }

      console.log(`Loaded custom registry from: ${registryPath}`);
      return registry;
    } catch (error) {
      console.error(
        `Failed to load custom registry from ${registryPath}:`,
        error
      );
      throw new Error(
        `Failed to load custom registry: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Connect a new transport (WebSocket, IPC, etc.)
   */
  private connectTransport(
    transport: ITransport<ServerGraphRunnerMessage, GraphRunnerMessage>
  ): void {
    const client = this.state.addClient(transport);
    transport.onMessage(async (message: GraphRunnerMessage) => {
      try {
        await this.handleMessage(client.id, message);
      } catch (error) {
        sendError(transport, 'INVALID_GRAPH', 'Failed to handle message', {
          details: String(error)
        });
      }
    });

    transport.onError((error) => {
      console.error('Transport error:', error);
    });
  }

  private async handleMessage(
    clientId: string,
    message: GraphRunnerMessage
  ): Promise<void> {
    console.log('Received message from client', clientId, message);
    const client = this.state.getClient(clientId);
    if (!client) return;

    // Enforce hello as first message
    if (message.type !== 'hello' && !client.receivedHello) {
      sendError(
        client.transport,
        'PROTOCOL_VIOLATION',
        'Hello message must be sent first'
      );
      client.transport.disconnect();
      return;
    }

    switch (message.type) {
      case 'hello':
        await this.handleHello(client.transport, message);
        break;
      case 'ping':
        this.handlePing(client.transport, message);
        break;
      case 'createSession':
        this.handleCreateSession(client.transport, message);
        break;
      case 'resumeSession':
        this.handleResumeSession(client.transport, message);
        break;
      case 'closeSession':
        this.handleCloseSession(client.transport, message);
        break;
      case 'getCapabilities':
        this.handleGetCapabilities(client.transport);
        break;
      case 'registerGraph':
        this.handleRegisterGraph(client.transport, message);
        break;
      case 'listGraphs':
        this.handleListGraphs(client.transport, message);
        break;
      case 'validateGraph':
        this.handleValidateGraph(client.transport, message);
        break;
      case 'getServerVariables':
        this.handleGetServerVariables(client.transport, message);
        break;
      case 'getServerEvents':
        this.handleGetServerEvents(client.transport, message);
        break;
      case 'runGraph':
        await this.handleRunGraph(client.transport, message);
        break;
      case 'stopGraph':
        this.handleStopGraph(client.transport, message);
        break;
      case 'getStatus':
        this.handleGetStatus(client.transport, message);
        break;
      case 'batchGetStatus':
        this.handleBatchGetStatus(client.transport, message);
        break;
      case 'subscribe':
        this.handleSubscribe(client.transport, message);
        break;
      case 'unsubscribe':
        this.handleUnsubscribe(client.transport, message);
        break;
      case 'getNodeTypes':
        this.handleGetNodeTypes(client.transport, message);
        break;
      case 'getRunHistory':
        this.handleGetRunHistory(client.transport, message);
        break;
      default:
        console.warn(
          'Unknown message type:',
          (message as { type: string }).type
        );
    }
  }

  private handleGetNodeTypes(
    transport: ServerTransport,
    message: GraphRunnerMessage
  ): void {
    const client = this.state.getClientByTransport(transport);
    if (client?.sessionId) {
      const session = this.state.getSession(client.sessionId);
      if (session) {
        session.lastHeartbeat = Date.now();
      }
    }
    const nodeSpecs = writeNodeSpecsToJSON(this.state.registry);

    send(transport, {
      type: 'nodeTypes',
      nodes: nodeSpecs
    });
  }

  private stopRun(runId: string, _reason: string): void {
    const run = this.state.getRun(runId);
    if (!run) return;

    if (run.timeout) {
      clearTimeout(run.timeout);
    }

    run.status = 'stopped';
    run.completedAt = Date.now();

    // Clean up from all sessions
    this.state.sessions.forEach((session) => {
      session.activeRuns.delete(runId);
    });
  }

  private finalizeRun(runId: string, session: Session): void {
    const run = this.state.getRun(runId);
    if (!run) return;

    if (run.timeout) {
      clearTimeout(run.timeout);
    }

    session.activeRuns.delete(runId);
    run.engine?.dispose();

    // Add to history if enabled
    if (this.config.enableRunHistory) {
      this.state.addToHistory(run);
    }
  }

  /**
   * Execute a graph with proper lifecycle event handling
   * Handles start, tick, and end events from the lifecycle emitter
   */
  private async executeGraph(
    run: GraphRun,
    transport: ServerTransport,
    session: Session
  ): Promise<void> {
    if (!run.engine) {
      sendError(transport, 'NODE_EXECUTION_ERROR', 'Engine not initialized', {
        runId: run.runId,
        graphId: run.graphId
      });
      return;
    }
    const lifecycleEmitter = run.deps.ILifecycleEventEmitter;

    try {
      // Execute start event
      if (
        lifecycleEmitter.startEvent &&
        lifecycleEmitter.startEvent.listenerCount > 0
      ) {
        lifecycleEmitter.startEvent.emit();
        await run.engine.executeAllAsync(5);
      }

      // Execute tick events (runs indefinitely until stopped)
      if (
        lifecycleEmitter.tickEvent &&
        lifecycleEmitter.tickEvent.listenerCount > 0
      ) {
        while (run.status === 'running') {
          lifecycleEmitter.tickEvent.emit();
          await run.engine.executeAllAsync(5);

          // Check if run was stopped
          if (run.status !== 'running') {
            return;
          }

          // Small delay between ticks to prevent blocking
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Execute end event (only if still running)
      if (
        run.status === 'running' &&
        lifecycleEmitter.endEvent &&
        lifecycleEmitter.endEvent.listenerCount > 0
      ) {
        lifecycleEmitter.endEvent.emit();
        await run.engine.executeAllAsync(5);
      }

      // Only complete if not already stopped or errored
      if (run.status === 'running') {
        run.status = 'completed';
        run.completedAt = Date.now();
        run.result = {};

        send(transport, {
          type: 'completed',
          runId: run.runId,
          graphId: run.graphId,
          completedAt: run.completedAt,
          elapsedMs: run.completedAt - run.startedAt,
          result: run.result,
          performance: run.performance
        });

        this.finalizeRun(run.runId, session);
      }
    } catch (error) {
      run.status = 'error';
      run.error = error;
      run.completedAt = Date.now();

      sendError(transport, 'NODE_EXECUTION_ERROR', String(error), {
        runId: run.runId,
        graphId: run.graphId,
        details: error
      });

      this.finalizeRun(run.runId, session);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    this.state.sessions.forEach((session, sessionId) => {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach((sessionId) => {
      const session = this.state.getSession(sessionId);
      if (session) {
        session.activeRuns.forEach((runId) => {
          this.stopRun(runId, 'session_expired');
        });
      }
      this.state.deleteSession(sessionId);
    });

    if (expiredSessions.length > 0) {
      console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  // Connection handlers
  private async handleHello(
    transport: ServerTransport,
    message: {
      type: 'hello';
      protocolVersion: string;
      auth: {
        type: 'bearer' | 'apiKey' | 'none';
        token?: string;
        key?: string;
      };
    }
  ): Promise<void> {
    const client = this.state.getClientByTransport(transport);
    if (!client) return;

    if (client.receivedHello) {
      sendError(transport, 'PROTOCOL_VIOLATION', 'Hello already received');
      return;
    }

    client.receivedHello = true;

    // Check protocol version
    if (message.protocolVersion !== this.config.protocolVersion) {
      send(transport, {
        type: 'error',
        code: 'PROTOCOL_VERSION_MISMATCH',
        message: 'Unsupported version',
        supportedVersions: [this.config.protocolVersion]
      });
      transport.disconnect();
      return;
    }

    // Authenticate
    const authResult = await this.config.authProvider(message.auth);
    if (!authResult.valid) {
      sendError(
        transport,
        'AUTHENTICATION_FAILED',
        'Invalid or expired credentials'
      );
      transport.disconnect();
      return;
    }

    client.authenticated = true;
    client.userId = authResult.userId;

    send(transport, {
      type: 'welcome',
      protocolVersion: this.config.protocolVersion,
      serverId: this.config.serverId,
      authenticated: true,
      userId: client.userId
    });
  }

  private handlePing(
    transport: ServerTransport,
    message: { type: 'ping'; timestamp: number }
  ): void {
    const client = this.state.getClientByTransport(transport);
    if (client?.sessionId) {
      const session = this.state.getSession(client.sessionId);
      if (session) {
        session.lastHeartbeat = Date.now();
      }
    }

    send(transport, {
      type: 'pong',
      timestamp: message.timestamp
    });
  }

  private handleGetCapabilities(transport: ServerTransport): void {
    send(transport, {
      type: 'capabilities',
      capabilities: {
        trace: this.config.enableTrace,
        validation: this.config.enableValidation,
        graphRegistry: this.config.enableGraphRegistry,
        eventFiltering: this.config.enableEventFiltering,
        batchOperations: this.config.enableBatchOperations,
        runHistory: this.config.enableRunHistory,
        runtimeMetadata: this.config.enableRuntimeMetadata,
        maxConcurrentRuns: this.config.maxConcurrentRuns
      }
    });
  }

  // Session handlers
  private handleCreateSession(
    transport: ServerTransport,
    message: { type: 'createSession'; metadata?: Record<string, unknown> }
  ): void {
    const client = this.state.getClientByTransport(transport);
    if (!client?.authenticated) {
      sendError(
        transport,
        'AUTHENTICATION_REQUIRED',
        'Must authenticate first'
      );
      return;
    }

    const sessionId = generateId('sess');
    const session = this.state.createSession(
      sessionId,
      this.config.sessionExpirationMs,
      message.metadata
    );

    client.sessionId = sessionId;

    send(transport, {
      type: 'sessionCreated',
      sessionId,
      expiresAt: session.expiresAt
    });
  }

  private handleResumeSession(
    transport: ServerTransport,
    message: { type: 'resumeSession'; sessionId: string }
  ): void {
    const client = this.state.getClientByTransport(transport);
    if (!client?.authenticated) {
      sendError(
        transport,
        'AUTHENTICATION_REQUIRED',
        'Must authenticate first'
      );
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!session) {
      sendError(
        transport,
        'SESSION_NOT_FOUND',
        'Session does not exist or expired'
      );
      return;
    }

    if (Date.now() > session.expiresAt) {
      this.state.deleteSession(message.sessionId);
      sendError(transport, 'SESSION_EXPIRED', 'Session timed out');
      return;
    }

    client.sessionId = message.sessionId;
    session.lastHeartbeat = Date.now();

    send(transport, {
      type: 'sessionResumed',
      sessionId: message.sessionId,
      activeRuns: Array.from(session.activeRuns)
    });
  }

  private handleCloseSession(
    transport: ServerTransport,
    message: { type: 'closeSession'; sessionId: string }
  ): void {
    const session = this.state.getSession(message.sessionId);
    if (session) {
      // Stop all active runs
      session.activeRuns.forEach((runId) => {
        this.stopRun(runId, 'session_closed');
      });
      this.state.deleteSession(message.sessionId);
    }

    send(transport, {
      type: 'sessionClosed',
      sessionId: message.sessionId
    });
  }

  // Graph handlers
  private handleRegisterGraph(
    transport: ServerTransport,
    message: {
      type: 'registerGraph';
      sessionId: string;
      graphId: string;
      graph: unknown;
    }
  ): void {
    if (!this.config.enableGraphRegistry) {
      sendError(transport, 'PERMISSION_DENIED', 'Graph registry not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    this.state.registeredGraphs.set(message.graphId, {
      graphId: message.graphId,
      graph: message.graph as GraphJSON,
      registeredAt: Date.now()
    });

    send(transport, {
      type: 'graphRegistered',
      graphId: message.graphId
    });
  }

  private handleListGraphs(
    transport: ServerTransport,
    message: { type: 'listGraphs'; sessionId: string }
  ): void {
    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    const graphs = Array.from(this.state.registeredGraphs.values()).map(
      (g) => ({
        graphId: g.graphId,
        registeredAt: g.registeredAt
      })
    );

    send(transport, {
      type: 'graphList',
      graphs
    });
  }

  private handleValidateGraph(
    transport: ServerTransport,
    message: {
      type: 'validateGraph';
      sessionId: string;
      graphId: string;
      graph: unknown;
    }
  ): void {
    if (!this.config.enableValidation) {
      sendError(transport, 'PERMISSION_DENIED', 'Validation not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    try {
      const graphInstance = readGraphFromJSON({
        graphJson: message.graph as GraphJSON,
        registry: this.state.registry
      });

      const errors = validateGraph(graphInstance);

      send(transport, {
        type: 'validationResult',
        graphId: message.graphId,
        valid: errors.length === 0,
        errors: errors.map((e) => ({
          nodeId: '',
          message: e,
          severity: 'error'
        })),
        warnings: []
      });
    } catch (error) {
      send(transport, {
        type: 'validationResult',
        graphId: message.graphId,
        valid: false,
        errors: [{ nodeId: '', message: String(error), severity: 'error' }],
        warnings: []
      });
    }
  }

  private handleGetServerVariables(
    transport: ServerTransport,
    message: { type: 'getServerVariables'; sessionId: string }
  ): void {
    if (!this.config.enableRuntimeMetadata) {
      sendError(transport, 'PERMISSION_DENIED', 'Runtime metadata not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    // Return empty array for now - can be extended to return actual server-side variables
    send(transport, {
      type: 'serverVariables',
      variables: []
    });
  }

  private handleGetServerEvents(
    transport: ServerTransport,
    message: { type: 'getServerEvents'; sessionId: string }
  ): void {
    if (!this.config.enableRuntimeMetadata) {
      sendError(transport, 'PERMISSION_DENIED', 'Runtime metadata not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    // Return empty array for now - can be extended to return actual server-side custom events
    send(transport, {
      type: 'serverEvents',
      events: []
    });
  }

  // Execution handlers
  private async handleRunGraph(
    transport: ServerTransport,
    message: {
      type: 'runGraph';
      sessionId: string;
      graphId: string;
      graph?: unknown;
      inputs?: unknown;
      options?: {
        trace?: boolean;
        eventFilter?: {
          eventTypes?: string[];
          variableNames?: string[];
          eventNames?: string[];
        };
        maxExecutionTimeMs?: number;
      };
    }
  ): Promise<void> {
    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    const runId = generateId('run');

    try {
      // Get graph (from message or registry)
      let graphJson: GraphJSON;
      if (message.graph) {
        graphJson = message.graph as GraphJSON;
      } else {
        const registered = this.state.registeredGraphs.get(message.graphId);
        if (!registered) {
          sendError(
            transport,
            'INVALID_GRAPH',
            'Graph not provided and not in registry',
            { runId, graphId: message.graphId }
          );
          return;
        }
        graphJson = registered.graph;
      }

      //We need a new lifecycle emitter for each run to properly handle start/tick/end events without interference between runs
      const lifecycleEmitter = new ManualLifecycleEventEmitter();

      const dependencies = {
        ...this.state.registry.dependencies,
        ILifecycleEventEmitter: lifecycleEmitter,
        ILogger: new TransportLogger(transport, runId, message.graphId)
      };

      // Parse and validate graph
      const graphInstance = readGraphFromJSON({
        graphJson,
        registry: {
          ...this.state.registry,
          dependencies
        }
      });

      if (this.config.enableValidation) {
        const errors = validateGraph(graphInstance);
        if (errors.length > 0) {
          sendError(transport, 'VALIDATION_FAILED', errors.join('; '), {
            runId,
            graphId: message.graphId
          });
          return;
        }
      }

      // Create engine
      const engine = new Engine(graphInstance);

      // Create run record
      const run: GraphRun = {
        runId,
        graphId: message.graphId,
        status: 'running',
        startedAt: Date.now(),
        engine,
        graphInstance,
        deps: dependencies,
        performance: {
          nodesExecuted: 0,
          eventsEmitted: 0,
          variableChanges: 0
        }
      };

      this.state.addRun(run);
      session.activeRuns.add(runId);

      // Send run started event
      send(transport, {
        type: 'runStarted',
        runId,
        graphId: message.graphId,
        startedAt: run.startedAt
      });

      // Set up tracing if enabled
      if (message.options?.trace && this.config.enableTrace) {
        engine.onNodeExecutionStart.addListener((node) => {
          run.performance.nodesExecuted++;
          send(transport, {
            type: 'trace',
            runId,
            graphId: message.graphId,
            nodeId: node.id,
            event: 'start',
            data: {},
            timestamp: Date.now() - run.startedAt
          });
        });

        engine.onNodeExecutionEnd.addListener((node) => {
          send(transport, {
            type: 'trace',
            runId,
            graphId: message.graphId,
            nodeId: node.id,
            event: 'end',
            data: {},
            timestamp: Date.now() - run.startedAt
          });
        });
      }

      // Set up error handling
      engine.onNodeExecutionError.addListener(({ node, error }) => {
        run.status = 'error';
        run.error = error;
        run.completedAt = Date.now();

        send(transport, {
          type: 'error',
          code: 'NODE_EXECUTION_ERROR',
          message: String(error),
          runId,
          graphId: message.graphId,
          nodeId: node.id,
          details: error
        });

        this.stopRun(runId, 'node_error');
        this.finalizeRun(runId, session);
      });

      // Set timeout if specified
      if (message.options?.maxExecutionTimeMs) {
        run.timeout = setTimeout(() => {
          this.stopRun(runId, 'timeout');
          sendError(transport, 'TIMEOUT', 'Execution exceeded max time', {
            runId,
            graphId: message.graphId
          });
        }, message.options.maxExecutionTimeMs);
      }

      // Execute graph with proper lifecycle handling
      await this.executeGraph(run, transport, session);
    } catch (error) {
      sendError(transport, 'NODE_EXECUTION_ERROR', String(error), {
        runId,
        graphId: message.graphId,
        details: error
      });

      const run = this.state.getRun(runId);
      if (run) {
        run.status = 'error';
        run.error = error;
        run.completedAt = Date.now();
        this.finalizeRun(runId, session);
      }
    } finally {
      // Clear logger context
      const logger = this.state.registry.dependencies.ILogger as ILogger;
      if (logger instanceof TransportLogger) {
        logger.clearContext();
      }
    }
  }

  private handleStopGraph(
    transport: ServerTransport,
    message: { type: 'stopGraph'; sessionId: string; runId: string }
  ): void {
    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    this.stopRun(message.runId, 'user_requested');

    send(transport, {
      type: 'stopped',
      runId: message.runId,
      graphId: this.state.getRun(message.runId)?.graphId ?? '',
      reason: 'user_requested'
    });
  }

  private handleSubscribe(
    transport: ServerTransport,
    message: {
      type: 'subscribe';
      sessionId: string;
      runId: string;
      filter?: {
        eventTypes?: string[];
        variableNames?: string[];
        eventNames?: string[];
      };
    }
  ): void {
    if (!this.config.enableEventFiltering) {
      sendError(transport, 'PERMISSION_DENIED', 'Event filtering not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    session.subscriptions.set(message.runId, message.filter);
  }

  private handleUnsubscribe(
    transport: ServerTransport,
    message: { type: 'unsubscribe'; sessionId: string; runId: string }
  ): void {
    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    session.subscriptions.delete(message.runId);
  }

  // Status handlers
  private handleGetStatus(
    transport: ServerTransport,
    message: { type: 'getStatus'; sessionId: string; runId: string }
  ): void {
    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    const run = this.state.getRun(message.runId);
    if (!run) {
      sendError(transport, 'RUN_NOT_FOUND', 'Run ID does not exist', {
        runId: message.runId
      });
      return;
    }

    const elapsedMs = (run.completedAt ?? Date.now()) - run.startedAt;

    send(transport, {
      type: 'status',
      runId: run.runId,
      graphId: run.graphId,
      status: run.status,
      startedAt: run.startedAt,
      elapsedMs,
      startedGraphs: [],
      performance: run.performance
    });
  }

  private handleBatchGetStatus(
    transport: ServerTransport,
    message: { type: 'batchGetStatus'; sessionId: string; runIds: string[] }
  ): void {
    if (!this.config.enableBatchOperations) {
      sendError(transport, 'PERMISSION_DENIED', 'Batch operations not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    const statuses = message.runIds.map((runId) => {
      const run = this.state.getRun(runId);
      if (!run) {
        return { runId, status: 'error' as const, elapsedMs: 0 };
      }
      const elapsedMs = (run.completedAt ?? Date.now()) - run.startedAt;
      return { runId, status: run.status, elapsedMs };
    });

    send(transport, {
      type: 'batchStatus',
      statuses
    });
  }

  private handleGetRunHistory(
    transport: ServerTransport,
    message: {
      type: 'getRunHistory';
      sessionId: string;
      limit?: number;
      graphId?: string;
    }
  ): void {
    if (!this.config.enableRunHistory) {
      sendError(transport, 'PERMISSION_DENIED', 'Run history not enabled');
      return;
    }

    const session = this.state.getSession(message.sessionId);
    if (!validateSession(transport, session, message.sessionId)) return;

    const history = this.state.getHistory(message.graphId, message.limit);

    send(transport, {
      type: 'runHistory',
      runs: history.map((r) => ({
        runId: r.runId,
        graphId: r.graphId,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        elapsedMs: (r.completedAt ?? Date.now()) - r.startedAt,
        result: r.result
      }))
    });
  }

  public close(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    console.log('GraphRunner server closed');
  }
}
