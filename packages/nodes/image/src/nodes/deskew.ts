import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Straighten a scanned/skewed image. `threshold` is a percentage (0-100). */
export const Deskew = makePureInOutFunctionDesc({
  typeName: 'image/deskew',
  label: 'Image: Deskew',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    threshold: {
      valueType: 'float',
      defaultValue: 40,
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
      await transformImage(image, (img) => {
        img.deskew(new Percentage(threshold));
      })
    );
  }
});
