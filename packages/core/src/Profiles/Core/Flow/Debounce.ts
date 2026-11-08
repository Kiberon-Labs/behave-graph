import { AsyncNode } from '@/Nodes/AsyncNode.js';
import type { InvocationContext } from '../../../engine/ExecutionObserver.js';
import { Engine } from '../../../engine/Engine.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import { NodeDescription } from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';

// as long as this continues to be triggered within the duration period, it will not fire.
// based lousy on https://www.npmjs.com/package/debounce

export class Debounce extends AsyncNode {
  public static Description = new NodeDescription(
    'flow/debounce',
    'Flow',
    'Debounce',
    (description, graph, config, id) =>
      new Debounce(description, graph, config, id)
  );

  private initialState = {
    triggerVersion: 0
  };

  private readonly pending = new Set<() => void>();

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
        new Socket('float', 'waitDuration'),
        new Socket('flow', 'cancel')
      ],
      [new Socket('flow', 'flow')],
      config,
      id
    );

    this.setState(this.initialState);
  }

  override async triggered(
    engine: Engine,
    triggeringSocketName: string,
    finished: () => void,
    invocation?: InvocationContext
  ) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (!this.pending.delete(finish)) return;
      if (timeout !== undefined) clearTimeout(timeout);
      finished();
    };
    this.pending.add(finish);
    // State access is synchronous. Do not yield between reading and updating
    // the version: concurrent invocations must capture distinct versions.
    const state = this.getState();
    let newState = { ...state };

    newState.triggerVersion++;
    this.setState(newState);
    if (!this.pending.has(finish)) return;

    // if cancelling, just increment triggerVersion and do not set a timer. :)
    if (triggeringSocketName === 'cancel') {
      for (const complete of this.pending) complete();
      return;
    }

    const localTriggerCount = newState.triggerVersion;
    timeout = setTimeout(
      async () => {
        const currentState = await this.getState();
        if (!this.pending.has(finish)) return;
        if (currentState.triggerVersion !== localTriggerCount) {
          // ignore this timer, as it isn't for the most recent trigger
          finish();
          return;
        }

        engine.commitToNewFiber(this, 'flow', undefined, invocation);
        finish();
      },
      this.readInput<number>('waitDuration') * 1000
    );
  }

  override dispose() {
    const state = { ...this.getState() };
    state.triggerVersion++; // equivalent to 'cancel' trigger behavior.
    this.setState(state);
    for (const complete of this.pending) complete();
  }
}
