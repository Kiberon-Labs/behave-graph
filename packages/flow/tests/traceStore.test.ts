import { describe, it, expect } from 'vitest';
import { traceStoreFactory } from '../src/store/traces.js';
import type { TraceSpan } from '../src/store/traces.js';

const newStore = () => traceStoreFactory({} as any).getState();

const usedLanes = (spans: TraceSpan[], size: number): Set<number> =>
  new Set(spans.slice(0, size).map((s) => s.lane));

describe('trace store lane allocation', () => {
  it('reuses a lane for sequential spans (closed before the next opens)', () => {
    const s = newStore();
    // A opens and closes, then B opens and closes , never overlapping.
    s.addSpan({ nodeId: 'a', name: 'a', start: 0, end: Number.NaN });
    s.updateSpan('a', { end: 1 });
    s.addSpan({ nodeId: 'b', name: 'b', start: 2, end: Number.NaN });
    s.updateSpan('b', { end: 3 });

    const c = s.collector;
    expect(c.size).toBe(2);
    // Both land in lane 0 → the panel shows a single lane.
    expect(usedLanes(c.spans, c.size)).toEqual(new Set([0]));
  });

  it('allocates separate lanes for concurrent (overlapping) spans', () => {
    const s = newStore();
    // Both open at once (no end between them) → must not share a lane.
    s.addSpan({ nodeId: 'a', name: 'a', start: 0, end: Number.NaN });
    s.addSpan({ nodeId: 'b', name: 'b', start: 0, end: Number.NaN });

    const c = s.collector;
    expect(c.size).toBe(2);
    expect(usedLanes(c.spans, c.size)).toEqual(new Set([0, 1]));
  });

  it('keeps an open span as open (NaN end) until updateSpan closes it', () => {
    const s = newStore();
    s.addSpan({ nodeId: 'a', name: 'a', start: 5, end: Number.NaN });

    const open = s.collector.spans[0]!;
    expect(Number.isNaN(open.end)).toBe(true);

    s.updateSpan('a', { end: 9 });
    expect(s.collector.spans[0]!.end).toBe(9);
  });
});
