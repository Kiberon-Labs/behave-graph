import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Gamma = makePureInOutFunctionDesc({
  typeName: 'image/gamma',
  label: 'Image: Gamma',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    gamma: {
      valueType: 'float',
      defaultValue: 1,
      label: 'gamma'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const gamma = read<number>('gamma');
    write(
      'image',
      await transformImage(image, (img) => img.gammaCorrect(gamma))
    );
  }
});
