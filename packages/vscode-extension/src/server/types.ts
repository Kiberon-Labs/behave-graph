// ============================================================================
// Internal Types
// ============================================================================

import {
  Dependencies,
  Engine,
  GraphInstance,
  GraphJSON
} from '@kiberon-labs/behave-graph';
import {
  EventFilter,
  GraphRunnerMessage,
  ITransport,
  RunPerformance,
  RunStatus,
  ServerGraphRunnerMessage
} from '@kiberon-labs/behave-graph-flow';

export type ServerTransport = ITransport<
  ServerGraphRunnerMessage,
  GraphRunnerMessage
>;

export interface Session {
  id: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
  expiresAt: number;
  lastHeartbeat: number;
  activeRuns: Set<string>;
  subscriptions: Map<string, EventFilter | undefined>;
}

export interface GraphRun {
  runId: string;
  graphId: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  deps: Dependencies;
  result?: unknown;
  error?: unknown;
  engine?: Engine;
  graphInstance?: GraphInstance;
  performance: RunPerformance;
  timeout?: NodeJS.Timeout;
  /**
   * Flushes trace events still buffered by the run's trace batcher. Set when
   * tracing is enabled; call before emitting `completed`/`stopped` so the
   * client receives the tail of the trace while the run id is still routable.
   */
  flushTracing?: () => void;
}

export interface RegisteredGraph {
  graphId: string;
  graph: GraphJSON;
  registeredAt: number;
}

export interface ClientConnection {
  id: string;
  transport: ServerTransport;
  authenticated: boolean;
  userId?: string;
  sessionId?: string;
  receivedHello: boolean;
}
