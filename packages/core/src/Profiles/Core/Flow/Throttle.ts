import { Assert } from '../../../Diagnostics/Assert.js';
import type { InvocationContext } from '../../../engine/ExecutionObserver.js';
import type { Engine } from '../../../engine/Engine.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import { AsyncNode } from '../../../Nodes/AsyncNode.js';
import { NodeDescription } from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';

// based on the description here: https://blog.webdevsimplified.com/2022-03/debounce-vs-throttle/

export class Throttle extends AsyncNode {
  public static Description = new NodeDescription(
    'flow/throttle',
    'Flow',
    'Throttle',
    (description, graph, config, id) =>
      new Throttle(description, graph, config, id)
  );

  constructor(
    description: NodeDescription,
    graph: IGraph,
    config: Record<string, unknown>,
    id: string
  ) {
    super(
      description,
      graph,
      [
        new Socket('flow', 'flow'),
        new Socket('float', 'duration', 1),
        new Socket('flow', 'cancel')
      ],
      [new Socket('flow', 'flow')],
      config,
      id
    );
  }

  private triggerVersion = 0;
  private timeoutPending = false;
  private pending:
    | { timeout: ReturnType<typeof setTimeout>; finish: () => void }
    | undefined;

  private cancelPending() {
    const pending = this.pending;
    this.pending = undefined;
    if (pending) {
      clearTimeout(pending.timeout);
      pending.finish();
    }
  }

  override triggered(
    engine: Engine,
    triggeringSocketName: string,
    finished: () => void,
    invocation?: InvocationContext
  ) {
    // if cancelling, just increment triggerVersion and do not set a timer. :)
    if (triggeringSocketName === 'cancel') {
      if (this.timeoutPending) {
        this.triggerVersion++;
        this.timeoutPending = false;
      }
      this.cancelPending();
      finished();
      return;
    }

    // if there is a valid timeout running, leave it.
    if (this.timeoutPending) {
      // Suppression does not transfer completion ownership to the first
      // invocation: settle this one without scheduling another output.
      finished();
      return;
    }

    // otherwise start it.
    this.triggerVersion++;
    const localTriggerCount = this.triggerVersion;
    this.timeoutPending = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      finished();
    };
    const timeout = setTimeout(
      () => {
        if (this.triggerVersion !== localTriggerCount) {
          finish();
          return;
        }
        Assert.mustBeTrue(this.timeoutPending);
        this.timeoutPending = false;
        this.pending = undefined;
        engine.commitToNewFiber(this, 'flow', undefined, invocation);
        finish();
      },
      this.readInput<number>('duration') * 1000
    );
    this.pending = { timeout, finish };
  }

  override dispose() {
    this.triggerVersion++; // equivalent to 'cancel' trigger behavior.
    this.timeoutPending = false;
    this.cancelPending();
  }
}
