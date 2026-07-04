import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Remove all profiles, comments and metadata (shrinks the file). */
export const Strip = makePureInOutFunctionDesc({
  typeName: 'image/strip',
  label: 'Image: Strip',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    write('image', await transformImage(image, (img) => img.strip()));
  }
});
