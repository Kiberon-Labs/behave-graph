import { isThenable } from '../utils/isThenable.js';
import type {
  ExecutionParent,
  EngineExecutionResult,
  ExecutionObserverOptions,
  InvocationContext,
  InvocationOutcome,
  InvocationObservation,
  SocketObservation
} from './ExecutionObserver.js';
/* eslint-disable space-in-parens */
import { Link } from '@/Nodes/Link.js';
import { Assert } from '../Diagnostics/Assert.js';
import { EventEmitter } from '../Events/EventEmitter.js';
import { generateUuid } from '../utils/generateUuid.js';
import type { GraphInstance, GraphNodes } from '../Graphs/Graph.js';
import {
  type IAsyncNode,
  type IEventNode,
  type INode,
  isAsyncNode,
  isEventNode
} from '../Nodes/NodeInstance.js';
import { sleep } from '../utils/sleep.js';
import { Fiber, type FiberListenerInner } from './Fiber.js';
import {
  createDefaultNodeExecutionHandlers,
  type NodeExecutionHandler
} from './NodeExecutionHandler.js';
import { resolveSocketValue } from './resolveSocketValue.js';
import type { IRegistry } from '~/index.js';

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
  public readonly id: string;
  protected readonly graph: GraphInstance;
  protected readonly registry: IRegistry;
  protected fiberQueue: Fiber[] = [];
  public readonly asyncNodes: IAsyncNode[] = [];
  public readonly eventNodes: IEventNode[] = [];
  public readonly onNodeExecutionStart = new EventEmitter<INode>();
  public readonly onNodeExecutionEnd = new EventEmitter<INode>();
  public readonly onNodeExecutionError = new EventEmitter<NodeError>();
  public readonly onNodeCommit = new EventEmitter<NodeCommit>();
  public readonly nodes: GraphNodes;
  private disposed = false;
  private executionFailure?: { error: unknown };
  private readonly eventInitializations = new Map<IEventNode, Promise<void>>();
  private readonly nodeCleanups = new Map<INode, Promise<void>>();
  private initializingNodes = 0;
  get isDisposed(): boolean {
    return this.disposed;
  }
  private scheduledExecutionSteps = 0;
  private asyncOperationSequence = 0;
  private readonly pendingOperations = new Map<
    object,
    { operationId: string; node: IAsyncNode; invocationId?: string }
  >();
  private executionStartedAt?: number;
  private executionFinished = false;
  private disposal?: Promise<void>;
  private disposalOutcome?: InvocationOutcome;
  private disposalError?: unknown;

  /** Called by fibers so detached async completions also count as work. */
  accountExecutionSteps(count: number): void {
    this.executionSteps += count;
    this.scheduledExecutionSteps += count;
  }

  get pendingAsyncInvocations(): readonly {
    operationId: string;
    nodeId: string;
    invocationId?: string;
  }[] {
    return [...this.pendingOperations.values()].map(
      ({ operationId, node, invocationId }) => ({
        operationId,
        nodeId: node.id,
        invocationId
      })
    );
  }

  /** Each callback settles its own operation, even when a node overlaps itself. */
  trackAsyncInvocation(
    node: IAsyncNode,
    invocation?: InvocationContext
  ): () => boolean {
    if (this.disposed) return () => false;
    const token = {};
    this.pendingOperations.set(token, {
      operationId: this.id + ':async:' + ++this.asyncOperationSequence,
      node,
      invocationId: invocation?.invocationId
    });
    this.asyncNodes.push(node);
    return () => {
      if (!this.pendingOperations.delete(token)) return false;
      const index = this.asyncNodes.indexOf(node);
      if (index >= 0) this.asyncNodes.splice(index, 1);
      return true;
    };
  }

  /** Cancel every overlapping invocation of a removed node. */
  cancelNodeInvocations(node: INode): void {
    for (const [context, active] of this.invocations) {
      if (active.node === node) this.finishInvocation(context, 'cancelled');
    }
    for (const [token, active] of this.pendingOperations) {
      if (active.node === node) this.pendingOperations.delete(token);
    }
    for (let index = this.asyncNodes.length - 1; index >= 0; index--) {
      if (this.asyncNodes[index] === node) this.asyncNodes.splice(index, 1);
    }
  }

  private startExecution(): void {
    if (
      !this.observationOptions.onExecution ||
      this.executionStartedAt !== undefined ||
      this.executionFinished
    )
      return;
    this.executionStartedAt = performance.now();
    try {
      this.notifyObserver(this.observationOptions.onExecution, {
        kind: 'execution_started',
        executionId: this.id,
        graphName: this.graph.name,
        attributes: this.observationOptions.attributes,
        parent: this.observationOptions.parent,
        timestamp: Date.now(),
        sequence: ++this.observationSequence
      });
    } catch {
      /* Observers cannot affect execution. */
    }
  }

  private finishExecution(outcome: InvocationOutcome, error?: unknown): void {
    if (this.executionFinished) return;
    if (!this.observationOptions.onExecution) {
      this.executionFinished = true;
      return;
    }
    this.startExecution();
    this.executionFinished = true;
    try {
      this.notifyObserver(this.observationOptions.onExecution, {
        kind: 'execution_finished',
        executionId: this.id,
        graphName: this.graph.name,
        attributes: this.observationOptions.attributes,
        parent: this.observationOptions.parent,
        timestamp: Date.now(),
        sequence: ++this.observationSequence,
        outcome,
        error,
        durationMs: performance.now() - this.executionStartedAt!,
        executionSteps: this.executionSteps
      });
    } catch {
      /* Observers cannot affect execution. */
    }
  }
  private readonly asyncFailures: unknown[] = [];

  /** Report failures delivered by a detached async completion callback. */
  reportAsyncFailure(node: INode, error: unknown, emitLegacy = true): void {
    if (this.disposed) return;
    this.executionFailure ??= { error };
    this.asyncFailures.push(error);
    if (emitLegacy) this.onNodeExecutionError.emit({ node, error });
  }

  protected throwIfAsyncFailed(): void {
    if (this.asyncFailures.length > 0) throw this.asyncFailures.shift();
  }
  public executionSteps = 0;
  /**
   * Dispatch table mapping a node's `nodeType` to the handler that knows how to
   * trigger that kind within a fiber step. Seeded with the built-in Flow and
   * Async kinds; register additional kinds with
   * {@link Engine.registerNodeExecutionHandler}. This is the engine's
   * open/closed seam for custom execution semantics.
   */
  public readonly nodeExecutionHandlers: Map<string, NodeExecutionHandler> =
    createDefaultNodeExecutionHandlers();

  private invocationSequence = 0;
  private observationSequence = 0;
  private readonly invocations = new Map<
    InvocationContext,
    { node: INode; started: number }
  >();
  private initialization?: Promise<void>;
  public readonly observationOptions: ExecutionObserverOptions;

  constructor(
    graph: GraphInstance,
    registry: IRegistry,
    options: ExecutionObserverOptions = {}
  ) {
    this.observationOptions = { ...options };
    this.id = options.executionId ?? generateUuid();
    this.registry = registry;
    this.graph = graph;
    this.nodes = graph.nodes;
    // collect all event nodes
    Object.values(this.nodes).forEach((node) => {
      if (isEventNode(node)) {
        this.eventNodes.push(node);
      }
    });
    if (!options.deferInitialization) void this.initialize().catch(() => {});
  }

  /** Await before emitting lifecycle events; initialization failures propagate. */
  initialize(): Promise<void> {
    this.startExecution();
    if (this.disposed && !this.initialization) return Promise.resolve();
    return (this.initialization ??= this.initializeEvents());
  }

  private async initializeEvents(): Promise<void> {
    const results = await Promise.allSettled(
      this.eventNodes.map((node) => this.initializeEventNode(node))
    );
    const errors = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      .map((result) => result.reason as unknown);
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, 'Graph event initialization failed');
  }

  protected initializeEventNode(node: IEventNode): Promise<void> {
    const existing = this.eventInitializations.get(node);
    if (existing) return existing;
    this.initializingNodes++;
    const task = this.initializeEventNodeOnce(node).finally(() => {
      this.initializingNodes--;
    });
    this.eventInitializations.set(node, task);
    return task;
  }

  protected async initializeEventNodeOnce(node: IEventNode): Promise<void> {
    if (this.disposed) return;
    const invocation = this.beginInvocation(
      node,
      undefined,
      undefined,
      undefined,
      'initialization'
    );
    try {
      for (const socket of node.inputs) {
        Assert.mustBeTrue(socket.valueTypeName !== 'flow');
        this.executionSteps += await resolveSocketValue(
          this,
          socket,
          invocation
        );
      }
      if (this.disposed) return;
      this.observeInputs(invocation);
      await node.init(this, invocation);
      this.executionSteps++;
      this.finishInvocation(invocation);
    } catch (error) {
      this.finishInvocation(invocation, 'failed', error);
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  beginInvocation(
    node: INode,
    parent?: ExecutionParent,
    fiberId?: string,
    triggeringSocket?: string,
    phase: InvocationContext['phase'] = 'execution'
  ): InvocationContext | undefined {
    this.startExecution();
    if (this.disposed || !this.observationOptions.observer) return undefined;
    const context: InvocationContext = Object.freeze({
      executionId: this.id,
      invocationId: this.id + ':' + ++this.invocationSequence,
      nodeId: node.id,
      typeName: node.description.typeName,
      nodeType: node.nodeType,
      nodeLabel: node.label,
      parentInvocationId: parent?.invocationId,
      parentExecutionId: parent?.executionId,
      fiberId,
      triggeringSocket,
      phase,
      emit: (name: string, attributes?: Readonly<Record<string, unknown>>) => {
        if (this.invocations.has(context))
          this.observe(context, { kind: 'diagnostic', name, attributes });
      }
    });
    this.invocations.set(context, { node, started: performance.now() });
    this.observe(context, { kind: 'started' });
    return context;
  }

  private notifyObserver<T>(
    callback: ((event: T) => void) | undefined,
    event: T
  ): void {
    try {
      const result: unknown = callback?.(event);
      if (isThenable(result)) void Promise.resolve(result).catch(() => {});
    } catch {
      /* Observers cannot affect execution. */
    }
  }

  private observe(
    context: InvocationContext,
    event: InvocationObservation
  ): void {
    try {
      this.notifyObserver(this.observationOptions.observer, {
        ...event,
        context,
        timestamp: Date.now(),
        sequence: ++this.observationSequence
      });
    } catch {
      /* Observers cannot affect execution. */
    }
  }

  private snapshot(node: INode, sockets: INode['inputs']): SocketObservation[] {
    return sockets
      .filter((socket) => socket.valueTypeName !== 'flow')
      .map((socket) => {
        const record: SocketObservation = {
          name: socket.name,
          valueType: socket.valueTypeName,
          sources: socket.links.map((link) => ({
            nodeId: link.nodeId,
            socket: link.socketName
          }))
        };
        if (!this.observationOptions.captureValue) return record;
        try {
          return {
            ...record,
            value: this.observationOptions.captureValue(
              socket.value,
              socket,
              node
            )
          };
        } catch {
          return record;
        }
      });
  }

  observeInputs(context?: InvocationContext): void {
    if (!context) return;
    const active = this.invocations.get(context);
    if (active)
      this.observe(context, {
        kind: 'inputs',
        sockets: this.snapshot(active.node, active.node.inputs)
      });
  }

  finishInvocation(
    context?: InvocationContext,
    outcome: InvocationOutcome = 'completed',
    error?: unknown
  ): void {
    if (outcome === 'failed') this.executionFailure ??= { error };
    if (!context) return;
    const active = this.invocations.get(context);
    if (!active) return;
    this.invocations.delete(context);
    this.observe(context, {
      kind: 'finished',
      outcome,
      error,
      durationMs: performance.now() - active.started,
      sockets: this.snapshot(active.node, active.node.outputs)
    });
  }

  observeCommit(
    context: InvocationContext | undefined,
    node: INode,
    socket: string
  ): void {
    if (!context || !this.invocations.has(context)) return;
    this.observe(context, {
      kind: 'commit',
      socket,
      targets: (
        node.outputs.find((output) => output.name === socket)?.links ?? []
      ).map((link) => ({ nodeId: link.nodeId, socket: link.socketName }))
    });
  }

  dispose(): void {
    if (this.disposed) return;
    const outcome =
      this.disposalOutcome ??
      (this.executionFailure
        ? 'failed'
        : this.hasPending() || this.invocations.size > 0
          ? 'cancelled'
          : 'completed');
    this.disposed = true;
    this.disposalError ??= this.executionFailure?.error;
    for (const context of this.invocations.keys())
      this.finishInvocation(
        context,
        outcome === 'completed' ? 'cancelled' : outcome,
        this.disposalError
      );
    const asyncNodes = [
      ...new Set([
        ...this.asyncNodes,
        ...Object.values(this.nodes).filter(isAsyncNode)
      ])
    ];
    this.pendingOperations.clear();
    this.asyncNodes.length = 0;
    this.fiberQueue = [];
    for (const node of asyncNodes) this.cleanupNode(node);
    for (const node of this.eventNodes) this.cleanupNode(node);
    const cleanups = [...this.nodeCleanups.values()];
    this.disposal = Promise.allSettled(cleanups).then((results) => {
      const errors = results
        .filter(
          (result): result is PromiseRejectedResult =>
            result.status === 'rejected'
        )
        .map((result) => result.reason as unknown);
      if (errors.length > 0) {
        const error = new AggregateError(
          this.disposalError === undefined
            ? errors
            : [this.disposalError, ...errors],
          'Graph cleanup failed'
        );
        this.finishExecution('failed', error);
        throw error;
      }
      this.finishExecution(outcome, this.disposalError);
    });
    // Sync callers can ignore cleanup promises without unhandled rejections.
    void this.disposal.catch(() => {});
  }

  /** Reuse cleanup when a realtime node is removed before overall disposal. */
  protected cleanupNode(node: INode): Promise<void> {
    const existing = this.nodeCleanups.get(node);
    if (existing) return existing;
    const cleanup = async () => {
      if (isEventNode(node)) {
        await this.eventInitializations.get(node)?.catch(() => {});
        await node.dispose(this);
      } else if (isAsyncNode(node)) {
        await node.dispose();
      }
    };
    const task = cleanup();
    this.nodeCleanups.set(node, task);
    void task.catch(() => {});
    return task;
  }

  /** Await every cleanup; failures are aggregated after all resources are attempted. */
  async disposeAsync(
    outcome?: InvocationOutcome,
    error?: unknown
  ): Promise<void> {
    if (!this.disposed) {
      this.disposalOutcome = outcome;
      this.disposalError = error;
    }
    this.dispose();
    await this.disposal;
  }

  hasPending(): boolean {
    return (
      this.fiberQueue.length > 0 ||
      this.asyncNodes.length > 0 ||
      this.initializingNodes > 0
    );
  }

  /**
   * Factory for the fibers this engine schedules. Override in a subclass to
   * supply a custom {@link Fiber} variant (e.g. a suspendable fiber) without
   * reimplementing the surrounding scheduling logic. This is the seam that lets
   * the execution strategy vary independently of the engine.
   */
  protected makeFiber(
    nextEval: Link | null,
    fiberCompletedListener: FiberListenerInner = undefined,
    node: INode | undefined = undefined
  ): Fiber {
    return new Fiber(this, nextEval, fiberCompletedListener, node);
  }

  /**
   * Teach the engine how to execute a custom node kind. The `nodeType` must
   * match the `nodeType` discriminator on the node instances it should drive.
   */
  registerNodeExecutionHandler(
    nodeType: string,
    handler: NodeExecutionHandler
  ): void {
    this.nodeExecutionHandlers.set(nodeType, handler);
  }

  /**
   * Used to directly trigger a flow node outside of normal execution.
   */
  trigger(
    node: INode,
    inputSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined
  ): void {
    if (this.disposed) {
      return;
    }
    try {
      Assert.mustBeTrue(isEventNode(node) || isAsyncNode(node));

      const inputSocket = node.inputs.find(
        (socket) => socket.name === inputSocketName
      );

      if (!inputSocket) {
        throw new Error('input socket not found: ' + inputSocketName);
      }
      const fiber = this.makeFiber(
        new Link(node.id, inputSocket.name),
        fiberCompletedListener,
        node
      );

      this.fiberQueue.push(fiber);
    } catch (error) {
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    }
  }

  // asyncCommit
  commitToNewFiber(
    node: INode,
    outputFlowSocketName: string,
    fiberCompletedListener: FiberListenerInner = undefined,
    invocation?: InvocationContext
  ) {
    if (this.disposed) {
      return;
    }
    const activation = isEventNode(node)
      ? this.beginInvocation(node, invocation, undefined, undefined, 'event')
      : invocation;
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
      if (isEventNode(node)) this.observeInputs(activation);
      this.observeCommit(activation, node, outputFlowSocketName);
      if (outputSocket.links.length === 1) {
        const fiber = this.makeFiber(
          outputSocket.links[0] ?? null,
          fiberCompletedListener,
          node
        );
        if (this.onNodeCommit.listenerCount > 0) {
          this.onNodeCommit.emit({ node, socket: outputFlowSocketName });
        }

        fiber.parentInvocation = activation;
        this.fiberQueue.push(fiber);
      }
    } catch (error) {
      this.finishInvocation(activation, 'failed', error);
      this.onNodeExecutionError.emit({ node, error });
      throw error;
    } finally {
      if (isEventNode(node)) this.finishInvocation(activation);
    }
  }

  // NOTE: This does not execute all if there are promises.
  async executeAllSync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    await this.initialize();
    this.throwIfAsyncFailed();
    if (limitInSeconds <= 0 || limitInSteps <= 0) {
      return 0;
    }
    const startDateTime = Date.now();
    const limitInMs = limitInSeconds * 1000;
    let elapsedSteps = 0;
    // Date.now() per step is measurable at millions of steps/sec, so the time
    // limit is checked every TIME_CHECK_INTERVAL sync steps (and immediately
    // after any async step, since those dominate their own cost anyway).
    const TIME_CHECK_INTERVAL = 128;
    let stepsUntilTimeCheck = TIME_CHECK_INTERVAL;
    while (elapsedSteps < limitInSteps && this.fiberQueue.length > 0) {
      //Safe assertion as we know the queue length is >0
      const currentFiber = this.fiberQueue[0]!;
      const startingFiberExecutionSteps = currentFiber.executionSteps;
      // executeStep only returns a promise when the step actually performed
      // async work; skipping the await on the sync path avoids a microtask
      // per step, which dominates throughput on large graphs.
      const stepResult = currentFiber.executeStep();
      if (stepResult !== undefined) {
        await stepResult;
        stepsUntilTimeCheck = 0;
      }
      elapsedSteps += currentFiber.executionSteps - startingFiberExecutionSteps;
      if (currentFiber.isCompleted()) {
        this.fiberQueue.shift();
      }
      if (--stepsUntilTimeCheck <= 0) {
        stepsUntilTimeCheck = TIME_CHECK_INTERVAL;
        if (Date.now() - startDateTime >= limitInMs) {
          break;
        }
      }
    }
    return elapsedSteps;
  }

  /** Execute once with explicit budget outcomes. Legacy methods still return step counts. */
  async executeWithOutcome(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<EngineExecutionResult> {
    const startingSteps = this.scheduledExecutionSteps;
    let steps = 0;
    let error: unknown;
    let outcome: InvocationOutcome;
    try {
      steps = await this.executeAllAsync(limitInSeconds, limitInSteps);
      outcome = this.disposed
        ? 'cancelled'
        : !this.hasPending()
          ? 'completed'
          : steps >= limitInSteps
            ? 'step_limit'
            : 'timed_out';
    } catch (cause) {
      error = cause;
      outcome = this.disposed ? 'cancelled' : 'failed';
    }
    steps = this.scheduledExecutionSteps - startingSteps;
    const result = {
      outcome,
      error,
      executionSteps: steps,
      pendingFibers: this.fiberQueue.length,
      pendingAsyncNodes: this.asyncNodes.length
    };
    try {
      await this.disposeAsync(outcome, error);
    } catch (cleanupError) {
      return {
        ...result,
        outcome: 'failed',
        error:
          error === undefined
            ? cleanupError
            : new AggregateError(
                [error, cleanupError],
                'Graph execution and cleanup failed'
              )
      };
    }
    return result;
  }

  async executeAllAsync(
    limitInSeconds = 100,
    limitInSteps = 100000000
  ): Promise<number> {
    const startDateTime = Date.now();
    const startingSteps = this.scheduledExecutionSteps;
    let elapsedSteps = 0;
    let elapsedTime = 0;
    let iterations = 0;
    do {
      if (iterations > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(0);
      }
      await this.executeAllSync(
        limitInSeconds - elapsedTime,
        limitInSteps - elapsedSteps
      );

      elapsedSteps = this.scheduledExecutionSteps - startingSteps;
      this.throwIfAsyncFailed();
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
