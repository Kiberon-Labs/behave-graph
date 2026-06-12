import { describe, expect, it } from 'vitest';
import { getSocketsByNodeTypeAndHandleType } from '@/util/getSocketsByNodeTypeAndHandleType';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

const specs = [
  {
    type: 'math/add',
    inputs: [{ name: 'a', valueType: 'float' }],
    outputs: [{ name: 'result', valueType: 'float' }]
  }
] as unknown as NodeSpecJSON[];

describe('getSocketsByNodeTypeAndHandleType', () => {
  it('returns the output sockets for a source handle', () => {
    expect(
      getSocketsByNodeTypeAndHandleType(specs, 'math/add', 'source')
    ).toEqual([{ name: 'result', valueType: 'float' }]);
  });

  it('returns the input sockets for a target handle', () => {
    expect(
      getSocketsByNodeTypeAndHandleType(specs, 'math/add', 'target')
    ).toEqual([{ name: 'a', valueType: 'float' }]);
  });

  it('returns undefined for an unknown node type', () => {
    expect(
      getSocketsByNodeTypeAndHandleType(specs, 'does/not/exist', 'source')
    ).toBeUndefined();
  });
});
