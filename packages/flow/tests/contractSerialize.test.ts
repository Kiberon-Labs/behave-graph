import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import { flowToBehave } from '../src/transformers/flowToBehave.js';

const boundary = (
  id: string,
  type: 'graph/input' | 'graph/output',
  params: Array<{ name: string; valueTypeName: string }>
): Node => ({
  id,
  type: 'behaveNode',
  position: { x: 0, y: 0 },
  data: { type, configuration: { parameters: params }, ports: {} }
});

describe('contract serialization through flowToBehave', () => {
  it('emits graphInputs/graphOutputs derived from boundary nodes', () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {} as any
    });
    const specs = writeNodeSpecsToJSON(coreRegistry);
    const system = new System({ values: coreRegistry.values, specs });
    const session = system.createSession('graph');

    const nodes: Node[] = [
      boundary('in', 'graph/input', [{ name: 'x', valueTypeName: 'float' }]),
      boundary('out', 'graph/output', [{ name: 'y', valueTypeName: 'float' }])
    ];

    const graph = flowToBehave(session, nodes, [], specs);

    expect(graph.graphInputs).toEqual([
      { key: 'x', valueType: 'float', label: 'x' }
    ]);
    expect(graph.graphOutputs).toEqual([
      { key: 'y', valueType: 'float', label: 'y' }
    ]);
  });

  it('omits the contract when there are no boundary nodes', () => {
    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {} as any
    });
    const specs = writeNodeSpecsToJSON(coreRegistry);
    const system = new System({ values: coreRegistry.values, specs });
    const session = system.createSession('graph');

    const graph = flowToBehave(session, [], [], specs);

    expect(graph.graphInputs).toBeUndefined();
    expect(graph.graphOutputs).toBeUndefined();
  });
});
