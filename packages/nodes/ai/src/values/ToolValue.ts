import type { ValueType } from '@kiberon-labs/behave-graph';
import type { ToolSpec } from '../abstractions/types.js';

/**
 * `aiTool` socket value , a tool/function definition produced by the `ai/tool`
 * node and attached to an agent. Treated as a singleton value (no interpolation).
 */
export const ToolValue: ValueType<ToolSpec> = {
  name: 'aiTool',
  creator: () => ({
    name: '',
    description: '',
    parameters: { type: 'object', properties: {} }
  }),
  deserialize: (value: string) => JSON.parse(value) as ToolSpec,
  serialize: (value: ToolSpec) => JSON.stringify(value),
  lerp: (start: ToolSpec, end: ToolSpec, t: number) => (t < 0.5 ? start : end),
  equals: (a: ToolSpec, b: ToolSpec) => a === b,
  clone: (value: ToolSpec) => ({ ...value })
};
