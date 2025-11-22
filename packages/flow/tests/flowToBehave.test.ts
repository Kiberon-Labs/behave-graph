import {
  registerCoreProfile,
  type GraphJSON,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';

import rawFlowGraph from '../../../graphs/react-flow/graph.json';
import { behaveToFlow } from '../src/transformers/behaveToFlow.js';
import { flowToBehave } from '../src/transformers/flowToBehave.js';
import { it, expect } from 'vitest';

const flowGraph = rawFlowGraph as GraphJSON;

const [nodes, edges] = behaveToFlow(flowGraph);

it('transforms from flow to behave', () => {
  const registry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {}
  });
  const specJSON = writeNodeSpecsToJSON(registry);
  const output = flowToBehave(nodes, edges, specJSON);
  expect(output).toEqual(flowGraph);
});
