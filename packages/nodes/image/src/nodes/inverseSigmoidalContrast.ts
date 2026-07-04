import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Inverse of sigmoidal contrast: reduces contrast around the midpoint. */
export const InverseSigmoidalContrast = makePureInOutFunctionDesc({
  typeName: 'image/inverseSigmoidalContrast',
  label: 'Image: Inverse Sigmoidal Contrast',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    contrast: {
      valueType: 'float',
      defaultValue: 4,
      label: 'contrast'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const contrast = read<number>('contrast');
    write(
      'image',
      await transformImage(image, (img) =>
        img.inverseSigmoidalContrast(contrast)
      )
    );
  }
});
