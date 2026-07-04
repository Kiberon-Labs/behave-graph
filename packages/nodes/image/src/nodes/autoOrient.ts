import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Rotate/flip the image to its stored EXIF orientation, then clear the flag. */
export const AutoOrient = makePureInOutFunctionDesc({
  typeName: 'image/autoOrient',
  label: 'Image: Auto Orient',
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
    write('image', await transformImage(image, (img) => img.autoOrient()));
  }
});
