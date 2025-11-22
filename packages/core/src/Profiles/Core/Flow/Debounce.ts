import { AsyncNode } from '~/Nodes/AsyncNode.js';
import { Engine } from '../../../Execution/Engine.js';
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
    finished: () => void
  ) {
    const state = await this.getState();
    let newState = { ...state };

    newState.triggerVersion++;

    // if cancelling, just increment triggerVersion and do not set a timer. :)
    if (triggeringSocketName === 'cancel') {
      return;
    }

    const localTriggerCount = newState.triggerVersion;
    setTimeout(
      () => {
        if (newState.triggerVersion >= localTriggerCount) {
          // ignore this timer, as it isn't for the most recent trigger
          return;
        }

        engine.commitToNewFiber(this, 'flow');
        finished();
      },
      this.readInput<number>('waitDuration') * 1000
    );
    await this.setState(newState);
  }

  override async dispose() {
    const state = await this.getState();
    state.triggerVersion++; // equivalent to 'cancel' trigger behavior.
    await this.setState(state);
  }
}
