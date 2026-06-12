import {
  AsyncNode,
  FlowNode,
  NodeDescription,
  Socket,
  type Engine,
  type Fiber,
  type IGraph,
  type NodeConfiguration
} from '@kiberon-labs/behave-graph';
import type { SuspendableEngine } from '../../src/engine';
import type { IAsyncSuspendable, ISuspendable } from '../../src/types';

export type SuspendedLoopState = {
  nextIndex: number | null;
};

/**
 * A for-loop flow node that can survive a suspension round-trip.
 *
 * Unlike the core `flow/forLoop` (which keeps its cursor in closures on the
 * fiber's listener stack and therefore restarts when rehydrated), this node
 * tracks the next iteration index on the instance. `suspend()` captures it and
 * `hydrate()` restores it, so a re-trigger after unsuspension continues from
 * where the loop left off instead of `startIndex`.
 */
export class SuspendableForLoop
  extends FlowNode
  implements ISuspendable<SuspendedLoopState>
{
  public static Description = new NodeDescription(
    'flow/suspendableForLoop',
    'Flow',
    'Suspendable For Loop',
    (description, graph, config, id) =>
      new SuspendableForLoop(description, graph, config, id)
  );

  private nextIndex: number | null = null;

  constructor(
    description: NodeDescription,
    graph: IGraph,
    config: NodeConfiguration,
    id: string
  ) {
    super(
      description,
      graph,
      [
        new Socket('flow', 'flow'),
        new Socket('integer', 'startIndex'),
        new Socket('integer', 'endIndex')
      ],
      [
        new Socket('flow', 'loopBody'),
        new Socket('integer', 'index'),
        new Socket('flow', 'completed')
      ],
      config,
      id
    );
  }

  suspend(): SuspendedLoopState {
    return { nextIndex: this.nextIndex };
  }

  hydrate(data: SuspendedLoopState): void {
    this.nextIndex = data.nextIndex;
  }

  override triggered(fiber: Fiber, _triggeringSocketName: string) {
    const endIndex = Number(this.readInput('endIndex'));

    // fresh run starts at startIndex; a hydrated run resumes mid-loop
    if (this.nextIndex === null) {
      this.nextIndex = Number(this.readInput('startIndex'));
    }

    const iterate = () => {
      if (this.nextIndex !== null && this.nextIndex < endIndex) {
        this.writeOutput('index', BigInt(this.nextIndex));
        this.nextIndex++;
        fiber.commit(this, 'loopBody', () => {
          iterate();
        });
      } else {
        this.nextIndex = null;
        fiber.commit(this, 'completed');
      }
    };
    iterate();
  }
}

export type SuspendedWaitState = {
  waiting: boolean;
};

/**
 * An async node that parks the fiber on a pending promise until externally
 * signalled — the asynchronous counterpart to a flow node. Unlike flow nodes
 * (which resume by re-triggering with restored state), an async node is
 * resumed through `fiber.continue()` -> `unsuspend(continuanceData)`, which
 * delivers the awaited data and commits the downstream flow.
 *
 * After being signalled once (via unsuspension), subsequent triggers pass
 * straight through so resumed graphs can run to completion.
 */
export class WaitForSignal
  extends AsyncNode
  implements IAsyncSuspendable<unknown, SuspendedWaitState>
{
  public static Description = new NodeDescription(
    'test/waitForSignal',
    'Flow',
    'Wait For Signal',
    (description, graph, config, id) =>
      new WaitForSignal(description, graph, config, id)
  );

  private waiting = false;
  private signalled = false;
  private notifyParked: (() => void) | undefined;

  /** Resolves when the node has parked the fiber. */
  public readonly parked: Promise<void>;

  constructor(
    description: NodeDescription,
    graph: IGraph,
    config: NodeConfiguration,
    id: string
  ) {
    super(
      description,
      graph,
      [new Socket('flow', 'flow')],
      [new Socket('flow', 'flow'), new Socket('integer', 'value')],
      config,
      id
    );
    this.parked = new Promise((resolve) => {
      this.notifyParked = resolve;
    });
  }

  override triggered(
    engine: Engine,
    _triggeringSocketName: string,
    finished: () => void
  ) {
    if (this.signalled) {
      // already received its signal in a previous (suspended) life
      this.writeOutput('value', BigInt(-1));
      engine.commitToNewFiber(this, 'flow');
      finished();
      return;
    }

    this.waiting = true;
    this.notifyParked?.();
    // park the fiber until the engine is suspended (the promise never
    // resolves; the suspension snapshot captures this node as the resume point)
    return new Promise<void>(() => {});
  }

  suspend(): SuspendedWaitState {
    return { waiting: this.waiting };
  }

  hydrate(data: SuspendedWaitState): void {
    this.waiting = data.waiting;
  }

  async unsuspend(
    data: unknown,
    engine: SuspendableEngine,
    _triggeringSocketName: string,
    cb: () => void
  ): Promise<void> {
    this.waiting = false;
    this.signalled = true;
    this.writeOutput('value', BigInt(data as number));
    engine.commitToNewFiber(this, 'flow');
    cb();
  }

  override dispose() {
    this.waiting = false;
  }
}

/**
 * A flow node that reports each visited iteration index to the test. The
 * factory closes over the callback so each test gets an isolated recorder.
 */
export const makeRecorderDescription = (record: (index: number) => void) =>
  new NodeDescription(
    'test/recorder',
    'Action',
    'Recorder',
    (description, graph, config, id) =>
      new (class extends FlowNode {
        constructor() {
          super(
            description,
            graph,
            [new Socket('flow', 'flow'), new Socket('integer', 'index')],
            [new Socket('flow', 'flow')],
            config,
            id
          );
        }

        override triggered(fiber: Fiber, _socketName: string) {
          record(Number(this.readInput('index')));
          fiber.commit(this, 'flow');
        }
      })()
  );
