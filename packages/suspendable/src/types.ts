import type { INode } from '@kiberon-labs/behave-graph';
import type { SuspendableEngine } from './engine';
import type { SerializedSuspendedFiber } from './fiber';

export interface IAsyncSuspendable<T = any, State = any>
  extends ISuspendable<State> {
  /**
   * Continue from suspension
   */
  unsuspend(
    data: T,
    engine: SuspendableEngine,
    triggeringSocketName: string,
    cb: () => void
  ): Promise<void>;
  triggered(
    engine: SuspendableEngine,
    triggeringSocketName: string,
    finished: () => void
  ): unknown;
}

export interface ISuspendable<T = any> extends INode {
  /**
   * Suspend and create a copy of your internal state
   */
  suspend(): T;
  /**
   * Rehydrate from suspended data
   */
  hydrate?(data: T): void;
}

export function isSuspendable(node: unknown): node is ISuspendable {
  if (node == null || typeof node !== 'object') {
    return false;
  }
  const candidate = node as Record<string, unknown>;
  // ISuspendable only requires suspend(); unsuspend() belongs to
  // IAsyncSuspendable and is checked at the point of continuation.
  return typeof candidate.suspend === 'function';
}

export type SerializedSuspension = {
  fiberQueue: SerializedSuspendedFiber[];
  /**
   * Serialized state of the nodes
   */
  nodes: Record<string, any>;
  sockets: Record<
    string,
    Record<string, { nodeId: string; socketName: string }[]>
  >;
  /**
   * Serialized output socket values per node. Resumed flows may read an
   * upstream node's output (e.g. a loop's `index`) before that node is
   * re-triggered, so the values present at suspension time must be restored.
   */
  socketValues: Record<string, Record<string, any>>;
  variables: Record<
    string,
    {
      type: string;
      value: any;
    }
  >;
};
