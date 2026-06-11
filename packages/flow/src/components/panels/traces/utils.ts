export const hashToHue = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
};

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const NICE_INTERVALS = [
  1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000
] as const;

/**
 * Picks a "nice" round interval for time-axis grid lines.
 * Targets roughly 8 ticks across the visible range.
 */
export const calculateTimeInterval = (rangeMs: number): number => {
  const rawInterval = rangeMs / 8;
  for (const mag of NICE_INTERVALS) {
    if (mag >= rawInterval) return mag;
  }
  return NICE_INTERVALS[NICE_INTERVALS.length - 1]!;
};
