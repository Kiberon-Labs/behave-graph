import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/**
 * Apply a non-linear (sigmoidal) contrast adjustment, the perceptually-smooth
 * way to increase or decrease contrast around a midpoint.
 */
export const SigmoidalContrast = makePureInOutFunctionDesc({
  typeName: 'image/sigmoidalContrast',
  label: 'Image: Sigmoidal Contrast',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    contrast: {
      valueType: 'float',
      defaultValue: 3,
      label: 'contrast'
    },
    midpoint: {
      valueType: 'float',
      defaultValue: 50,
      label: 'midpoint %'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const contrast = read<number>('contrast');
    const midpoint = read<number>('midpoint');
    write(
      'image',
      await transformImage(image, (img) =>
        img.sigmoidalContrast(contrast, new Percentage(midpoint))
      )
    );
  }
});
