import type { ValueTypeMap } from '../Values/ValueTypeMap.js';
import type { ValueTypeSpecJSON } from './ManifestJSON.js';

/** Optional display metadata an author may hang off a value type. */
type ValueTypeDisplayMetadata = {
  metadata?: { color?: string; label?: string };
};

/**
 * Project a {@link ValueTypeMap} to function-free {@link ValueTypeSpecJSON}.
 *
 * Runs `serialize(creator())` once to capture a JSON default. This executes the
 * author's own value-type code at BUILD time (the trusted side); the emitted
 * JSON carries no functions, so consumers never execute anything to read it.
 */
export function writeValueTypesToJSON(
  values: ValueTypeMap
): ValueTypeSpecJSON[] {
  return Object.values(values).map((valueType) => {
    let defaultJSON: ValueTypeSpecJSON['defaultJSON'] = null;
    try {
      defaultJSON = valueType.serialize(valueType.creator());
    } catch {
      // Exotic types (e.g. binary blobs) may have no meaningful JSON default.
      defaultJSON = null;
    }

    const display = (valueType as unknown as ValueTypeDisplayMetadata).metadata;

    const spec: ValueTypeSpecJSON = {
      name: valueType.name,
      defaultJSON
    };
    if (display?.label !== undefined) spec.label = display.label;
    if (display?.color !== undefined) spec.color = display.color;
    return spec;
  });
}
