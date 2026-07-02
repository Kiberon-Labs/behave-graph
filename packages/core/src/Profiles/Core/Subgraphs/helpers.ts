import { Socket } from '../../../Sockets/Socket.js';

/**
 * A single typed entry of a graph's contract (one input or one output).
 *
 * `id` is the stable identity used as the socket name / contract key / runtime
 * mapping key; `name` is the user-facing display label and can be renamed freely
 * without breaking wiring. `id` falls back to `name` for legacy data.
 */
export type GraphSocketParam = {
  id?: string;
  name: string;
  valueTypeName: string;
  defaultValue?: any;
};

/** Stable identity of a param , its id, falling back to name for legacy data. */
export const paramSocketId = (p: GraphSocketParam): string => p.id ?? p.name;

/** Build value sockets from a configuration param list (name = id, label = name). */
export const paramsToSockets = (params: GraphSocketParam[] = []): Socket[] =>
  (params ?? []).map(
    (p) => new Socket(p.valueTypeName, paramSocketId(p), p.defaultValue, p.name)
  );

/** Read a param list off a node configuration value (defensive). */
export const readParams = (value: unknown): GraphSocketParam[] =>
  Array.isArray(value) ? (value as GraphSocketParam[]) : [];
