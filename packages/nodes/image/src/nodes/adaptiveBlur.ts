import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Blur the image while preserving edges. */
export const AdaptiveBlur = makePureInOutFunctionDesc({
  typeName: 'image/adaptiveBlur',
  label: 'Image: Adaptive Blur',
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
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    write(
      'image',
      await transformImage(image, (img) => img.adaptiveBlur(radius, sigma))
    );
  }
});
