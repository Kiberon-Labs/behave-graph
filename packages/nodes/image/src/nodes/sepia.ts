import { makeFunctionNodeDefinition } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Sepia = makeFunctionNodeDefinition({
  typeName: 'image/sepia',
  label: 'Image: Sepia',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    threshold: {
      valueType: 'float',
      defaultValue: 80,
      label: 'threshold'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const threshold = read<number>('threshold');
    write(
      'image',
      await transformImage(image, (img) => img.sepiaTone(threshold))
    );
  }
});
