import {
  Engine,
  isEventNode,
  isAsyncNode,
  type ILifecycleEventEmitter,
  type IEventNode,
  type GraphInstance
} from '@kinforge/behave-graph';
import type { System } from './system';
import type { StoreApi } from 'zustand';
import { runnerStoreFactory, type RunnerStore } from '@/store/runner';

/**
 * GraphRunner manages the execution engine for behavior graphs.
 * It handles the lifecycle of the engine, including play/pause,
 * and provides methods for manual node execution.
 */
export class GraphRunner {
  private engine?: Engine;
  private timeout?: number;
  private isRunning = false;
  private system: System;
  public readonly store: StoreApi<RunnerStore>;

  constructor(system: System) {
    this.system = system;
    this.store = runnerStoreFactory(system);
  }

  /**
   * Get the current engine instance
   */
  getEngine(): Engine | undefined {
    return this.engine;
  }

  /**
   * Initialize or update the engine with a new graph
   */
  setGraph(graph: GraphInstance): void {
    // Dispose the existing engine if any
    if (this.engine) {
      this.dispose();
    }

    this.engine = new Engine(graph);

    // Update the store
    this.store.getState().setEngine(this.engine);

    // If we were running, restart with the new engine
    if (this.isRunning) {
      this.startExecution();
    }
  }

  /**
   * Start graph execution
   */
  play(): void {
    if (!this.engine || this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.store.getState().setPlaying(true);
    this.startExecution();
  }

  /**
   * Pause graph execution
   */
  pause(): void {
    this.isRunning = false;
    this.store.getState().setPlaying(false);
    if (this.timeout !== undefined) {
      window.clearTimeout(this.timeout);
      this.timeout = undefined;
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (this.isRunning) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Manually trigger a specific node by ID
   * Useful for event panels and debugging
   */
  triggerNode(nodeId: string): void {
    if (!this.engine) {
      console.warn('Cannot trigger node: no engine initialized');
      return;
    }

    const node = this.engine.nodes[nodeId];
    if (!node) {
      console.warn(`Cannot trigger node: node ${nodeId} not found`);
      return;
    }

    // Only event nodes can be manually triggered
    if (isEventNode(node)) {
      const eventNode = node as IEventNode;
      // Trigger the event node which will create a new fiber
      this.engine.commitToNewFiber(eventNode, 'flow');
      console.log('Triggered event node:', nodeId);
    } else {
      console.warn(
        `Cannot trigger node ${nodeId}: only event nodes can be manually triggered`
      );
    }
  }

  /**
   * Get all event nodes in the current graph
   * Useful for building event panels
   */
  getEventNodes(): Array<{ id: string; typeName: string }> {
    if (!this.engine) {
      return [];
    }

    const eventNodes: Array<{ id: string; typeName: string }> = [];

    for (const [id, node] of Object.entries(this.engine.nodes)) {
      if (isEventNode(node)) {
        eventNodes.push({
          id,
          typeName: node.description.typeName
        });
      }
    }

    return eventNodes;
  }

  /**
   * Get information about a specific node
   */
  getNodeInfo(nodeId: string) {
    if (!this.engine) {
      return undefined;
    }

    const node = this.engine.nodes[nodeId];
    if (!node) {
      return undefined;
    }

    return {
      id: nodeId,
      typeName: node.description.typeName,
      category: node.description.category,
      isEvent: isEventNode(node),
      isAsync: isAsyncNode(node),
      inputs: node.inputs.map((socket) => ({
        name: socket.name,
        valueTypeName: socket.valueTypeName
      })),
      outputs: node.outputs.map((socket) => ({
        name: socket.name,
        valueTypeName: socket.valueTypeName
      }))
    };
  }

  /**
   * Execute a single step of the graph
   */
  async step(): Promise<void> {
    if (!this.engine) {
      return;
    }

    await this.engine.executeAllAsync(Infinity, 1);
  }

  /**
   * Dispose of the engine and stop execution
   */
  dispose(): void {
    this.pause();

    if (this.engine) {
      this.engine.dispose();
      this.engine = undefined;
      this.store.getState().setEngine(undefined);
    }
  }

  /**
   * Internal method to start the execution loop
   */
  protected async startExecution(): Promise<void> {
    if (!this.engine || !this.isRunning) {
      return;
    }

    const registry = this.system.registry;
    const eventEmitter = registry.dependencies
      ?.ILifecycleEventEmitter as ILifecycleEventEmitter;

    // Execute all sync nodes first
    this.engine.executeAllSync();

    const onTick = async () => {
      if (!this.isRunning || !this.engine) {
        return;
      }

      eventEmitter.tickEvent.emit();
      await this.engine.executeAllAsync(500);

      this.timeout = window.setTimeout(onTick, 50);
    };

    // Emit start event if there are listeners
    if (eventEmitter.startEvent.listenerCount > 0) {
      eventEmitter.startEvent.emit();
      await this.engine.executeAllAsync(5);
    }

    onTick();
  }
}
