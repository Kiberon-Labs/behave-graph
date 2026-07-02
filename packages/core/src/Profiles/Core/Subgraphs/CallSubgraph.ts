import { AsyncNode } from '../../../Nodes/AsyncNode.js';
import type { Engine } from '../../../engine/Engine.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import type { NodeConfiguration } from '../../../Nodes/Node.js';
import {
  NodeDescription,
  NodeDescription2
} from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';
import { paramsToSockets, readParams, paramSocketId } from './helpers.js';

/**
 * Invokes another graph (referenced by `configuration.subgraphId`).
 *
 * Its input sockets are the subgraph's contract inputs and its value output
 * sockets are the contract outputs (both copied into this node's configuration
 * by the editor). It always exposes two flow outputs: `started` fires
 * immediately when invoked, and `completed` fires once the child finishes (with
 * the outputs written). Wire `completed` for a synchronous "wait for result"
 * call; wire `started` (and optionally `completed`) for fire-and-continue.
 */
export class CallSubgraph extends AsyncNode {
  public static Description = new NodeDescription2({
    typeName: 'flow/callSubgraph',
    category: 'Flow',
    label: 'Call Subgraph',
    configuration: {
      subgraphId: { valueType: 'string', defaultValue: '' },
      inputs: { valueType: 'object', defaultValue: [] },
      outputs: { valueType: 'object', defaultValue: [] }
    },
    factory: (description, graph, configuration, id) =>
      new CallSubgraph(description, graph, configuration, id)
  });

  constructor(
    description: NodeDescription,
    graph: IGraph,
    configuration: NodeConfiguration,
    id: string
  ) {
    super(
      description,
      graph,
      [
        new Socket('flow', 'flow'),
        ...paramsToSockets(readParams(configuration.inputs))
      ],
      [
        new Socket('flow', 'started'),
        new Socket('flow', 'completed'),
        ...paramsToSockets(readParams(configuration.outputs))
      ],
      configuration,
      id
    );
  }

  override triggered(
    engine: Engine,
    _triggeringSocketName: string,
    finished: () => void
  ) {
    const api = this.graph.getDependency('IGraphApi', true);
    const subgraphId = String(this.configuration.subgraphId ?? '');

    // Gather the caller's argument values keyed by contract input id.
    const inputs: Record<string, any> = {};
    for (const param of readParams(this.configuration.inputs)) {
      const id = paramSocketId(param);
      inputs[id] = this.readInput(id);
    }

    // Fire `started` immediately for fire-and-continue callers.
    engine.commitToNewFiber(this, 'started');

    const complete = (outputs: Record<string, any>) => {
      for (const param of readParams(this.configuration.outputs)) {
        const id = paramSocketId(param);
        if (id in outputs) {
          this.writeOutput(id, outputs[id]);
        } else {
          // The child didn't produce this output (e.g. a cyclic call was
          // refused) , fall back to the value type's default so downstream
          // nodes get a well-typed value rather than undefined.
          const creator = this.graph.values[param.valueTypeName]?.creator;
          this.writeOutput(id, creator ? creator() : undefined);
        }
      }
      engine.commitToNewFiber(this, 'completed');
      finished();
    };

    if (!api || !subgraphId) {
      // No resolver or no target , complete with default outputs.
      complete({});
      return;
    }

    api.runGraph(subgraphId, inputs).then(complete);
  }
}
