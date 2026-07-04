import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick, PixelInterpolateMethod } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage, enumValue } from '@/utils.js';

/**
 * Recolor `image` by mapping its intensities through the color lookup table
 * `clut` (a gradient or palette image).
 */
export const Clut = makePureInOutFunctionDesc({
  typeName: 'image/clut',
  label: 'Image: CLUT',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    clut: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'clut'
    },
    method: {
      valueType: 'string',
      defaultValue: 'Bilinear',
      label: 'method',
      choices: Object.keys(PixelInterpolateMethod)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const clut = read<Uint8Array>('clut');
    const method = enumValue(
      PixelInterpolateMethod,
      read<string>('method'),
      PixelInterpolateMethod.Bilinear
    );
    const result = await ImageMagick.read(
      cloneImage(image),
      async (img: IMagickImage) =>
        ImageMagick.read(cloneImage(clut), async (table: IMagickImage) => {
          img.clut(table, method);
          // Copy out of the WASM-heap view before `read` disposes the image.
          return img.write((data) => cloneImage(data));
        })
    );
    write('image', result);
  }
});
