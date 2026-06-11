import type { ValueType } from '../../../Values/ValueType.js';

export const ObjectValue: ValueType = {
  name: 'object',
  creator: () => ({}),
  deserialize: (value: string) => JSON.parse(value),
  serialize: (value: object) => JSON.stringify(value),
  lerp: (start: object, end: object, t: number) => (t < 0.5 ? start : end),
  equals: (a: object, b: object) => a === b,
  clone: (value: object) => JSON.parse(JSON.stringify(value))
};
