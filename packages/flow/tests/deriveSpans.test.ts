import { describe, it, expect } from 'vitest';
import type { SpanCollector, TraceSpan } from '../src/store/traces.js';
import { computeDerivedSpans } from '../src/components/panels/traces/useDerivedSpans.js';
import type { ViewState } from '../src/components/panels/traces/types.js';

const FOLLOW: ViewState = { start: 0, range: 5000, follow: true };

/** Minimal collector holding the given spans (lane defaults to 0). */
const collectorOf = (spans: TraceSpan[]): SpanCollector => ({
  capacity: 16,
  spans,
  writeIndex: spans.length,
  size: spans.length,
  nextId: spans.length + 1,
  openByNodeId: new Map(),
  laneOpen: []
});

const span = (over: Partial<TraceSpan>): TraceSpan => ({
  id: 1,
  nodeId: 'n',
  name: 'n',
  start: 0,
  end: 0,
  lane: 0,
  ...over
});

describe('computeDerivedSpans , instant span visibility', () => {
  it('renders an instant (start === end) span instead of collapsing to nothing', () => {
    // A node that executes in 0ms: start === end. Previously maxEnd <= minStart
    // made the derivation bail and render no lanes.
    const derived = computeDerivedSpans(
      collectorOf([span({ start: 0, end: 0 })]),
      5000,
      FOLLOW
    );

    expect(derived.size).toBe(1);
    expect(derived.laneData).toHaveLength(1);
    const visuals = derived.laneData[0]!.visualSpans;
    expect(visuals).toHaveLength(1);
    // It has real, clickable width…
    expect(visuals[0]!.widthPct).toBeGreaterThan(0);
    // …but its reported duration is still the true 0ms.
    expect(visuals[0]!.durationMs).toBe(0);
  });

  it('reports the true duration for a normal span and keeps it visible', () => {
    const derived = computeDerivedSpans(
      collectorOf([span({ start: 2, end: 7 })]),
      5000,
      FOLLOW
    );
    const v = derived.laneData[0]!.visualSpans[0]!;
    expect(v.durationMs).toBe(5);
    expect(v.widthPct).toBeGreaterThan(0);
  });

  it('labels ticks relative to the first span, not the raw clock', () => {
    // Start at a large absolute time (as performance.now() produces); the first
    // tick label should be relative (~0), not the absolute value.
    const derived = computeDerivedSpans(
      collectorOf([span({ start: 1_000_000, end: 1_000_010 })]),
      0, // window 0 ⇒ fit all
      FOLLOW
    );
    expect(derived.ticks.length).toBeGreaterThan(0);
    expect(derived.ticks[0]!.time).toBeLessThan(1000);
  });
});
