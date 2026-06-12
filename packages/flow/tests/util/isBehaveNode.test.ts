import { describe, expect, it } from 'vitest';
import { isBehaveNode } from '@/util/isBehaveNode';
import type { Node } from 'reactflow';

const node = (type: unknown): Node =>
  ({ id: 'n', position: { x: 0, y: 0 }, data: {}, type }) as Node;

describe('isBehaveNode', () => {
  it('returns true for node types starting with "behaveNode"', () => {
    expect(isBehaveNode(node('behaveNode'))).toBe(true);
    expect(isBehaveNode(node('behaveNode-flow'))).toBe(true);
  });

  it('returns false for other node types', () => {
    expect(isBehaveNode(node('comment'))).toBe(false);
    expect(isBehaveNode(node('group'))).toBe(false);
  });

  it('returns false when the type is missing', () => {
    expect(isBehaveNode(node(undefined))).toBe(false);
  });
});
