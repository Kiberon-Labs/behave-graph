import { Gravity, MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, enumValue, transformImage } from '@/utils.js';

/**
 * Resize the image canvas (not the image content) to the given size, filling
 * any new area with the background color. Useful for padding an image out to a
 * fixed aspect ratio.
 */
export const Extent = makePureInOutFunctionDesc({
  typeName: 'image/extent',
  label: 'Image: Extent (Canvas)',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: {
      valueType: 'integer',
      defaultValue: 512,
      label: 'width'
    },
    height: {
      valueType: 'integer',
      defaultValue: 512,
      label: 'height'
    },
    gravity: {
      valueType: 'string',
      defaultValue: 'Center',
      label: 'gravity',
      choices: Object.keys(Gravity)
    },
    r: { valueType: 'integer', defaultValue: 0, label: 'background r' },
    g: { valueType: 'integer', defaultValue: 0, label: 'background g' },
    b: { valueType: 'integer', defaultValue: 0, label: 'background b' },
    a: { valueType: 'integer', defaultValue: 0, label: 'background a' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    const gravity = enumValue(Gravity, read<string>('gravity'), Gravity.Center);
    const r = clampInt(read<number>('r'), 0, 255);
    const g = clampInt(read<number>('g'), 0, 255);
    const b = clampInt(read<number>('b'), 0, 255);
    const a = clampInt(read<number>('a'), 0, 255);
    write(
      'image',
      await transformImage(image, (img) => {
        img.backgroundColor = new MagickColor(r, g, b, a);
        img.extent(width, height, gravity);
      })
    );
  }
});
