import { makeFunctionNodeDefinition } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Grayscale = makeFunctionNodeDefinition({
  typeName: 'image/grayscale',
  label: 'Image: Grayscale',
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
    write('image', await transformImage(image, (img) => img.grayscale()));
  }
});
