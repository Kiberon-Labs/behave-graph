import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';

export const Oilpaint = makePureInOutFunctionDesc({
  typeName: 'image/oilpaint',
  label: 'Image: Oilpaint',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    radius: {
      valueType: 'float',
      defaultValue: 0,
      label: 'radius'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    await ImageMagick.read(image, async (image: IMagickImage) => {
      image.oilPaint(radius);
      await image.write((data) => write('image', data));
    });
  }
});
