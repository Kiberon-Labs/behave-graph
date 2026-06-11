import type { TraceSpan } from '@/store/traces';

export type VisualSpan = {
  span: TraceSpan;
  leftPct: number;
  widthPct: number;
  rightPct: number;
  stack: number;
  durationMs: number;
  bg: string;
  border: string;
};

export type LaneData = {
  stackCount: number;
  visualSpans: VisualSpan[];
};

export type HoverInfo = {
  span?: TraceSpan;
  durationMs?: number;
};

export type ViewState = {
  start: number;
  range: number;
  follow: boolean;
};

export type DerivedData = {
  now: number;
  size: number;
  lanes: number;
  minStart: number;
  maxEnd: number;
  range: number;
  viewStart: number;
  viewEnd: number;
  viewRange: number;
  buckets: Array<TraceSpan[]>;
  laneData: LaneData[];
  ticks: Tick[];
};

export type Tick = {
  time: number;
  leftPct: number;
};
