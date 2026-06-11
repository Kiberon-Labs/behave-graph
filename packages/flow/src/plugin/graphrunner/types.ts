import {
  type CustomEventJSON,
  type GraphJSON,
  type NodeSpecJSON,
  type VariableJSON
} from '@kiberon-labs/behave-graph';

// Protocol Types (from protocol spec)
export type RunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'stopped'
  | 'error';

export type ErrorCode =
  | 'PROTOCOL_VERSION_MISMATCH'
  | 'PROTOCOL_VIOLATION'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHENTICATION_REQUIRED'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'INVALID_GRAPH'
  | 'VALIDATION_FAILED'
  | 'RUN_NOT_FOUND'
  | 'NODE_EXECUTION_ERROR'
  | 'TIMEOUT'
  | 'CONCURRENT_LIMIT_EXCEEDED'
  | 'PERMISSION_DENIED';

export interface GraphRunnerCapabilities {
  trace: boolean;
  validation?: boolean;
  graphRegistry?: boolean;
  eventFiltering?: boolean;
  batchOperations?: boolean;
  runHistory?: boolean;
  runtimeMetadata?: boolean;
  maxConcurrentRuns?: number;
  /**
   * Can the graph be modified in realtime?
   */
  realtime?: boolean;
  maxConcurrentDynamicRuns?: number;
  updateGranularity?: 'node' | 'socket' | 'full';
}

export interface RunPerformance {
  nodesExecuted: number;
  eventsEmitted: number;
  variableChanges: number;
}

export interface EventFilter {
  eventTypes?: string[];
  variableNames?: string[];
  eventNames?: string[];
}

export interface ServerVariable extends VariableJSON {
  readonly: boolean;
  description?: string;
}

export interface ServerEvent extends CustomEventJSON {
  readonly: boolean;
  description?: string;
  payloadSchema?: unknown;
}

export interface SocketConstraint {
  type: 'enum' | 'range' | 'pattern' | 'custom';
  choices?: Array<{ value: unknown; label: string }>;
  min?: number;
  max?: number;
  pattern?: string;
  validator?: string;
}

export interface NodeSocket {
  name: string;
  valueType: string;
  required?: boolean;
  hasConstraints?: boolean;
}

export interface AuthCredentials {
  type: 'bearer' | 'apiKey' | 'none';
  token?: string;
  key?: string;
}

// Server Message Types
export interface ServerPongMessage {
  type: 'pong';
  timestamp: number;
}

export interface ServerWelcomeMessage {
  type: 'welcome';
  protocolVersion: string;
  serverId: string;
  authenticated: boolean;
  userId?: string;
}

export interface CapabilitiesMessage {
  type: 'capabilities';
  capabilities: GraphRunnerCapabilities;
}

export interface SessionCreatedMessage {
  type: 'sessionCreated';
  sessionId: string;
  expiresAt: number;
}

export interface SessionResumedMessage {
  type: 'sessionResumed';
  sessionId: string;
  activeRuns: string[];
}

export interface SessionClosedMessage {
  type: 'sessionClosed';
  sessionId: string;
}

export interface ServerVariablesMessage {
  type: 'serverVariables';
  variables: ServerVariable[];
}

export interface ServerEventsMessage {
  type: 'serverEvents';
  events: ServerEvent[];
}

export interface SocketConstraintsMessage {
  type: 'socketConstraints';
  nodeType: string;
  socketName: string;
  valueType: string;
  constraints: SocketConstraint;
}

export interface NodeTypesMessage {
  type: 'nodeTypes';
  nodes: NodeSpecJSON[];
}

export interface RunStartedMessage {
  type: 'runStarted';
  runId: string;
  graphId: string;
  startedAt: number;
}

export interface ServerGraphRegisteredMessage {
  type: 'graphRegistered';
  graphId: string;
}

export interface ServerGraphListMessage {
  type: 'graphList';
  graphs: Array<{ graphId: string; registeredAt: number }>;
}

export interface ValidationResultMessage {
  type: 'validationResult';
  graphId: string;
  valid: boolean;
  errors: Array<{ nodeId: string; message: string; severity: string }>;
  warnings: Array<{ nodeId: string; message: string; severity: string }>;
}

export interface TraceMessage {
  type: 'trace';
  runId: string;
  graphId: string;
  nodeId: string;
  event: string;
  data: unknown;
  timestamp: number;
}

export interface LogMessage {
  type: 'log';
  runId: string;
  graphId: string;
  level: string;
  message: string;
  data?: unknown;
}

export interface VariableChangedMessage {
  type: 'variableChanged';
  runId: string;
  graphId: string;
  variableName: string;
  oldValue: unknown;
  newValue: unknown;
  nodeId?: string;
}

export interface CompletedMessage {
  type: 'completed';
  runId: string;
  graphId: string;
  completedAt: number;
  elapsedMs: number;
  result: unknown;
  performance: RunPerformance;
}

export interface StoppedMessage {
  type: 'stopped';
  runId: string;
  graphId: string;
  reason: string;
}

