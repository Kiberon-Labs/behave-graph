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
  GraphInstance,
  ILifecycleEventEmitter,
  ILogger,
  IRegistry,
  NodeExecutionHandler
} from '@kiberon-labs/behave-graph';
import * as fs from 'fs';
import * as path from 'path';

import { transpileInWorkspace } from '../capabilities/transpile.js';
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
 * Factory a custom registry may export to vary the engine used per run  e.g.
 * `RealtimeEngine` instead of the default `Engine`. This is the extension's
 * surface for the engine's execution-strategy seam.
 */
type EngineFactory = (graph: GraphInstance, registry: IRegistry) => Engine;

/**
 * What a custom registry module can contribute to the runner: the registry
 * itself plus two optional seams  an {@link EngineFactory} and a table of
 * custom node-kind execution handlers (taught to the engine via
 * `registerNodeExecutionHandler`). The latter lets a registry add brand-new
 * node *kinds* (not just node types), e.g. an `'AudioRate'` render node.
 */
type LoadedRegistry = {
  registry: IRegistry;
  createEngine?: EngineFactory;
  executionHandlers?: Record<string, NodeExecutionHandler>;
};

/**
 * Transport-agnostic Graph Runner Server implementing the Behave-Graph Execution Protocol
 */
export class GraphRunnerServer {
  private state: ServerState;
  private config: Required<ServerConfig>;
  private cleanupInterval?: NodeJS.Timeout;
  /** Optional per-run engine factory contributed by a custom registry. */
  private engineFactory?: EngineFactory;
  /** Optional custom node-kind execution handlers from a custom registry. */
  private executionHandlers?: Record<string, NodeExecutionHandler>;

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
      storeEvent: () => { }, // No-op for server
      rehydrateState: async () => { }, // No-op for server
      syncState: async () => { }, // No-op for server
      syncAndClearState: async () => { }, // No-op for server
      resetState: async () => {
        stateMap.clear();
      }
    };

    // Load registry (custom or default), plus any engine factory / custom
    // node-kind handlers the registry module contributes.
    const { registry, createEngine, executionHandlers } =
      await GraphRunnerServer.loadRegistry(finalConfig.customRegistryPath);

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
    server.engineFactory = createEngine;
    server.executionHandlers = executionHandlers;
    server.connectTransport(transport);

    return server;
  }

  /**
   * Load registry from custom path or use default core profile.
   *
   * Returns the registry along with any optional engine factory / custom
   * node-kind execution handlers the registry module exports.
   */
  private static async loadRegistry(
    customRegistryPath: string
  ): Promise<LoadedRegistry> {
    if (customRegistryPath) {
      // Try both .ts and .js extensions relative to the graph file
      const basePath = customRegistryPath.replace(/\.(ts|js)$/, '');
      const possiblePaths = [
        `${basePath}.js`, // Compiled JS takes priority
        `${basePath}.mjs`,
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
    return {
      registry: registerCoreProfile({
        values: {},
        nodes: {},
        dependencies: {
          ILogger: new TransportLogger(),
          ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
        }
      })
    };
  }

  /**
   * Dynamically import a registry module, transpiling TypeScript on demand.
   *
   * The extension host's Node may not strip types from `.ts` files, so when a
   * direct import of a `.ts` registry fails we transpile it with a compiler
   * resolved from the workspace (esbuild or typescript) and import the emitted
   * ESM from a sibling temp file (kept adjacent so that bare-specifier
   * resolution against the project's `node_modules` still works).
   */
  private static async importRegistryModule(
    registryPath: string
  ): Promise<Record<string, unknown>> {
    const toFileUrl = (p: string) =>
      p.startsWith('file://') ? p : `file://${p.replace(/\\/g, '/')}`;

    try {
      return await import(toFileUrl(registryPath));
    } catch (err) {
      if (!registryPath.endsWith('.ts')) {
        throw err;
      }
      // Reuse the previous transpile+import if the file hasn't changed  every
      // graph open otherwise re-transpiles and re-imports the registry.
      const mtimeMs = fs.statSync(registryPath).mtimeMs;
      const cached = GraphRunnerServer.registryModuleCache.get(registryPath);
      if (cached && cached.mtimeMs === mtimeMs) {
        return cached.module;
      }
      console.log(
        `Direct import of ${registryPath} failed; transpiling TypeScript on demand`
      );
      const source = fs.readFileSync(registryPath, 'utf8');
      const { code } = await transpileInWorkspace(
        source,
        {
          loader: 'ts',
          format: 'esm',
          target: 'es2021',
          sourcefile: registryPath
        },
        path.dirname(registryPath)
      );
      const tmpPath = registryPath.replace(
        /\.ts$/,
        `.__compiled.${process.pid}.${Date.now()}.mjs`
      );
      fs.writeFileSync(tmpPath, code);
      try {
        const module = await import(toFileUrl(tmpPath));
        GraphRunnerServer.registryModuleCache.set(registryPath, {
          mtimeMs,
          module
        });
        return module;
      } finally {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          /* best effort */
        }
      }
    }
  }

  /** Cache of transpiled+imported `.ts` registry modules, keyed by path and
   *  invalidated by mtime, shared across all per-document servers. */
  private static readonly registryModuleCache = new Map<
    string,
    { mtimeMs: number; module: Record<string, unknown> }
  >();

  /**
   * Dynamically import a custom registry from a file path.
   *
   * Besides the required `registry` export (named or default), a module may also
   * export `createEngine` (an {@link EngineFactory}) and `executionHandlers`
   * (a map of node-kind → handler) to extend how graphs run.
   */
  private static async loadCustomRegistry(
    registryPath: string
  ): Promise<LoadedRegistry> {
    try {
      const registryModule =
        await GraphRunnerServer.importRegistryModule(registryPath);

      // Check for named export 'registry' or default export
      const registry = (registryModule.registry ?? registryModule.default) as
        | IRegistry
        | undefined;

      if (!registry) {
        throw new Error(
          'Custom registry file must export a registry as default export or named "registry" export'
        );
      }

      const createEngine = registryModule.createEngine as
        | EngineFactory
        | undefined;
      const executionHandlers = registryModule.executionHandlers as
        | Record<string, NodeExecutionHandler>
        | undefined;

      console.log(
        `Loaded custom registry from: ${registryPath}` +
        (createEngine ? ' (+ custom engine)' : '') +
        (executionHandlers
          ? ` (+ ${Object.keys(executionHandlers).length} execution handler(s))`
          : '')
      );
      return { registry, createEngine, executionHandlers };
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
    run.flushTracing?.();

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

        // Deliver buffered trace events before `completed` , the client
        // unregisters the run id on completion and would drop a late batch.
        run.flushTracing?.();

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
      run.flushTracing?.();

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
      const runRegistry = {
        ...this.state.registry,
        dependencies
      };
      const graphInstance = readGraphFromJSON({
        graphJson,
        registry: runRegistry
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

      // Create engine  a custom registry may supply its own engine (e.g.
      // RealtimeEngine) via an EngineFactory; otherwise use the default Engine.
      const engine = this.engineFactory
        ? this.engineFactory(graphInstance, runRegistry)
        : new Engine(graphInstance, runRegistry);

      // Teach the engine any custom node-kind execution handlers the registry
      // contributed (the open/closed seam for brand-new node kinds).
      if (this.executionHandlers) {
        for (const [nodeType, handler] of Object.entries(
          this.executionHandlers
        )) {
          engine.registerNodeExecutionHandler(nodeType, handler);
        }
      }

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

      // Set up tracing if enabled. Events are buffered and flushed as a single
      // `traceBatch` message per ~frame , per-event messages meant one WebSocket
      // frame per node execution, which dominated per-tick cost on fast graphs.
      if (message.options?.trace && this.config.enableTrace) {
        const TRACE_FLUSH_INTERVAL_MS = 16;
        const TRACE_FLUSH_MAX_EVENTS = 2048;
        let traceBuffer: Array<{
          nodeId: string;
          event: string;
          data?: unknown;
          timestamp: number;
        }> = [];
        let traceFlushTimer: ReturnType<typeof setTimeout> | undefined;

        const flushTraces = () => {
          traceFlushTimer = undefined;
          if (traceBuffer.length === 0) return;
          const events = traceBuffer;
          traceBuffer = [];
          send(transport, {
            type: 'traceBatch',
            runId,
            graphId: message.graphId,
            events
          });
        };

        run.flushTracing = flushTraces;

        const pushTrace = (event: {
          nodeId: string;
          event: string;
          data?: unknown;
          timestamp: number;
        }) => {
          traceBuffer.push(event);
          if (traceBuffer.length >= TRACE_FLUSH_MAX_EVENTS) {
            if (traceFlushTimer !== undefined) clearTimeout(traceFlushTimer);
            flushTraces();
            return;
          }
          if (traceFlushTimer === undefined) {
            traceFlushTimer = setTimeout(flushTraces, TRACE_FLUSH_INTERVAL_MS);
          }
        };

        engine.onNodeExecutionStart.addListener((node) => {
          run.performance.nodesExecuted++;
          pushTrace({
            nodeId: node.id,
            event: 'start',
            data: {},
            timestamp: Date.now() - run.startedAt
          });
        });

        engine.onNodeExecutionEnd.addListener((node) => {
          pushTrace({
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
