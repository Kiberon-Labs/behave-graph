import {
  registerCoreProfile,
  type GraphJSON,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';

import rawFlowGraph from '../../../graphs/react-flow/graph.json';
import { behaveToFlow } from '../src/transformers/behaveToFlow.js';
import { flowToBehave } from '../src/transformers/flowToBehave.js';
import { it, expect } from 'vitest';
import { System } from '@/system/system';

const flowGraph = rawFlowGraph as GraphJSON;

const [nodes, edges] = behaveToFlow(flowGraph);

it('transforms from flow to behave', () => {
  const coreRegistry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {}
  });
  const specJSON = writeNodeSpecsToJSON(coreRegistry);
  const registry = {
    values: coreRegistry.values,
    specs: specJSON
  };
  const system = new System(registry);
  const session = system.createSession('graph');
  const output = flowToBehave(session, nodes, edges, specJSON);

  // Remove position metadata from expected graph since we no longer include it
  const expectedGraph = {
    ...flowGraph,
    nodes: flowGraph.nodes.map((node) => {
      const { metadata, ...rest } = node as any;
      if (metadata) {
        const { positionX, positionY, ...remainingMetadata } = metadata;
        return Object.keys(remainingMetadata).length > 0
          ? { ...rest, metadata: remainingMetadata }
          : rest;
      }
      return node;
    })
  };

  expect(output).toEqual(expectedGraph);
});
