import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

/** Read metadata about an image without modifying it. */
export const ImageProperties = makePureInOutFunctionDesc({
  typeName: 'image/properties',
  label: 'Image: Properties',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    }
  },
  out: {
    width: 'integer',
    height: 'integer',
    format: 'string',
    totalColors: 'integer',
    colorspace: 'string',
    density: 'string',
    depth: 'integer',
    hasAlpha: 'boolean'
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    await ImageMagick.read(cloneImage(image), async (img: IMagickImage) => {
      write('width', img.width);
      write('height', img.height);
      write('format', img.format);
      write('totalColors', img.totalColors);
      write('colorspace', String(img.colorSpace));
      write('density', img.density.toString());
      write('depth', img.depth);
      write('hasAlpha', img.hasAlpha);
    });
  }
});
