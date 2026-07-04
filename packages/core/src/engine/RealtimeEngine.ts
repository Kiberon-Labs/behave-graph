import { EventEmitter } from '../Events/EventEmitter.js';
import type { GraphInstance } from '../Graphs/Graph.js';
import type { INode } from '../Nodes/NodeInstance.js';
import { isEventNode, isAsyncNode } from '../Nodes/NodeInstance.js';
import type { IRegistry } from '../types/registry.js';
import { Engine } from './Engine.js';
import type { Fiber } from './Fiber.js';

export type NodeChangeEvent = {
  nodeId: string;
  node?: INode;
  type: 'added' | 'updated' | 'removed';
};

/**
 * RealtimeEngine extends Engine with support for:
 * - Dynamic node updates during execution
 * - Safe node deletion with disposal
 * - Resilience to fiber operations targeting deleted nodes
 * - Event notification for node changes
 */
export class RealtimeEngine extends Engine {
  private deletedNodeIds = new Set<string>();
  public readonly onNodeChanged = new EventEmitter<NodeChangeEvent>();

  constructor(graph: GraphInstance, registry: IRegistry) {
    super(graph, registry);
  }

  /**
   * Add a new node to the graph at runtime
   */
  addNode(node: INode): void {
    try {
      // Register the node
      this.nodes[node.id] = node;

      // If it's an event node, initialize it
      if (isEventNode(node)) {
        this.eventNodes.push(node);
        // Initialize async
        void node.init(this);
      }

      // Emit event
      this.onNodeChanged.emit({
        nodeId: node.id,
        node,
        type: 'added'
      });
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  /**
   * Remove a node from the graph at runtime
   * Handles disposal and cleans up pending fibers targeting the node
   */
  removeNode(nodeId: string): void {
    try {
      const node = this.nodes[nodeId];
      if (!node) {
        throw new Error(`Node with id ${nodeId} not found`);
      }

      // Mark as deleted to skip pending fibers targeting this node
      this.deletedNodeIds.add(nodeId);

      // Remove from nodes map
      delete this.nodes[nodeId];

      // Dispose event nodes
      if (isEventNode(node)) {
        const eventNodeIndex = this.eventNodes.indexOf(node);
        if (eventNodeIndex >= 0) {
          this.eventNodes.splice(eventNodeIndex, 1);
        }
        node.dispose(this);
      }

      // Dispose async nodes
      if (isAsyncNode(node)) {
        const asyncNodeIndex = this.asyncNodes.indexOf(node);
        if (asyncNodeIndex >= 0) {
          this.asyncNodes.splice(asyncNodeIndex, 1);
        }
        node.dispose();
      }

      // Clean up any pending fibers targeting this node
      this.cleanupFibersForNode(nodeId);

      // Emit event
      this.onNodeChanged.emit({
        nodeId,
        type: 'removed'
      });
    } catch (error) {
      const node = this.nodes[nodeId];
      if (node) {
        this.onNodeExecutionError.emit({ node, error });
      }
      throw error;
    }
  }

  /**
   * Remove all fibers targeting a deleted node
   * This prevents execution errors when trying to execute on deleted nodes
   */
  private cleanupFibersForNode(nodeId: string): void {
    const fiberQueue = this.fiberQueue as Fiber[];

    // Filter out fibers that target the deleted node
    // A fiber targets a node if its nextEval link points to that node
    let i = 0;
    while (i < fiberQueue.length) {
      const fiber = fiberQueue[i];
      if (fiber && fiber.nextEval && fiber.nextEval.nodeId === nodeId) {
        // Remove this fiber and complete its listeners
        fiberQueue.splice(i, 1);
      } else {
        i++;
      }
    }
  }

  /**
   * Check if a node has been deleted but hasn't been garbage collected yet
   */
  isNodeDeleted(nodeId: string): boolean {
    return this.deletedNodeIds.has(nodeId);
  }

  /**
   * Clear the deleted node tracking set
   * Can be called periodically to reduce memory usage
   */
  clearDeletedNodeTracking(): void {
    this.deletedNodeIds.clear();
  }

  /** True when a fiber's next evaluation targets a node that has been deleted. */
  private isFiberTargetingDeletedNode(fiber: Fiber): boolean {
    return fiber.nextEval !== null && this.isNodeDeleted(fiber.nextEval.nodeId);
  }

  /**
   * Drop any fibers at the head of the queue whose next evaluation targets a
   * deleted node, so the main loop only ever processes a live fiber.
   */
  private skipDeletedFibersAtHead(fiberQueue: Fiber[]): void {
    while (
      fiberQueue.length > 0 &&
      fiberQueue[0]?.nextEval &&
      this.isNodeDeleted(fiberQueue[0].nextEval.nodeId)
    ) {
      fiberQueue.shift();
    }
  }

  /**
   * Override executeAllSync to skip fibers targeting deleted nodes
   */
  override async executeAllSync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    const startDateTime = Date.now();
    let elapsedSeconds = 0;
    let elapsedSteps = 0;

    const fiberQueue = this.fiberQueue as Fiber[];

    while (
      elapsedSteps < limitInSteps &&
      elapsedSeconds < limitInSeconds &&
      fiberQueue.length > 0
    ) {
      // Remove any fibers targeting deleted nodes before processing.
      this.skipDeletedFibersAtHead(fiberQueue);

      // If no valid fibers remain, exit
      if (fiberQueue.length === 0) {
        break;
      }

      const currentFiber = fiberQueue[0]!;
      const startingFiberExecutionSteps = currentFiber.executionSteps;

      try {
        await currentFiber.executeStep();
      } catch (error) {
        // If error is due to deleted node, skip this fiber and move on.
        if (this.isFiberTargetingDeletedNode(currentFiber)) {
          fiberQueue.shift();
          elapsedSteps += 1;
          continue;
        }
        throw error;
      }

      elapsedSteps += currentFiber.executionSteps - startingFiberExecutionSteps;

      if (currentFiber.isCompleted()) {
        fiberQueue.shift();
      }

      elapsedSeconds = (Date.now() - startDateTime) * 0.001;
    }

    this.executionSteps += elapsedSteps;
    return elapsedSteps;
  }

  /**
   * Dispose the engine and clean up all resources
   */
  override dispose(): void {
    // Clear deleted node tracking
    this.deletedNodeIds.clear();

    // Call parent dispose
    super.dispose();
  }
}
