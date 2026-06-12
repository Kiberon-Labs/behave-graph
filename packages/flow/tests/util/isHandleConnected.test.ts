import { describe, expect, it } from 'vitest';
import { isHandleConnected } from '@/util/isHandleConnected';
import type { Edge } from 'reactflow';

const edge = (over: Partial<Edge>): Edge =>
  ({ id: 'e', source: 's', target: 't', ...over }) as Edge;

describe('isHandleConnected', () => {
  const edges: Edge[] = [
    edge({ source: 'n1', sourceHandle: 'out', target: 'n2', targetHandle: 'in' })
  ];

  it('detects a connected source handle', () => {
    expect(isHandleConnected(edges, 'n1', 'out', 'source')).toBe(true);
  });

  it('detects a connected target handle', () => {
    expect(isHandleConnected(edges, 'n2', 'in', 'target')).toBe(true);
  });

  it('returns false when the node id does not match', () => {
    expect(isHandleConnected(edges, 'other', 'out', 'source')).toBe(false);
  });

  it('returns false when the handle id does not match', () => {
    expect(isHandleConnected(edges, 'n1', 'wrong', 'source')).toBe(false);
  });

  it('returns false for an empty edge list', () => {
    expect(isHandleConnected([], 'n1', 'out', 'source')).toBe(false);
  });
});
