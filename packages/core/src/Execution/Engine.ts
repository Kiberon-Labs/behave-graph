/* eslint-disable space-in-parens */
// fdfdfd
import { Assert } from '../Diagnostics/Assert.js';
import { EventEmitter } from '../Events/EventEmitter.js';
import { generateUuid } from '../generateUuid.js';
import type { GraphNodes } from '../Graphs/Graph.js';
import {
  type IAsyncNode,
  type IEventNode,
  type INode,
  isAsyncNode,
  isEventNode
} from '../Nodes/NodeInstance.js';
import { sleep } from '../sleep.js';
import { Fiber, type FiberListenerInner } from './Fiber.js';
import { resolveSocketValue } from './resolveSocketValue.js';

type NodeError = {
  node: INode;
  error: unknown;
};

type NodeCommit = {
  node: INode;
  socket: string;
};

export class Engine {
  // tracking the next node+input socket to execute.
  public readonly id = generateUuid();
  private readonly fiberQueue: Fiber[] = [];
  public readonly asyncNodes: IAsyncNode[] = [];
  public readonly eventNodes: IEventNode[] = [];
  public readonly onNodeExecutionStart = new EventEmitter<INode>();
  public readonly onNodeExecutionEnd = new EventEmitter<INode>();
  public readonly onNodeExecutionError = new EventEmitter<NodeError>();
  public readonly onNodeCommit = new EventEmitter<NodeCommit>();
  public readonly nodes: GraphNodes;
  public executionSteps = 0;

  constructor(nodes: GraphNodes) {
    this.nodes = nodes;
    // collect all event nodes
    Object.values(nodes).forEach((node) => {
      if (isEventNode(node)) {
        this.eventNodes.push(node);
      }
    });
    // init all event nodes at startup
    this.eventNodes.forEach(async (eventNode) => {
      // evaluate input parameters

      try {
        for (const inputSocket of eventNode.inputs) {
          Assert.mustBeTrue(inputSocket.valueTypeName !== 'flow');
          this.executionSteps += await resolveSocketValue(this, inputSocket);
        }

        // this.onNodeExecutionStart.emit(eventNode);
        await eventNode.init(this);
        this.executionSteps++;
        // this.onNodeExecutionEnd.emit(eventNode);
      } catch (error) {
        this.onNodeExecutionError.emit({ node: eventNode, error });
        throw error;
      }
    });
  }

  dispose() {
    // dispose all, possibly in-progress, async nodes
    this.asyncNodes.forEach((asyncNode) => asyncNode.dispose());

    // dispose all event nodes
    this.eventNodes.forEach((eventNode) => eventNode.dispose(this));
  }

  // asyncCommit
  commitToNewFiber(
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
        const fiber = new Fiber(
          this,
          outputSocket.links[0]!,
          fiberCompletedListener,
          node
        );
        this.onNodeCommit.emit({ node, socket: outputFlowSocketName });

        this.fiberQueue.push(fiber);
      }
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  // NOTE: This does not execute all if there are promises.
  async executeAllSync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    const startDateTime = Date.now();
    let elapsedSeconds = 0;
    let elapsedSteps = 0;
    while (
      elapsedSteps < limitInSteps &&
      elapsedSeconds < limitInSeconds &&
      this.fiberQueue.length > 0
    ) {
      //Safe assertion as we know the queue length is >0
      const currentFiber = this.fiberQueue[0]!;
      const startingFiberExecutionSteps = currentFiber.executionSteps;
      await currentFiber.executeStep();
      elapsedSteps += currentFiber.executionSteps - startingFiberExecutionSteps;
      if (currentFiber.isCompleted()) {
        // remove first element
        this.fiberQueue.shift();
      }
      elapsedSeconds = (Date.now() - startDateTime) * 0.001;
    }
    this.executionSteps += elapsedSteps;

    return elapsedSteps;
  }

  async executeAllAsync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    const startDateTime = Date.now();
    let elapsedSteps = 0;
    let elapsedTime = 0;
    let iterations = 0;
    do {
      if (iterations > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(0);
      }
      elapsedSteps += await this.executeAllSync(
        limitInSeconds - elapsedTime,
        limitInSteps - elapsedSteps
      );
      elapsedTime = (Date.now() - startDateTime) * 0.001;
      iterations += 1;
    } while (
      (this.asyncNodes.length > 0 || this.fiberQueue.length > 0) &&
      elapsedTime < limitInSeconds &&
      elapsedSteps < limitInSteps
    );

    return elapsedSteps;
  }
}
