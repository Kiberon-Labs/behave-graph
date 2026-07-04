/**
 * Graph Runner client implementation with abstracted transport layer
 */

import type {
  EventFilter,
  GraphRunnerCapabilities,
  GraphRunnerClientConfig,
  GraphRunnerMessage,
  ServerGraphRunnerMessage,
  RunStatus,
  ServerEvent,
  ServerVariable,
  SocketConstraint
} from './types';
import {
  WebSocketTransport,
  type ITransport,
  type TransportState
} from './transport';
import type { NodeSpecJSON, GraphJSON } from '@kiberon-labs/behave-graph';

/**
 * Extract message type by its 'type' field
 */
type ExtractMessage<T extends string> = Extract<
  ServerGraphRunnerMessage,
  { type: T }
>;

/**
 * Map of client request message types to their expected server response types
 */
type RequestResponseMap = {
  createSession: 'sessionCreated';
  resumeSession: 'sessionResumed';
  closeSession: 'sessionClosed';
  getCapabilities: 'capabilities';
  batchGetStatus: 'batchStatus';
  getRunHistory: 'runHistory';
  getServerVariables: 'serverVariables';
  getServerEvents: 'serverEvents';
  getSocketConstraints: 'socketConstraints';
  registerGraph: 'graphRegistered';
  getNodeTypes: 'nodeTypes';
  validateGraph: 'validationResult';
  runGraph: 'runStarted';
  stopGraph: 'stopped';
  getStatus: 'status';
  listGraphs: 'graphList';
};

/**
 * Extract the response type for a given request type
 */
type ResponseForRequest<T extends keyof RequestResponseMap> = ExtractMessage<
  RequestResponseMap[T]
>;

/**
 * Handler for messages received from the server
 * Generic type parameter ensures the handler receives the correct message type
 */
type ServerMessageHandler<T extends ServerGraphRunnerMessage['type']> = (
  message: ExtractMessage<T>
) => void;

/**
 * Client for the Behave-Graph Execution Protocol
 * Supports multiple transport implementations (WebSocket, HTTP, etc.)
 */
export class GraphRunnerClient {
  public transport: ITransport;
  private config: GraphRunnerClientConfig;
  private messageHandlers = new Map<string, Set<ServerMessageHandler<any>>>();
  private sessionId: string | null = null;
  private capabilities: GraphRunnerCapabilities | null = null;
  private serverId: string | null = null;
  private authenticated = false;
  private userId: string | null = null;
  private pendingRequests = new Map<
    string,
    { resolve: (value: any) => void; reject: (error: any) => void }
  >();
  private connectionState:
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected' = 'disconnected';

