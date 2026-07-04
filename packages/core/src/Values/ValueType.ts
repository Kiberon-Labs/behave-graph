/**
 * The minimal contract every value type must satisfy: construct a default,
 * round-trip to/from JSON, compare, and clone. Interpolation is deliberately
 * *not* here — see {@link Interpolatable} — so that value domains which cannot
 * be meaningfully interpolated (audio buffers, network handles, tool specs)
 * are not forced to fake a `lerp`.
 */
export interface ValueType<TValue = any, TJson = any> {
  name: string;
  creator: () => TValue;
  deserialize: (value: TJson) => TValue;
  serialize: (value: TValue) => TJson;
  /**
   * Optional interpolation used by animation/easing nodes. Omit it for value
   * types where interpolation is undefined; consumers must treat it as optional
   * (e.g. fall back to a step at t \< 0.5).
   */
  lerp?: (start: TValue, end: TValue, t: number) => TValue;
  equals: (a: TValue, b: TValue) => boolean;
  clone: (value: TValue) => TValue;
}

/**
 * A {@link ValueType} that additionally guarantees interpolation. Animation and
 * easing code can require this narrower type to get a non-optional `lerp`
 * instead of guarding at every call site.
 */
export interface Interpolatable<TValue = any, TJson = any>
  extends ValueType<TValue, TJson> {
  lerp: (start: TValue, end: TValue, t: number) => TValue;
}

/** Narrow a value type to {@link Interpolatable} at runtime. */
export const isInterpolatable = <TValue, TJson>(
  valueType: ValueType<TValue, TJson>
): valueType is Interpolatable<TValue, TJson> =>
  typeof valueType.lerp === 'function';

/**
 * Interpolate with a value type's `lerp` if it has one, otherwise step at the
 * midpoint. Safe to call against any {@link ValueType}.
 */
export const lerpValue = <TValue, TJson>(
  valueType: ValueType<TValue, TJson>,
  start: TValue,
  end: TValue,
  t: number
): TValue =>
  valueType.lerp ? valueType.lerp(start, end, t) : t < 0.5 ? start : end;