export interface StatusMessage {
  type: 'status';
  runId: string;
  graphId: string;
  status: RunStatus;
  startedAt: number;
  elapsedMs: number;
  currentNodeId?: string;
  startedGraphs: Array<{
    runId: string;
    graphId: string;
    status: RunStatus;
  }>;
  performance: RunPerformance;
}

export interface BatchStatusMessage {
  type: 'batchStatus';
  statuses: Array<{ runId: string; status: RunStatus; elapsedMs: number }>;
}

export interface ErrorMessage {
  type: 'error';
  code: ErrorCode;
  message: string;
  runId?: string;
  graphId?: string;
  nodeId?: string;
  details?: unknown;
  supportedVersions?: string[];
}

export interface RunHistoryMessage {
  type: 'runHistory';
  runs: Array<{
    runId: string;
    graphId: string;
    status: RunStatus;
    startedAt: number;
    completedAt?: number;
    elapsedMs: number;
    result?: unknown;
  }>;
}

export type ServerGraphRunnerMessage =
  // Connection
  | ServerPongMessage
  | ServerWelcomeMessage
  // Capabilities
  | CapabilitiesMessage
  // Session Management
  | SessionCreatedMessage
  | SessionResumedMessage
  | SessionClosedMessage
  // Runtime Metadata
  | ServerVariablesMessage
  | ServerEventsMessage
  | SocketConstraintsMessage
  | NodeTypesMessage
  // Execution
  | RunStartedMessage
  // Graph Registry
  | ServerGraphRegisteredMessage
  | ServerGraphListMessage
  // Validation
  | ValidationResultMessage
  // Events
  | TraceMessage
  | LogMessage
  | VariableChangedMessage
  | CompletedMessage
  | NodeAddedMessage
  // Status
  | StoppedMessage
  | StatusMessage
  | BatchStatusMessage
  // Errors
  | ErrorMessage
  // Realtime State Changes
  | NodeRemovedMessage
  | LinkCreatedMessage
  | LinkRemovedMessage
  | NodeParamUpdatedMessage
  | AffectedNodesMessage
  // History
  | RunHistoryMessage;

// Client Message Types
export interface HelloMessage {
  type: 'hello';
  protocolVersion: string;
  auth: AuthCredentials;
}

export interface WelcomeMessage {
  type: 'welcome';
  protocolVersion: string;
  serverId: string;
  authenticated: boolean;
  userId?: string;
}

export interface PingMessage {
  type: 'ping';
  timestamp: number;
}

export interface PongMessage {
  type: 'pong';
  timestamp: number;
}

export interface CreateSessionMessage {
  type: 'createSession';
  metadata?: Record<string, unknown>;
}

export interface ResumeSessionMessage {
  type: 'resumeSession';
  sessionId: string;
}

export interface CloseSessionMessage {
  type: 'closeSession';
  sessionId: string;
}

export interface GetCapabilitiesMessage {
  type: 'getCapabilities';
}

export interface GetServerVariablesMessage {
  type: 'getServerVariables';
  sessionId: string;
}

export interface GetServerEventsMessage {
  type: 'getServerEvents';
  sessionId: string;
}

export interface GetSocketConstraintsMessage {
  type: 'getSocketConstraints';
  sessionId: string;
  nodeType: string;
  socketName: string;
}

export interface GetNodeTypesMessage {
  type: 'getNodeTypes';
  sessionId: string;
}

export interface RegisterGraphMessage {
  type: 'registerGraph';
  sessionId: string;
  graphId: string;
  graph: GraphJSON;
}

export interface GraphRegisteredMessage {
  type: 'graphRegistered';
  graphId: string;
}

export interface GraphListMessage {
  type: 'graphList';
  graphs: Array<{ graphId: string; registeredAt: number }>;
}

export interface ValidateGraphMessage {
  type: 'validateGraph';
  sessionId: string;
  graphId: string;
  graph: unknown;
}

export interface RunGraphMessage {
  type: 'runGraph';
  sessionId: string;
  graphId: string;
  graph: GraphJSON;
  inputs?: unknown;
  options?: {
    autoEnd?: boolean;
    trace?: boolean;
    eventFilter?: EventFilter;
    maxExecutionTimeMs?: number;
    autoExecMode?: 'new' | 'current';
    allowDynamicChanges?: boolean;
    streamDeltas?: boolean;
  };
}

export interface ListGraphsMessage {
  type: 'listGraphs';
  sessionId: string;
}

export interface BatchRunStartedMessage {
  type: 'batchRunStarted';
  runs: Array<{ runId: string; graphId: string }>;
}

export interface StopGraphMessage {
  type: 'stopGraph';
  sessionId: string;
  runId: string;
}

export interface GetStatusMessage {
  type: 'getStatus';
  sessionId: string;
  runId: string;
}

export interface BatchGetStatusMessage {
  type: 'batchGetStatus';
  sessionId: string;
  runIds: string[];
}

export interface SubscribeMessage {
  type: 'subscribe';
  sessionId: string;
  runId: string;
  filter?: EventFilter;
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  sessionId: string;
  runId: string;
}

