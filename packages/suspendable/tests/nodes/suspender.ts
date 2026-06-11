import {
  AsyncNode,
  NodeDescription,
  NodeDescription2,
  Socket,
  type IGraph
} from '@kiberon-labs/behave-graph';
import type { IAsyncSuspendable } from '~/types';

export class Suspender extends AsyncNode implements IAsyncSuspendable {
  public static Description = new NodeDescription2({
    typeName: 'Suspender',
    category: 'Testing',
    factory: (description, graph) => new Suspender(description, graph)
  });

  constructor(description: NodeDescription, graph: IGraph) {
    super(
      description,
      graph,
      [new Socket('flow', 'flow')],
      [new Socket('flow', 'flow')]
    );
  }

  suspend() {
    return {};
  }
  async unsuspend(): Promise<void> {}
  hydrate(): void {}
}
