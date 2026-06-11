import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick, Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const CannyEdge = makePureInOutFunctionDesc({
  typeName: 'image/canny',
  label: 'Image: Canny Edge',
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
      defaultValue: 1,
      label: 'sigma'
    },
    lower: {
      valueType: 'float',
      defaultValue: 0,
      label: 'lower'
    },
    upper: {
      valueType: 'float',
      defaultValue: 1,
      label: 'upper'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    const lowerRaw = read<number>('lower');
    const upperRaw = read<number>('upper');

    const lower = new Percentage(lowerRaw);
    const upper = new Percentage(upperRaw);

    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        image.cannyEdge(radius, sigma, lower, upper);
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
