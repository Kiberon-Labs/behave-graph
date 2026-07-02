import { MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

export const Border = makePureInOutFunctionDesc({
  typeName: 'image/border',
  label: 'Image: Border',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: {
      valueType: 'integer',
      defaultValue: 8,
      label: 'width'
    },
    height: {
      valueType: 'integer',
      defaultValue: 8,
      label: 'height'
    },
    r: { valueType: 'integer', defaultValue: 0, label: 'r' },
    g: { valueType: 'integer', defaultValue: 0, label: 'g' },
    b: { valueType: 'integer', defaultValue: 0, label: 'b' },
    a: { valueType: 'integer', defaultValue: 255, label: 'a' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 0, 16384);
    const height = clampInt(read<number>('height'), 0, 16384);
    const r = clampInt(read<number>('r'), 0, 255);
    const g = clampInt(read<number>('g'), 0, 255);
    const b = clampInt(read<number>('b'), 0, 255);
    const a = clampInt(read<number>('a'), 0, 255);
    write(
      'image',
      await transformImage(image, (img) => {
        img.borderColor = new MagickColor(r, g, b, a);
        img.border(width, height);
      })
    );
  }
});
