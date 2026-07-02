import type { ValueType } from '@kiberon-labs/behave-graph';
import type { AgentSpec } from '../abstractions/types.js';

/**
 * `aiAgent` socket value , a fully-defined agent produced by the `ai/agent`
 * node. Treated as a singleton value (no interpolation).
 */
export const AgentValue: ValueType<AgentSpec> = {
  name: 'aiAgent',
  creator: () => ({
    provider: { kind: 'openai' },
    model: '',
    tools: []
  }),
  deserialize: (value: string) => JSON.parse(value) as AgentSpec,
  serialize: (value: AgentSpec) => JSON.stringify(value),
  lerp: (start: AgentSpec, end: AgentSpec, t: number) =>
    t < 0.5 ? start : end,
  equals: (a: AgentSpec, b: AgentSpec) => a === b,
  clone: (value: AgentSpec) => ({ ...value })
};
