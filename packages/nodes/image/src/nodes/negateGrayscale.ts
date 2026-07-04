import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Invert only the grayscale (intensity) channel, leaving color/alpha alone. */
export const NegateGrayscale = makePureInOutFunctionDesc({
  typeName: 'image/negateGrayscale',
  label: 'Image: Negate Grayscale',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    write('image', await transformImage(image, (img) => img.negateGrayScale()));
  }
});
