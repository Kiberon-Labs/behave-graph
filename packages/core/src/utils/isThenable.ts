/**
 * Duck-type check for promise-like values. The engine hot path stays fully
 * synchronous unless a node actually returns a promise; this is the check that
 * decides which path to take.
 */
export const isThenable = <T = unknown>(value: unknown): value is Promise<T> =>
  value != null && typeof (value as Promise<T>).then === 'function';
