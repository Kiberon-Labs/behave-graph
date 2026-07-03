import {
  Engine,
  EventEmitter,
  Link,
  isFlowNode,
  type FiberListenerInner,
  type GraphInstance,
  type INode,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import { SuspendableFiber } from './fiber';
import { isSuspendable, type SerializedSuspension } from './types';

type StatefulNode = INode & {
  getState(): unknown;
  setState(value: unknown): void;
};

/** Concrete nodes carry getState/setState (from the Node base class) even
 * though INode does not declare them. */
const hasNodeState = (node: INode): node is StatefulNode => {
  const candidate = node as Partial<StatefulNode>;
  return (
    typeof candidate.getState === 'function' &&
    typeof candidate.setState === 'function'
  );
};

export class SuspendableEngine extends Engine {
  protected override fiberQueue: SuspendableFiber[] = [];
  public readonly onSuspension = new EventEmitter<SerializedSuspension>();

  constructor(graph: GraphInstance, registry: IRegistry) {
    super(graph, registry);
  }

  /**
   * Supply the suspendable fiber variant through the engine's fiber factory
   * seam. All scheduling logic (`trigger`, `commitToNewFiber`) is inherited
   * unchanged; only the concrete fiber type differs. Suspendable fibers manage
   * their own continuation state, so the triggering node passed by the base is
   * intentionally unused here.
   */
  protected override makeFiber(
    nextEval: Link | null,
    fiberCompletedListener: FiberListenerInner = undefined,
    _node: INode | undefined = undefined
  ): SuspendableFiber {
    return new SuspendableFiber(this, nextEval, fiberCompletedListener);
  }

  commitContinuedFiber(node: INode) {
    const fiber = new SuspendableFiber(this, new Link(node.id, 'flow'));
    this.fiberQueue.push(fiber);
  }

  suspend(): SerializedSuspension {
    const serializedNodes: Record<string, any> = {};
    Object.entries(this.nodes).forEach(([id, node]) => {
      if (isSuspendable(node)) {
        serializedNodes[id] = node.suspend();
        return;
      }
      // Flow nodes that keep their cursor in node state (e.g. flow/forLoop,
      // flow/sequence, flow/counter) are captured generically. Event/async
      // node state can hold live listeners or timers, so those must opt in
      // via ISuspendable instead.
      if (isFlowNode(node) && hasNodeState(node)) {
        const state = node.getState();
        if (state !== undefined) {
          serializedNodes[id] = structuredClone(state);
        }
      }
    });

    const serializedFiberQueue = this.fiberQueue.map((fiber) =>
      fiber.serialize()
    );

    // Snapshot the downstream links of each node's output sockets so that
    // connections made at runtime survive the suspension round-trip.
    const sockets: SerializedSuspension['sockets'] = {};
    Object.entries(this.nodes).forEach(([id, node]) => {
      const linkedOutputs: SerializedSuspension['sockets'][string] = {};
      node.outputs.forEach((socket) => {
        if (socket.links.length > 0) {
          linkedOutputs[socket.name] = socket.links.map((link) => ({
            nodeId: link.nodeId,
            socketName: link.socketName
          }));
        }
      });
      if (Object.keys(linkedOutputs).length > 0) {
        sockets[id] = linkedOutputs;
      }
    });

    // Snapshot non-flow output socket values: resumed flows may read an
    // upstream output (e.g. a loop's `index`) before that node re-executes.
    const socketValues: SerializedSuspension['socketValues'] = {};
    Object.entries(this.nodes).forEach(([id, node]) => {
      const values: Record<string, any> = {};
      node.outputs.forEach((socket) => {
        if (socket.valueTypeName === 'flow' || socket.value === undefined) {
          return;
        }
        const valueType = this.registry.values[socket.valueTypeName];
        values[socket.name] = valueType
          ? valueType.serialize(socket.value)
          : socket.value;
      });
      if (Object.keys(values).length > 0) {
        socketValues[id] = values;
      }
    });

    const variables: SerializedSuspension['variables'] = {};
    Object.entries(this.graph.variables).forEach(([id, variable]) => {
      const valueType = this.registry.values[variable.valueTypeName];
      variables[id] = {
        type: variable.valueTypeName,
        value: valueType ? valueType.serialize(variable.get()) : variable.get()
      };
    });

    return {
      fiberQueue: serializedFiberQueue,
      nodes: serializedNodes,
      sockets,
      socketValues,
      variables
    };
  }

  unsuspend(suspension: SerializedSuspension, continuanceData: any) {
    Object.entries(suspension.variables).forEach(([id, serialized]) => {
      const variable = this.graph.variables[id];
      if (!variable) {
        throw new Error(`Could not find missing variable ${id}`);
      }
      const valueType = this.registry.values[serialized.type];
      variable.set(
        valueType ? valueType.deserialize(serialized.value) : serialized.value
      );
    });

    Object.entries(suspension.sockets).forEach(([nodeId, linkedOutputs]) => {
      const node = this.nodes[nodeId];
      if (!node) {
        throw new Error(`Could not find missing node ${nodeId}`);
      }
      Object.entries(linkedOutputs).forEach(([socketName, links]) => {
        const socket = node.outputs.find((s) => s.name === socketName);
        if (!socket) {
          throw new Error(
            `Could not find missing socket ${socketName} on node ${nodeId}`
          );
        }
        socket.links.splice(
          0,
          socket.links.length,
          ...links.map((link) => new Link(link.nodeId, link.socketName))
        );
      });
    });

    Object.entries(suspension.socketValues ?? {}).forEach(
      ([nodeId, values]) => {
        const node = this.nodes[nodeId];
        if (!node) {
          throw new Error(`Could not find missing node ${nodeId}`);
        }
        Object.entries(values).forEach(([socketName, serialized]) => {
          const socket = node.outputs.find((s) => s.name === socketName);
          if (!socket) {
            throw new Error(
              `Could not find missing socket ${socketName} on node ${nodeId}`
            );
          }
          const valueType = this.registry.values[socket.valueTypeName];
          socket.value = valueType
            ? valueType.deserialize(serialized)
            : serialized;
        });
      }
    );

    Object.entries(suspension.nodes).forEach(([id, serialized]) => {
      const node = this.nodes[id];
      if (!node) {
        throw new Error(`Could not find missing node ${id}`);
      }

      if (isSuspendable(node)) {
        node.hydrate?.(serialized);
      } else if (isFlowNode(node) && hasNodeState(node)) {
        node.setState(serialized);
      }
    });

    //Recreate the fiberqueue
    this.fiberQueue = suspension.fiberQueue.map((x) =>
      SuspendableFiber.rehydrate(this, x)
    );

    // Only fibers suspended at an async node need an explicit continuation;
    // fibers suspended between steps resume through normal execution.
    const first = this.fiberQueue[0];
    if (first?.canContinue()) {
      first.continue(continuanceData);
    }
  }
}
