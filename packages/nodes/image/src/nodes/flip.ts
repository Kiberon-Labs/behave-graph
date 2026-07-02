import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Flip = makePureInOutFunctionDesc({
  typeName: 'image/flip',
  label: 'Image: Flip',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    direction: {
      valueType: 'string',
      defaultValue: 'vertical',
      label: 'direction',
      choices: ['vertical', 'horizontal']
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const direction = read<string>('direction');
    write(
      'image',
      await transformImage(image, (img) => {
        if (direction === 'vertical') {
          img.flip();
        } else {
          img.flop();
        }
      })
    );
  }
});
