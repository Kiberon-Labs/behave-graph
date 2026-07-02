import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import { deriveContract } from '../src/transformers/contract.js';

const boundaryNode = (
  id: string,
  type: 'graph/input' | 'graph/output',
  parameters: Array<{ name: string; valueTypeName: string; defaultValue?: any }>
): Node => ({
  id,
  type: 'behaveNode',
  position: { x: 0, y: 0 },
  data: { type, configuration: { parameters }, ports: {} }
});

describe('graph contract derivation', () => {
  it('derives graphInputs/graphOutputs from boundary nodes', () => {
    const nodes: Node[] = [
      boundaryNode('in', 'graph/input', [
        { name: 'x', valueTypeName: 'float', defaultValue: 1 },
        { name: 'label', valueTypeName: 'string' }
      ]),
      boundaryNode('out', 'graph/output', [
        { name: 'y', valueTypeName: 'float' }
      ]),
      // a non-boundary node should be ignored
      {
        id: 'n',
        type: 'behaveNode',
        position: { x: 0, y: 0 },
        data: { type: 'debug/log', configuration: {}, ports: {} }
      }
    ];

    const { graphInputs, graphOutputs } = deriveContract(nodes);

    expect(graphInputs).toEqual([
      { key: 'x', valueType: 'float', defaultValue: 1, label: 'x' },
      { key: 'label', valueType: 'string', label: 'label' }
    ]);
    expect(graphOutputs).toEqual([
      { key: 'y', valueType: 'float', label: 'y' }
    ]);
  });

  it('returns empty contract when there are no boundary nodes', () => {
    const { graphInputs, graphOutputs } = deriveContract([]);
    expect(graphInputs).toEqual([]);
    expect(graphOutputs).toEqual([]);
  });
});
