import type { Fiber } from '../../../engine/Fiber.js';
import type { IGraph } from '../../../Graphs/Graph.js';
import { FlowNode2 } from '../../../Nodes/FlowNode.js';
import type { NodeConfiguration } from '../../../Nodes/Node.js';
import {
  NodeDescription,
  NodeDescription2
} from '../../../Nodes/Registry/NodeDescription.js';
import { Socket } from '../../../Sockets/Socket.js';
import { paramsToSockets, readParams, paramSocketId } from './helpers.js';

/**
 * Boundary exit node for a subgraph. Its input sockets are the graph's declared
 * outputs (its `configuration.parameters`) plus a `flow` input. When triggered,
 * it records its input values as the subgraph's results via the per-run
 * collector dependency (`ISubgraphRun`, injected by the subgraph runner in
 * Stage C). Run directly as a top-level graph it is a no-op terminator.
 */
export class GraphOutput extends FlowNode2 {
  public static Description = new NodeDescription2({
    typeName: 'graph/output',
    category: 'Action',
    label: 'Graph Output',
    configuration: {
      parameters: {
        valueType: 'object',
        defaultValue: []
      }
    },
    factory: (description, graph, configuration, id) =>
      new GraphOutput(description, graph, configuration, id)
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
      inputs: [
        new Socket('flow', 'flow'),
        ...paramsToSockets(readParams(configuration.parameters))
      ],
      outputs: [],
      configuration,
      id
    });
  }

  override triggered(_fiber: Fiber, _triggeringSocketName: string) {
    const run = this.graph.getDependency('ISubgraphRun', true);
    if (!run) return; // top-level execution: nothing to capture
    for (const param of readParams(this.configuration.parameters)) {
      const id = paramSocketId(param);
      run.setOutput(id, this.readInput(id));
    }
    // Reaching an output boundary is the subgraph's "return".
    run.done();
  }
}
