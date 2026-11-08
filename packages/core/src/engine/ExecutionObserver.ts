import type { INode } from '../Nodes/NodeInstance.js';
import type { Socket } from '../Sockets/Socket.js';

export type InvocationOutcome =
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out'
  | 'step_limit';
export interface InvocationContext {
  readonly executionId: string;
  readonly invocationId: string;
  readonly nodeId: string;
  readonly typeName: string;
  readonly nodeType: string;
  readonly nodeLabel?: string;
  readonly fiberId?: string;
  readonly parentInvocationId?: string;
  readonly parentExecutionId?: string;
  readonly triggeringSocket?: string;
  readonly phase: 'execution' | 'initialization' | 'event' | 'continuation';
  /** Safe to retain in async callbacks. Ignored after this invocation ends. */
  emit(name: string, attributes?: Readonly<Record<string, unknown>>): void;
}
export type ExecutionObservation = InvocationObservation & {
  readonly context: InvocationContext;
  readonly timestamp: number;
  readonly sequence: number;
};
export type InvocationObservation =
  | { readonly kind: 'started' }
  | { readonly kind: 'inputs'; readonly sockets: readonly SocketObservation[] }
  | {
      readonly kind: 'finished';
      readonly outcome: InvocationOutcome;
      readonly durationMs: number;
      readonly error?: unknown;
      readonly sockets: readonly SocketObservation[];
    }
  | {
      readonly kind: 'diagnostic';
      readonly name: string;
      readonly attributes?: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: 'commit';
      readonly socket: string;
      readonly targets: readonly { nodeId: string; socket: string }[];
    };
export interface SocketObservation {
  readonly name: string;
  readonly valueType: string;
  readonly sources: readonly { nodeId: string; socket: string }[];
  readonly value?: unknown;
}
export interface ExecutionParent {
  readonly executionId: string;
  readonly invocationId: string;
}
export type ExecutionLifecycleObservation = {
  readonly executionId: string;
  readonly parent?: ExecutionParent;
  readonly graphName: string;
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly timestamp: number;
  readonly sequence: number;
} & (
  | { readonly kind: 'execution_started' }
  | {
      readonly kind: 'execution_finished';
      readonly outcome: InvocationOutcome;
      readonly durationMs: number;
      readonly executionSteps: number;
      readonly error?: unknown;
    }
);
export interface ExecutionObserverOptions {
  /** Host run ID, or a generated ID when absent. */
  executionId?: string;
  /** Redacted host metadata, such as graph/version IDs and trigger source. */
  attributes?: Readonly<Record<string, unknown>>;
  /** Invocation in another engine that caused this execution. */
  parent?: ExecutionParent;
  /** Root-span lifecycle. Uses the same sequence as invocation observations. */
  onExecution?: (event: ExecutionLifecycleObservation) => void;
  /** Synchronous, bounded callback: enqueue records for export outside core. */
  observer?: (event: ExecutionObservation) => void;
  /** Values are omitted by default. Return a redacted, immutable snapshot. */
  captureValue?: (value: unknown, socket: Socket, node: INode) => unknown;
  /** Defer event initialization until initialize() or execution is awaited. */
  deferInitialization?: boolean;
}

export interface EngineExecutionResult {
  readonly outcome: InvocationOutcome;
  readonly executionSteps: number;
  readonly pendingFibers: number;
  readonly pendingAsyncNodes: number;
  readonly error?: unknown;
}
