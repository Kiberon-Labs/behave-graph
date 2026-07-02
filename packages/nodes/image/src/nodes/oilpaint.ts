import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Oilpaint = makePureInOutFunctionDesc({
  typeName: 'image/oilpaint',
  label: 'Image: Oilpaint',
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
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    write('image', await transformImage(image, (img) => img.oilPaint(radius)));
  }
});
