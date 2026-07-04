import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Roll = makePureInOutFunctionDesc({
  typeName: 'image/roll',
  label: 'Image: Roll',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    x: {
      valueType: 'integer',
      defaultValue: 0,
      label: 'x'
    },
    y: {
      valueType: 'integer',
      defaultValue: 0,
      label: 'y'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const x = read<number>('x');
    const y = read<number>('y');
    write('image', await transformImage(image, (img) => img.roll(x, y)));
  }
});
