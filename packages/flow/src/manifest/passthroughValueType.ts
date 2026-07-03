import type { ValueTypeSpecJSON } from '@kiberon-labs/behave-graph';
import type { ValueTypeMetadata } from '@/types/NodeMetadata';

const clone = <T>(value: T): T => {
  if (value === null || typeof value !== 'object') return value;
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value)) as T;
  }
};

/**
 * Build a function-bearing {@link ValueTypeMetadata} from a function-free
 * {@link ValueTypeSpecJSON} carried in a manifest.
 *
 * The editor calls `creator`/`serialize`/`deserialize` at author time (creating
 * variables, editing events, deserializing a graph's variables). A manifest can
 * only ship JSON, so we synthesise pass-through behaviour: the value is already
 * its own JSON form, so (de)serialize are identity and `creator` returns a clone
 * of the declared default. This keeps every existing UI call site working with
 * **zero code execution**. When the package is later trusted-loaded, a
 * `valueType` contribution can replace this with the real implementation.
 */
export function passthroughValueType(
  spec: ValueTypeSpecJSON
): ValueTypeMetadata {
  return {
    name: spec.name,
    creator: () =>
      spec.defaultJSON === null || spec.defaultJSON === undefined
        ? undefined
        : clone(spec.defaultJSON),
    serialize: (value: unknown) => value,
    deserialize: (value: unknown) => value,
    clone: (value: unknown) => clone(value),
    equals: (a: unknown, b: unknown) =>
      a === b || JSON.stringify(a) === JSON.stringify(b)
  };
}
