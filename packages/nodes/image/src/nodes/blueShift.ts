import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Simulate a moonlit ("night") scene by shifting blues. */
export const BlueShift = makePureInOutFunctionDesc({
  typeName: 'image/blueShift',
  label: 'Image: Blue Shift',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    factor: {
      valueType: 'float',
      defaultValue: 1.5,
      label: 'factor'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const factor = read<number>('factor');
    write('image', await transformImage(image, (img) => img.blueShift(factor)));
  }
});
