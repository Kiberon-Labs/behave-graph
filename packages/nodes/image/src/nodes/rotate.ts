import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Rotate = makePureInOutFunctionDesc({
  typeName: 'image/rotate',
  label: 'Image: Rotate',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    degrees: {
      valueType: 'float',
      defaultValue: 90,
      label: 'degrees'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const degrees = read<number>('degrees');
    write('image', await transformImage(image, (img) => img.rotate(degrees)));
  }
});
