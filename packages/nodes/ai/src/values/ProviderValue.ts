import type { ValueType } from '@kiberon-labs/behave-graph';
import type { ProviderConfig } from '../abstractions/types.js';

/**
 * `aiProvider` socket value , a serializable provider configuration produced by
 * the `ai/provider` node. Treated as a singleton value (no interpolation),
 * mirroring how the image package treats its `image` value.
 */
export const ProviderValue: ValueType<ProviderConfig> = {
  name: 'aiProvider',
  creator: () => ({ kind: 'openai' }),
  deserialize: (value: string) => JSON.parse(value) as ProviderConfig,
  serialize: (value: ProviderConfig) => JSON.stringify(value),
  lerp: (start: ProviderConfig, end: ProviderConfig, t: number) =>
    t < 0.5 ? start : end,
  equals: (a: ProviderConfig, b: ProviderConfig) => a === b,
  clone: (value: ProviderConfig) => ({ ...value })
};
