import { useMemo } from 'react';
import type { SpanCollector } from '@/store/traces';
import type {
  DerivedData,
  LaneData,
  Tick,
  ViewState,
  VisualSpan
} from './types';
import {
  calculateTimeInterval,
  clamp,
  hashToHue,
  MAX_ZOOM_OUT_FACTOR
} from './utils';

const MIN_WIDTH_PCT = 0.5;
const OVERLAP_EPSILON_PCT = 0.5;

/**
 * Minimum *visual* span length (ms). Instant nodes record start === end (0ms),
 * which otherwise collapses the range (maxEnd <= minStart) and renders nothing.
 * The true duration is still reported to the tooltip.
 */
const MIN_SPAN_MS = 1;

/** Effective end used for layout: clamps instant/zero-length spans to MIN_SPAN_MS. */
const visualEnd = (start: number, rawEnd: number): number =>
  Math.max(rawEnd, start + MIN_SPAN_MS);

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
  viewRange: number,
  origin: number
): Tick[] {
  const interval = calculateTimeInterval(viewRange);
  const firstTick = Math.ceil(viewStart / interval) * interval;
  const ticks: Tick[] = [];
  for (let t = firstTick; t <= viewEnd; t += interval) {
    const leftPct = ((t - viewStart) / viewRange) * 100;
    if (leftPct >= 0 && leftPct <= 100) {
      // Position uses absolute time; the label is relative to the trace origin
      // (first span) so it reads 0ms… instead of the raw clock value.
      ticks.push({ time: t - origin, leftPct });
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
  return useMemo(
    () => computeDerivedSpans(collector, windowMs, view),
    [collector, version, windowMs, view.follow, view.range, view.start]
  );
}

/**
 * Pure span → layout derivation used by {@link useDerivedSpans}. Exported so the
 * layout math (lane assignment, min-span visibility, ticks, zoom clamping) can be
 * unit-tested without a React render.
 */
type TraceSpan = import('@/store/traces').TraceSpan;

interface SpanScan {
  minStart: number;
  maxEnd: number;
  maxLane: number;
  buckets: TraceSpan[][];
}

/** Walk the ring buffer newest-window-first, bucketing spans by lane and
 * tracking the overall time/lane bounds. */
function scanSpans(collector: SpanCollector, now: number): SpanScan {
  const { capacity, size, writeIndex, spans } = collector;
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  let maxLane = -1;
  const buckets: TraceSpan[][] = [];

  const startIndex = (writeIndex - size + capacity) % capacity;
  for (let i = 0; i < size; i++) {
    const idx = (startIndex + i) % capacity;
    const s = spans[idx];
    if (!s) continue;

    const rawEnd = Number.isNaN(s.end) ? now : s.end;
    const end = visualEnd(s.start, rawEnd);
    minStart = Math.min(minStart, s.start);
    maxEnd = Math.max(maxEnd, end);
    maxLane = Math.max(maxLane, s.lane);

    (buckets[s.lane] ??= []).push(s);
  }

  return { minStart, maxEnd, maxLane, buckets };
}

interface ViewWindow {
  viewStart: number;
  viewEnd: number;
  viewRange: number;
}

/** Resolve the visible time window from the data bounds, the follow/zoom mode,
 * and the requested window size. */
function resolveViewWindow(
  scan: SpanScan,
  fullRange: number,
  windowMs: number,
  view: ViewState
): ViewWindow {
  const { minStart, maxEnd } = scan;
  const desiredRange = windowMs <= 0 ? fullRange : Math.max(1, windowMs);
  const desiredStart = Math.max(minStart, maxEnd - desiredRange);

  // Following snaps to the data range; manual zoom may pull back past the data
  // extent (up to MAX_ZOOM_OUT_FACTOR×) so short traces aren't un-zoom-out-able.
  const viewRange = clamp(
    view.follow ? desiredRange : view.range,
    1,
    view.follow ? fullRange : fullRange * MAX_ZOOM_OUT_FACTOR
  );
  const viewStart = clamp(
    view.follow ? desiredStart : view.start,
    minStart,
    maxEnd - viewRange
  );

  return { viewStart, viewEnd: viewStart + viewRange, viewRange };
}

type PlacedSpan = {
  span: TraceSpan;
  leftPct: number;
  widthPct: number;
  rightPct: number;
  durationMs: number;
};

/** Project a single span onto the view window, or null if it falls outside. */
function placeSpan(
  s: TraceSpan,
  now: number,
  win: ViewWindow
): PlacedSpan | null {
  const { viewStart, viewEnd, viewRange } = win;
  const rawEnd = Number.isNaN(s.end) ? now : s.end;
  const end = visualEnd(s.start, rawEnd);
  if (end < viewStart || s.start > viewEnd) return null;

  const visibleStart = Math.max(s.start, viewStart);
  const visibleEnd = Math.min(end, viewEnd);
  if (visibleEnd <= visibleStart) return null;

  const rawLeft = ((visibleStart - viewStart) / viewRange) * 100;
  const rawWidth = ((visibleEnd - visibleStart) / viewRange) * 100;
  const leftPct = clamp(rawLeft, 0, 100);
  const widthPct = clamp(Math.max(MIN_WIDTH_PCT, rawWidth), 0, 100 - leftPct);
  const rightPct = leftPct + widthPct;
  // Report the true duration (0ms for instant nodes), not the padded one.
  const durationMs = Math.max(0, rawEnd - s.start);

  return { span: s, leftPct, widthPct, rightPct, durationMs };
}

/** Pack a placed span into the lowest stack row that has cleared its left edge,
 * returning the chosen stack index and updating `stackRight` in place. */
function assignStack(placed: PlacedSpan, stackRight: number[]): number {
  let stack = 0;
  for (; stack < stackRight.length; stack++) {
    if (placed.leftPct >= stackRight[stack]! + OVERLAP_EPSILON_PCT) break;
  }
  if (stack === stackRight.length) stackRight.push(placed.rightPct);
  else stackRight[stack] = Math.max(stackRight[stack]!, placed.rightPct);
  return stack;
}

/** Build the fill/border colours for a span at a given stack depth. */
function spanColors(
  span: TraceSpan,
  stack: number
): { bg: string; border: string } {
  const hue = hashToHue(span.nodeId);
  const isOpen = Number.isNaN(span.end);
  const lightness = clamp(56 - stack * 7, 30, 60);
  const bg = isOpen
    ? `hsla(${hue}, 80%, ${clamp(lightness + 6, 30, 65)}%, 0.35)`
    : `hsla(${hue}, 80%, ${lightness}%, 0.6)`;
  const border = `hsla(${hue}, 90%, ${clamp(lightness + 22, 45, 80)}%, 0.95)`;
  return { bg, border };
}

/** Lay out one lane's spans into stacked, coloured visual spans. */
function buildLaneData(
  laneSpans: TraceSpan[] | undefined,
  now: number,
  win: ViewWindow
): LaneData {
  if (!laneSpans || laneSpans.length === 0) {
    return { stackCount: 1, visualSpans: [] };
  }

  const placed: PlacedSpan[] = [];
  for (const s of laneSpans) {
    const p = placeSpan(s, now, win);
    if (p) placed.push(p);
  }
  placed.sort((a, b) => a.leftPct - b.leftPct);

  const stackRight: number[] = [];
  const visualSpans: VisualSpan[] = [];
  for (const v of placed) {
    const stack = assignStack(v, stackRight);
    const { bg, border } = spanColors(v.span, stack);
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

  return { stackCount: Math.max(1, stackRight.length), visualSpans };
}

export function computeDerivedSpans(
  collector: SpanCollector,
  windowMs: number,
  view: ViewState
): DerivedData {
  const now = performance.now();

  if (collector.size <= 0) return { ...EMPTY, now };

  const scan = scanSpans(collector, now);
  const { minStart, maxEnd, maxLane, buckets } = scan;
  const { size } = collector;

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
  const win = resolveViewWindow(scan, fullRange, windowMs, view);

  const laneData: LaneData[] = Array.from({ length: maxLane + 1 }, (_, lane) =>
    buildLaneData(buckets[lane], now, win)
  );

  const ticks = computeTicks(
    win.viewStart,
    win.viewEnd,
    win.viewRange,
    minStart
  );

  return {
    now,
    size,
    lanes: maxLane + 1,
    minStart,
    maxEnd,
    range: fullRange,
    viewStart: win.viewStart,
    viewEnd: win.viewEnd,
    viewRange: win.viewRange,
    buckets,
    laneData,
    ticks
  };
}
