import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';

export const Negate = makePureInOutFunctionDesc({
  typeName: 'image/negate',
  label: 'Image: Negate',
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
    depth: 'integer'
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    await ImageMagick.read(image, async (image: IMagickImage) => {
      write('width', image.width);
      write('height', image.height);
      write('format', image.format);
      write('totalColors', image.totalColors);
      write('colorspace', image.colorSpace);
      write('density', image.density);
      write('depth', image.depth);
    });
  }
});
