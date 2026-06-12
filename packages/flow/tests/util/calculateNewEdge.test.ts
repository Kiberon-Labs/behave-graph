import { describe, expect, it } from 'vitest';
import { calculateNewEdge } from '@/util/calculateNewEdge';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { Node, OnConnectStartParams } from 'reactflow';

const specJSON = [
  {
    type: 'source/node',
    inputs: [],
    outputs: [{ name: 'out', valueType: 'flow' }]
  },
  {
    type: 'target/node',
    inputs: [{ name: 'in', valueType: 'flow' }],
    outputs: []
  }
] as unknown as NodeSpecJSON[];

const originNode = { id: 'origin', type: 'source/node' } as Node;

describe('calculateNewEdge', () => {
  it('wires source -> target when dragging from a source handle', () => {
    const connection: OnConnectStartParams = {
      nodeId: 'origin',
      handleId: 'out',
      handleType: 'source'
    };

    const edge = calculateNewEdge(
      originNode,
      'target/node',
      'dest',
      connection,
      specJSON
    );

    expect(edge).toMatchObject({
      source: 'origin',
      sourceHandle: 'out',
      target: 'dest',
      targetHandle: 'in'
    });
    expect(typeof edge.id).toBe('string');
    expect(edge.id.length).toBeGreaterThan(0);
  });

  it('wires target -> source when dragging from a target handle', () => {
    const connection: OnConnectStartParams = {
      nodeId: 'origin',
      handleId: 'in',
      handleType: 'target'
    };
    const targetOrigin = { id: 'origin', type: 'target/node' } as Node;

    const edge = calculateNewEdge(
      targetOrigin,
      'source/node',
      'dest',
      connection,
      specJSON
    );

    expect(edge).toMatchObject({
      target: 'origin',
      targetHandle: 'in',
      source: 'dest',
      sourceHandle: 'out'
    });
  });

  it('matches the destination socket by value type', () => {
    const multiSpec = [
      {
        type: 'source/node',
        inputs: [],
        outputs: [{ name: 'out', valueType: 'string' }]
      },
      {
        type: 'target/node',
        inputs: [
          { name: 'flowIn', valueType: 'flow' },
          { name: 'strIn', valueType: 'string' }
        ],
        outputs: []
      }
    ] as unknown as NodeSpecJSON[];

    const edge = calculateNewEdge(
      originNode,
      'target/node',
      'dest',
      { nodeId: 'origin', handleId: 'out', handleType: 'source' },
      multiSpec
    );

    expect(edge.targetHandle).toBe('strIn');
  });
});
