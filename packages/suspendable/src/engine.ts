import {
  Assert,
  Engine,
  EventEmitter,
  isAsyncNode,
  isEventNode,
  Link,
  writeGraphToJSON,
  type FiberListenerInner,
  type GraphInstance,
  type INode,
  type IRegistry
} from '@kinforge/behave-graph';
import { SuspendableFiber, type SerializedSuspendedFiber } from './fiber';
import type { SerializedSuspension } from './types';

export class SuspendableEngine extends Engine {
  protected override fiberQueue: SuspendableFiber[] = [];
  public readonly onSuspension = new EventEmitter<SerializedSuspension>();
  protected registry: IRegistry;

  constructor(graph: GraphInstance, registry: IRegistry) {
    super(graph);
    this.registry = registry;
  }

  //TODO this is a weak point in the system to completely override the existing logic
  override commitToNewFiber(
    node: INode,
    outputFlowSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ) {
    try {
      Assert.mustBeTrue(isEventNode(node) || isAsyncNode(node));
      const outputSocket = node.outputs.find(
        (socket) => socket.name === outputFlowSocketName
      );
      if (outputSocket === undefined) {
        throw new Error(`no socket with the name ${outputFlowSocketName}`);
      }
      if (outputSocket.links.length > 1) {
        throw new Error(
          'invalid for an output flow socket to have multiple downstream links:' +
            `${node.description.typeName}.${outputSocket.name} has ${outputSocket.links.length} downlinks`
        );
      }
      if (outputSocket.links.length === 1) {
        const fiber = new SuspendableFiber(
          this,
          outputSocket.links[0]!,
          fiberCompletedListener
        );
        this.onNodeCommit.emit({ node, socket: outputFlowSocketName });

        this.fiberQueue.push(fiber);
      }
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  commitContinuedFiber(node: INode) {
    const fiber =  new SuspendableFiber(this, new Link(node.id, 'flow'));
    this.fiberQueue.push(fiber);
  }

  suspend(): SerializedSuspension {
    const serializedNodes: Record<string, any> = {};
    Object.entries(this.nodes).forEach(([id, node]) => {
      if (isSuspendable(node)) {
        serializedNodes[id] = node.suspend();
      }
    });

    const serializedFiberQueue = this.fiberQueue.map((fiber) =>
      fiber.serialize()
    );

    writeGraphToJSON();

    return {
      fiberQueue: serializedFiberQueue,
      suspendedNodes: serializedNodes
    };
  }

  unsuspend(SerializedSuspension: SerializedSuspension, continuanceData: any) {
    Object.entries(SerializedSuspension.nodes).forEach(([id, serialized]) => {
      const node = this.nodes[id];
      if (!node) {
        throw new Error(`Could not find missing node ${id}`);
      }

      if (isSuspendable(node) && node.hydrate) {
        node.hydrate(serialized);
      }
    });

    //Recreate the fiberqueue
    this.fiberQueue = SerializedSuspension.fiberQueue.map((x) =>
      SuspendableFiber.rehydrate(this, x)
    );
  }
}
