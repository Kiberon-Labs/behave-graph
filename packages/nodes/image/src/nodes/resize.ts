import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

export const Resize = makePureInOutFunctionDesc({
  typeName: 'image/resize',
  label: 'Image: Resize',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: {
      valueType: 'integer',
      defaultValue: 512,
      label: 'width'
    },
    height: {
      valueType: 'integer',
      defaultValue: 512,
      label: 'height'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    write(
      'image',
      await transformImage(image, (img) => img.resize(width, height))
    );
  }
});
