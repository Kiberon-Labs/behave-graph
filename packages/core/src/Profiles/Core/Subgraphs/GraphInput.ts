import type { Engine } from '../../../engine/Engine.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import { EventNode2 } from '../../../Nodes/EventNode.js';
import type { NodeConfiguration } from '../../../Nodes/Node.js';
import {
  NodeDescription,
  NodeDescription2
} from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';
import { paramsToSockets, readParams } from './helpers.js';

/**
 * Boundary entry node for a subgraph. Its output sockets are the graph's
 * declared inputs (its `configuration.parameters`); a `flow` output starts the
 * subgraph. When invoked, the subgraph runner seeds these output sockets with
 * the caller's argument values and triggers the `flow` output. As a top-level
 * graph (run directly) it simply does nothing on startup.
 */
export class GraphInput extends EventNode2 {
  public static Description = new NodeDescription2({
    typeName: 'graph/input',
    category: 'Event',
    label: 'Graph Input',
    configuration: {
      parameters: {
        valueType: 'object',
        defaultValue: []
      }
    },
    factory: (description, graph, configuration, id) =>
      new GraphInput(description, graph, configuration, id)
  });

  constructor(
    description: NodeDescription,
    graph: IGraph,
    configuration: NodeConfiguration,
    id: string
  ) {
    super({
      description,
      graph,
      outputs: [
        new Socket('flow', 'flow'),
        ...paramsToSockets(readParams(configuration.parameters))
      ],
      configuration,
      id
    });
  }

  // Entry point is driven explicitly by the subgraph runner (Stage C); nothing
  // to register on startup.
  override init(_engine: Engine) {}

  override dispose(_engine: Engine) {}
}
