import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Enhance (or, when `enhance` is false, reduce) image contrast. */
export const Contrast = makePureInOutFunctionDesc({
  typeName: 'image/contrast',
  label: 'Image: Contrast',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    enhance: {
      valueType: 'boolean',
      defaultValue: true,
      label: 'enhance'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const enhance = read<boolean>('enhance');
    write(
      'image',
      await transformImage(image, (img) =>
        enhance ? img.contrast() : img.inverseContrast()
      )
    );
  }
});