export interface EventEmittedMessage {
  type: 'eventEmitted';
  runId: string;
  graphId: string;
  eventName: string;
  payload: unknown;
  nodeId?: string;
}

export interface NodeAddedMessage {
  type: 'nodeAdded';
  runId: string;
  graphId: string;
  nodeId: string;
  nodeType: string;
  nodeData?: unknown;
}

export interface GetRunHistoryMessage {
  type: 'getRunHistory';
  sessionId: string;
  limit?: number;
  graphId?: string;
}

// Realtime Modification Messages (Client → Server)
export interface AddNodeMessage {
  type: 'addNode';
  sessionId: string;
  runId: string;
  nodeId: string;
  nodeType: string;
  nodeData?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface RemoveNodeMessage {
  type: 'removeNode';
  sessionId: string;
  runId: string;
  nodeId: string;
}

export interface UpdateSocketValueMessage {
  type: 'updateSocketValue';
  sessionId: string;
  runId: string;
  nodeId: string;
  socketName: string;
  value: unknown;
}

export interface UpdateNodeParamMessage {
  type: 'updateNodeParam';
  sessionId: string;
  runId: string;
  nodeId: string;
  paramName: string;
  value: unknown;
}

export interface CreateLinkMessage {
  type: 'createLink';
  sessionId: string;
  runId: string;
  fromNodeId: string;
  fromSocket: string;
  toNodeId: string;
  toSocket: string;
}

export interface RemoveLinkMessage {
  type: 'removeLink';
  sessionId: string;
  runId: string;
  fromNodeId: string;
  fromSocket: string;
  toNodeId: string;
  toSocket: string;
}

export interface DirectExecuteNodeMessage {
  type: 'directExecuteNode';
  sessionId: string;
  runId: string;
  nodeId: string;
  inputSocketName: string;
  inputValue: unknown;
  autoExecMode?: 'new' | 'current';
}

// Realtime State Change Events (Server → Client)
export interface NodeRemovedMessage {
  type: 'nodeRemoved';
  runId: string;
  graphId: string;
  nodeId: string;
}

export interface LinkCreatedMessage {
  type: 'linkCreated';
  runId: string;
  graphId: string;
  fromNodeId: string;
  fromSocket: string;
  toNodeId: string;
  toSocket: string;
}

export interface LinkRemovedMessage {
  type: 'linkRemoved';
  runId: string;
  graphId: string;
  fromNodeId: string;
  fromSocket: string;
  toNodeId: string;
  toSocket: string;
}

export interface NodeParamUpdatedMessage {
  type: 'nodeParamUpdated';
  runId: string;
  graphId: string;
  nodeId: string;
  paramName: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface AffectedNodesMessage {
  type: 'affectedNodes';
  runId: string;
  graphId: string;
  nodeIds: string[];
  reason:
    | 'direct-execution'
    | 'socket-value-update'
    | 'param-update'
    | 'link-change';
}

export type GraphRunnerMessage =
  // Connection
  | HelloMessage
  | WelcomeMessage
  | PingMessage
  | PongMessage
  // Session Management
  | CreateSessionMessage
  | ResumeSessionMessage
  | CloseSessionMessage
  // Capabilities
  | GetCapabilitiesMessage
  // Runtime Metadata
  | GetServerVariablesMessage
  | GetServerEventsMessage
  | GetSocketConstraintsMessage
  | GetNodeTypesMessage
  // Graph Registry
  | RegisterGraphMessage
  | GraphRegisteredMessage
  | GraphListMessage
  // Validation
  | ValidateGraphMessage
  // Execution
  | RunGraphMessage
  | ListGraphsMessage
  | BatchRunStartedMessage
  | StopGraphMessage
  // Status
  | GetStatusMessage
  | BatchGetStatusMessage
  // Events
  | SubscribeMessage
  | UnsubscribeMessage
  | EventEmittedMessage
  | NodeAddedMessage
  // Realtime Modifications
  | AddNodeMessage
  | RemoveNodeMessage
  | UpdateSocketValueMessage
  | UpdateNodeParamMessage
  | CreateLinkMessage
  | RemoveLinkMessage
  | DirectExecuteNodeMessage
  // Realtime State Changes
  | NodeRemovedMessage
  | LinkCreatedMessage
  | LinkRemovedMessage
  | NodeParamUpdatedMessage
  | AffectedNodesMessage
  // History
  | GetRunHistoryMessage;

export interface GraphRunnerClientConfig {
  url?: string;
  auth?: AuthCredentials;
  protocolVersion?: string;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  metadata?: Record<string, unknown>;
  transport?: import('./transport').ITransport;
  trace?: boolean;
  eventFilter?: EventFilter;
  maxExecutionTimeMs?: number;
  allowDynamicChanges?: boolean;
  autoExecMode?: 'new' | 'current';
  streamDeltas?: boolean;
  onMessageActivity?: (
    direction: 'sent' | 'received',
    message: GraphRunnerMessage
  ) => void;
}
