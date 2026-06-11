import { useMemo } from 'react';
import type { SpanCollector } from '@/store/traces';
import type {
  DerivedData,
  LaneData,
  Tick,
  ViewState,
  VisualSpan
} from './types';
import { calculateTimeInterval, clamp, hashToHue } from './utils';

const MIN_WIDTH_PCT = 0.5;
const OVERLAP_EPSILON_PCT = 0.5;

const EMPTY: DerivedData = {
  now: 0,
  size: 0,
  lanes: 0,
  minStart: 0,
  maxEnd: 0,
  range: 1,
  viewStart: 0,
  viewEnd: 0,
  viewRange: 1,
  buckets: [],
  laneData: [],
  ticks: []
};

function computeTicks(
  viewStart: number,
  viewEnd: number,
  viewRange: number
): Tick[] {
  const interval = calculateTimeInterval(viewRange);
  const firstTick = Math.ceil(viewStart / interval) * interval;
  const ticks: Tick[] = [];
  for (let t = firstTick; t <= viewEnd; t += interval) {
    const leftPct = ((t - viewStart) / viewRange) * 100;
    if (leftPct >= 0 && leftPct <= 100) {
      ticks.push({ time: t, leftPct });
    }
  }
  return ticks;
}

export function useDerivedSpans(
  collector: SpanCollector,
  version: number,
  windowMs: number,
  view: ViewState
): DerivedData {
  return useMemo(() => {
    const now = performance.now();
    const { capacity, size, writeIndex, spans } = collector;

    if (size <= 0) return { ...EMPTY, now };

    let minStart = Number.POSITIVE_INFINITY;
    let maxEnd = Number.NEGATIVE_INFINITY;
    let maxLane = -1;

    const buckets: Array<import('@/store/traces').TraceSpan[]> = [];

    const startIndex = (writeIndex - size + capacity) % capacity;
    for (let i = 0; i < size; i++) {
      const idx = (startIndex + i) % capacity;
      const s = spans[idx];
      if (!s) continue;

      const end = Number.isNaN(s.end) ? now : s.end;
      minStart = Math.min(minStart, s.start);
      maxEnd = Math.max(maxEnd, end);
      maxLane = Math.max(maxLane, s.lane);

      (buckets[s.lane] ??= []).push(s);
    }

    if (
      !Number.isFinite(minStart) ||
      !Number.isFinite(maxEnd) ||
      maxEnd <= minStart
    ) {
      return {
        ...EMPTY,
        now,
        size,
        lanes: maxLane + 1,
        buckets,
        laneData: []
      };
    }

    const fullRange = Math.max(1, maxEnd - minStart);

    const desiredRange = windowMs <= 0 ? fullRange : Math.max(1, windowMs);
    const desiredStart = Math.max(minStart, maxEnd - desiredRange);

    const effectiveRange = clamp(
      view.follow ? desiredRange : view.range,
      1,
      fullRange
    );
    const effectiveStart = clamp(
      view.follow ? desiredStart : view.start,
      minStart,
      maxEnd - effectiveRange
    );

    const viewStart = effectiveStart;
    const viewEnd = viewStart + effectiveRange;
    const viewRange = effectiveRange;

    const laneData: LaneData[] = Array.from({ length: maxLane + 1 }, () => ({
      stackCount: 1,
      visualSpans: [] as VisualSpan[]
    }));

    for (let lane = 0; lane <= maxLane; lane++) {
      const laneSpans = buckets[lane];
      if (!laneSpans || laneSpans.length === 0) {
        laneData[lane] = { stackCount: 1, visualSpans: [] };
        continue;
      }

      const tmp: Array<{
        span: import('@/store/traces').TraceSpan;
        leftPct: number;
        widthPct: number;
        rightPct: number;
        durationMs: number;
      }> = [];

      for (const s of laneSpans) {
        const end = Number.isNaN(s.end) ? now : s.end;
        if (end < viewStart || s.start > viewEnd) continue;

        const visibleStart = Math.max(s.start, viewStart);
        const visibleEnd = Math.min(end, viewEnd);
        if (visibleEnd <= visibleStart) continue;

        const rawLeft = ((visibleStart - viewStart) / viewRange) * 100;
        const rawWidth = ((visibleEnd - visibleStart) / viewRange) * 100;
        const leftPct = clamp(rawLeft, 0, 100);
        const widthPct = clamp(
          Math.max(MIN_WIDTH_PCT, rawWidth),
          0,
          100 - leftPct
        );
        const rightPct = leftPct + widthPct;
        const durationMs = Math.max(0, end - s.start);

        tmp.push({ span: s, leftPct, widthPct, rightPct, durationMs });
      }

      tmp.sort((a, b) => a.leftPct - b.leftPct);

      const stackRight: number[] = [];
      const visualSpans: VisualSpan[] = [];

      for (const v of tmp) {
        let stack = 0;
        for (; stack < stackRight.length; stack++) {
          if (v.leftPct >= stackRight[stack]! + OVERLAP_EPSILON_PCT) break;
        }
        if (stack === stackRight.length) stackRight.push(v.rightPct);
        else stackRight[stack] = Math.max(stackRight[stack]!, v.rightPct);

        const hue = hashToHue(v.span.nodeId);
        const isOpen = Number.isNaN(v.span.end);
        const lightness = clamp(56 - stack * 7, 30, 60);
        const bg = isOpen
          ? `hsla(${hue}, 80%, ${clamp(lightness + 6, 30, 65)}%, 0.35)`
          : `hsla(${hue}, 80%, ${lightness}%, 0.6)`;
        const border = `hsla(${hue}, 90%, ${clamp(lightness + 22, 45, 80)}%, 0.95)`;

        visualSpans.push({
          span: v.span,
          leftPct: v.leftPct,
          widthPct: v.widthPct,
          rightPct: v.rightPct,
          durationMs: v.durationMs,
          stack,
          bg,
          border
        });
      }

      laneData[lane] = {
        stackCount: Math.max(1, stackRight.length),
        visualSpans
      };
    }

    const ticks = computeTicks(viewStart, viewEnd, viewRange);

    return {
      now,
      size,
      lanes: maxLane + 1,
      minStart,
      maxEnd,
      range: fullRange,
      viewStart,
      viewEnd,
      viewRange,
      buckets,
      laneData,
      ticks
    };
  }, [collector, version, windowMs, view.follow, view.range, view.start]);
}