  constructor(config: GraphRunnerClientConfig) {
    this.config = config;

    // Use provided transport or create default WebSocket transport
    if (config.transport) {
      this.transport = config.transport;
    } else if (config.url) {
      this.transport = new WebSocketTransport({
        url: config.url,
        reconnectInterval: config.reconnectInterval,
        heartbeatInterval: config.heartbeatInterval
      });
    } else {
      throw new Error('Either transport or url must be provided');
    }

    // Set up transport handlers
    this.transport.onMessage((message) =>
      this.handleMessage(message as unknown as ServerGraphRunnerMessage)
    );
    this.transport.onStateChange((state) =>
      this.handleTransportStateChange(state)
    );
    this.transport.onError((error) => this.handleTransportError(error));
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionState = 'connecting';

      // Wait for transport to connect
      this.transport
        .connect()
        .then(() => {
          this.connectionState = 'authenticating';

          // Wait for welcome message
          const welcomeHandler = (msg: ServerGraphRunnerMessage) => {
            if (msg.type === 'welcome') {
              this.serverId = msg.serverId;
              this.authenticated = msg.authenticated;
              this.userId = msg.userId ?? null;
              this.connectionState = 'connected';
              this.off('welcome', welcomeHandler);
              this.off('error', welcomeHandler);
              resolve();
            } else if (msg.type === 'error') {
              this.connectionState = 'disconnected';
              this.off('welcome', welcomeHandler);
              this.off('error', welcomeHandler);
              reject(new Error(`Connection failed: ${msg.message}`));
            }
          };

          this.on('welcome', welcomeHandler);
          this.on('error', welcomeHandler);

          // Send hello message
          this.send({
            type: 'hello',
            protocolVersion: this.config.protocolVersion ?? '1.0.0',
            auth: this.config.auth ?? { type: 'none' }
          });
        })
        .then(async () => {
          await this.getCapabilities();
        })
        .catch((error) => {
          this.connectionState = 'disconnected';
          reject(error);
        });
    });
  }

  disconnect(): void {
    this.transport.disconnect();
    this.connectionState = 'disconnected';
  }

  async createSession(metadata?: Record<string, unknown>): Promise<string> {
    const response = await this.request<'createSession'>({
      type: 'createSession',
      metadata: metadata ?? this.config.metadata
    });
    this.sessionId = response.sessionId;
    return response.sessionId;
  }

  async resumeSession(sessionId: string): Promise<string[]> {
    const response = await this.request<'resumeSession'>({
      type: 'resumeSession',
      sessionId
    });
    this.sessionId = sessionId;
    return response.activeRuns;
  }

  async closeSession(): Promise<void> {
    if (!this.sessionId) return;
    await this.request({ type: 'closeSession', sessionId: this.sessionId });
    this.sessionId = null;
  }

  async getCapabilities(): Promise<GraphRunnerCapabilities> {
    const response = await this.request<'getCapabilities'>({
      type: 'getCapabilities'
    });
    this.capabilities = response.capabilities;
    return response.capabilities;
  }

  async getServerVariables(): Promise<ServerVariable[]> {
    this.ensureSession();
    const response = await this.request<'getServerVariables'>({
      type: 'getServerVariables',
      sessionId: this.sessionId!
    });
    return response.variables;
  }

  async getServerEvents(): Promise<ServerEvent[]> {
    this.ensureSession();
    const response = await this.request<'getServerEvents'>({
      type: 'getServerEvents',
      sessionId: this.sessionId!
    });
    return response.events;
  }

  async getSocketConstraints(
    nodeType: string,
    socketName: string
  ): Promise<{
    valueType: string;
    constraints: SocketConstraint;
  }> {
    this.ensureSession();
    const response = await this.request<'getSocketConstraints'>({
      type: 'getSocketConstraints',
      sessionId: this.sessionId!,
      nodeType,
      socketName
    });
    return {
      valueType: response.valueType,
      constraints: response.constraints
    };
  }

  async getNodeTypes(): Promise<NodeSpecJSON[]> {
    this.ensureSession();
    const response = await this.request<'getNodeTypes'>({
      type: 'getNodeTypes',
      sessionId: this.sessionId!
    });
    return response.nodes;
  }

  async registerGraph(graphId: string, graph: GraphJSON): Promise<void> {
    this.ensureSession();
    await this.request<'registerGraph'>({
      type: 'registerGraph',
      sessionId: this.sessionId!,
      graphId,
      graph
    });
  }

  async listGraphs(): Promise<
    Array<{ graphId: string; registeredAt: number }>
  > {
    this.ensureSession();
    const response = await this.request<'listGraphs'>({
      type: 'listGraphs',
      sessionId: this.sessionId!
    });
    return response.graphs;
  }

  async validateGraph(
    graphId: string,
    graph: unknown
  ): Promise<{
    valid: boolean;
    errors: Array<{ nodeId: string; message: string; severity: string }>;
    warnings: Array<{ nodeId: string; message: string; severity: string }>;
  }> {
    this.ensureSession();
    const response = await this.request<'validateGraph'>({
      type: 'validateGraph',
      sessionId: this.sessionId!,
      graphId,
      graph
    });
    return {
      valid: response.valid,
      errors: response.errors,
      warnings: response.warnings
    };
  }

  async runGraph(
    graphId: string,
    options?: { graph?: unknown; inputs?: unknown; trace?: boolean }
  ): Promise<string> {
    this.ensureSession();
    const response = await this.request<'runGraph'>({
      type: 'runGraph',
      sessionId: this.sessionId!,
      graphId,
      graph: options?.graph as GraphJSON,
      inputs: options?.inputs,
      options: {
        // Default off , tracing is a debugging aid with a real per-node cost;
        // callers opt in explicitly (the run controller passes the panel's
        // "Enable execution tracing" preference).
        trace: options?.trace ?? false
      }
    });

    return response.runId;
  }

  async stopGraph(runId: string): Promise<void> {
    this.ensureSession();
    await this.request({
      type: 'stopGraph',
      sessionId: this.sessionId!,
      runId
    });
  }

  async getStatus(runId: string) {
    this.ensureSession();
    const response = await this.request({
      type: 'getStatus',
      sessionId: this.sessionId!,
      runId
    });
    return response;
  }

  async batchGetStatus(
    runIds: string[]
  ): Promise<Array<{ runId: string; status: RunStatus; elapsedMs: number }>> {
    this.ensureSession();
    const response = await this.request({
      type: 'batchGetStatus',
      sessionId: this.sessionId!,
      runIds
    });
    return response.statuses;
  }

  async subscribe(runId: string, filter?: EventFilter): Promise<void> {
    this.ensureSession();
    this.send({
      type: 'subscribe',
      sessionId: this.sessionId!,
      runId,
      filter
    });
  }

  async unsubscribe(runId: string): Promise<void> {
    this.ensureSession();
    this.send({
      type: 'unsubscribe',
      sessionId: this.sessionId!,
      runId
    });
  }

  /**
   * Send a nodeAdded event
   * Used to notify the server when a node is added to the graph during execution
   */
  sendNodeAdded(
    runId: string,
    graphId: string,
    nodeId: string,
    nodeType: string,
    nodeData?: unknown
  ): void {
    this.send({
      type: 'nodeAdded',
      runId,
      graphId,
      nodeId,
      nodeType,
      nodeData
    });
  }

  async getRunHistory(options?: { limit?: number; graphId?: string }): Promise<
    Array<{
      runId: string;
      graphId: string;
      status: RunStatus;
      startedAt: number;
      completedAt?: number;
      elapsedMs: number;
      result?: unknown;
    }>
  > {
    this.ensureSession();
    const response = await this.request({
      type: 'getRunHistory',
      sessionId: this.sessionId!,
      limit: options?.limit,
      graphId: options?.graphId
    });
    return response.runs;
  }

  // Realtime modification methods

  addNode(
    runId: string,
    nodeId: string,
    nodeType: string,
    nodeData?: Record<string, unknown>,
    position?: { x: number; y: number }
  ): void {
    this.ensureSession();
    this.send({
      type: 'addNode',
      sessionId: this.sessionId!,
      runId,
      nodeId,
      nodeType,
      nodeData,
      position
    });
  }

  removeNode(runId: string, nodeId: string): void {
    this.ensureSession();
    this.send({
      type: 'removeNode',
      sessionId: this.sessionId!,
      runId,
      nodeId
    });
  }

  updateSocketValue(
    runId: string,
    nodeId: string,
    socketName: string,
    value: unknown
  ): void {
    this.ensureSession();
    this.send({
      type: 'updateSocketValue',
      sessionId: this.sessionId!,
      runId,
      nodeId,
      socketName,
      value
    });
  }

  updateNodeParam(
    runId: string,
    nodeId: string,
    paramName: string,
    value: unknown
  ): void {
    this.ensureSession();
    this.send({
      type: 'updateNodeParam',
      sessionId: this.sessionId!,
      runId,
      nodeId,
      paramName,
      value
    });
  }

  createLink(
    runId: string,
    fromNodeId: string,
    fromSocket: string,
    toNodeId: string,
    toSocket: string
  ): void {
    this.ensureSession();
    this.send({
      type: 'createLink',
      sessionId: this.sessionId!,
      runId,
      fromNodeId,
      fromSocket,
      toNodeId,
      toSocket
    });
  }

  removeLink(
    runId: string,
    fromNodeId: string,
    fromSocket: string,
    toNodeId: string,
    toSocket: string
  ): void {
    this.ensureSession();
    this.send({
      type: 'removeLink',
      sessionId: this.sessionId!,
      runId,
      fromNodeId,
      fromSocket,
      toNodeId,
      toSocket
    });
  }

  directExecuteNode(
    runId: string,
    nodeId: string,
    inputSocketName: string,
    inputValue: unknown,
    autoExecMode: 'new' | 'current' = 'current'
  ): void {
    this.ensureSession();
    this.send({
      type: 'directExecuteNode',
      sessionId: this.sessionId!,
      runId,
      nodeId,
      inputSocketName,
      inputValue,
      autoExecMode
    });
  }

  on<T extends ServerGraphRunnerMessage['type']>(
    messageType: T,
    handler: ServerMessageHandler<T>
  ): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType)!.add(handler);
  }

  off<T extends ServerGraphRunnerMessage['type']>(
    messageType: T,
    handler: ServerMessageHandler<T>
  ): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  getConnectionState():
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected' {
    return this.connectionState;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getCachedCapabilities(): GraphRunnerCapabilities | null {
    return this.capabilities;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getUserId(): string | null {
    return this.userId;
  }

  getServerId(): string | null {
    return this.serverId;
  }

  isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  private send(message: GraphRunnerMessage): void {
    this.transport.send(message);
    // Track sent message if callback is configured
    if (this.config.onMessageActivity) {
      this.config.onMessageActivity('sent', message);
    }
  }

  private handleMessage(message: ServerGraphRunnerMessage): void {
    // Track received message if callback is configured
    if (this.config.onMessageActivity) {
      this.config.onMessageActivity(
        'received',
        message as unknown as GraphRunnerMessage
      );
    }

    // Notify all handlers for this message type
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also notify wildcard handlers
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  private handleTransportStateChange(state: TransportState): void {
    // Map transport state to connection state
    if (state === 'disconnected') {
      this.connectionState = 'disconnected';
    } else if (state === 'connecting') {
      this.connectionState = 'connecting';
    }
  }

  private handleTransportError(error: Error): void {
    console.error('Transport error:', error);
    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(error);
    });
    this.pendingRequests.clear();
  }

  private async request<T extends keyof RequestResponseMap>(
    message: Extract<GraphRunnerMessage, { type: T }>
  ): Promise<ResponseForRequest<T>> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      this.pendingRequests.set(requestId, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 30000);

      const responseType = this.getExpectedResponseType(
        (message as { type: T }).type
      );

      const handler = (msg: ExtractMessage<typeof responseType>) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.off(responseType, handler);
        resolve(msg as ResponseForRequest<T>);
      };

      const errorHandler = (msg: ExtractMessage<'error'>) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.off(responseType, handler);
        this.off('error', errorHandler);
        reject(new Error(msg.message));
      };

      this.on(responseType, handler);
      this.on('error', errorHandler);

      try {
        this.send(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        this.off(responseType, handler);
        this.off('error', errorHandler);
        reject(error);
      }
    });
  }

  private ensureSession(): void {
    if (!this.sessionId) {
      throw new Error('No active session. Call createSession() first.');
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getExpectedResponseType<T extends keyof RequestResponseMap>(
    requestType: T
  ): RequestResponseMap[T] {
    const responseMap: RequestResponseMap = {
      createSession: 'sessionCreated',
      resumeSession: 'sessionResumed',
      closeSession: 'sessionClosed',
      getCapabilities: 'capabilities',
      getServerVariables: 'serverVariables',
      getServerEvents: 'serverEvents',
      getSocketConstraints: 'socketConstraints',
      getNodeTypes: 'nodeTypes',
      registerGraph: 'graphRegistered',
      listGraphs: 'graphList',
      validateGraph: 'validationResult',
      runGraph: 'runStarted',
      stopGraph: 'stopped',
      getStatus: 'status',
      batchGetStatus: 'batchStatus',
      getRunHistory: 'runHistory'
    };
    return responseMap[requestType];
  }
}
