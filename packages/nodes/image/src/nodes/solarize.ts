import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Solarize = makePureInOutFunctionDesc({
  typeName: 'image/solarize',
  label: 'Image: Solarize',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    factor: {
      valueType: 'float',
      defaultValue: 50,
      label: 'factor'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const factor = read<number>('factor');
    write('image', await transformImage(image, (img) => img.solarize(factor)));
  }
});
