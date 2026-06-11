import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Blur = makePureInOutFunctionDesc({
  typeName: 'image/blur',
  label: 'Image: Blur',
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
    },
    sigma: {
      valueType: 'float',
      defaultValue: 0,
      label: 'sigma'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        image.blur(radius, sigma);
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
