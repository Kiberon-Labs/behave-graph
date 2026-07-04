import { MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Bucket-fill the contiguous region starting at (x, y) with `color`. */
export const FloodFill = makePureInOutFunctionDesc({
  typeName: 'image/floodFill',
  label: 'Image: Flood Fill',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    color: {
      valueType: 'string',
      defaultValue: '#ff0000',
      label: 'color'
    },
    x: { valueType: 'integer', defaultValue: 0, label: 'x' },
    y: { valueType: 'integer', defaultValue: 0, label: 'y' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const color = read<string>('color');
    const x = clampInt(read<number>('x'), 0, 16384);
    const y = clampInt(read<number>('y'), 0, 16384);
    write(
      'image',
      await transformImage(image, (img) =>
        img.floodFill(new MagickColor(color), x, y)
      )
    );
  }
});
