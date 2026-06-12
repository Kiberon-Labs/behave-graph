import { describe, expect, it } from 'vitest';
import { hasPositionMetaData } from '@/util/hasPositionMetaData';
import type { GraphJSON } from '@kiberon-labs/behave-graph';

const graph = (nodes: unknown): GraphJSON => ({ nodes }) as GraphJSON;

describe('hasPositionMetaData', () => {
  it('returns true when any node carries position metadata', () => {
    expect(
      hasPositionMetaData(
        graph([
          { type: 'a', id: '1' },
          { type: 'b', id: '2', metadata: { positionX: '10', positionY: '20' } }
        ])
      )
    ).toBe(true);
  });

  it('returns false when no node carries position metadata', () => {
    expect(
      hasPositionMetaData(
        graph([
          { type: 'a', id: '1' },
          { type: 'b', id: '2', metadata: { label: 'hi' } }
        ])
      )
    ).toBe(false);
  });

  it('returns false when there are no nodes', () => {
    expect(hasPositionMetaData(graph(undefined))).toBe(false);
  });
});
