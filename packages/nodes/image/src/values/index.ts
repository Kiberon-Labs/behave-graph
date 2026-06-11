import type { ValueType } from '@kiberon-labs/behave-graph';

export const ImageValue: ValueType<Uint8Array> = {
  name: 'image',
  creator: () => new Uint8Array(),
  deserialize: (value: string) => new Uint8Array(JSON.parse(value)),
  serialize: (value: Uint8Array) => JSON.stringify(Array.from(value)),
  lerp: (start: Uint8Array, end: Uint8Array, t: number) =>
    t < 0.5 ? start : end,
  equals: (a: Uint8Array, b: Uint8Array) => a === b,
  clone: (value: Uint8Array) => {
    const dst = new Uint8Array(value.byteLength);
    dst.set(new Uint8Array(value));
    return dst;
  }
};

export const values = {
  [ImageValue.name]: ImageValue
};
