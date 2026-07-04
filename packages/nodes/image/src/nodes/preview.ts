import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

/**
 * Pass-through node whose job is to always show an inline image preview,
 * independent of the `image.showPreview` setting that gates previews on every
 * other image node. The image flows straight through unchanged so the node can
 * sit anywhere in a chain.
 */
export const ImagePreview = makePureInOutFunctionDesc({
  typeName: 'image/preview',
  label: 'Image: Preview',
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
  exec: ({ read, write }) => {
    const image = read<Uint8Array>('image');
    write('image', image ? cloneImage(image) : image);
  }
});
