import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Remove pixels from the edges (unlike `border`, which adds them). */
export const Shave = makePureInOutFunctionDesc({
  typeName: 'image/shave',
  label: 'Image: Shave',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    leftRight: {
      valueType: 'integer',
      defaultValue: 1,
      label: 'leftRight'
    },
    topBottom: {
      valueType: 'integer',
      defaultValue: 1,
      label: 'topBottom'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const leftRight = clampInt(read<number>('leftRight'), 0, 16384);
    const topBottom = clampInt(read<number>('topBottom'), 0, 16384);
    write(
      'image',
      await transformImage(image, (img) => img.shave(leftRight, topBottom))
    );
  }
});
