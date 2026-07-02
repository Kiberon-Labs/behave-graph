import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Convert the image to pure black and white at the given threshold. */
export const Threshold = makePureInOutFunctionDesc({
  typeName: 'image/threshold',
  label: 'Image: Threshold',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    threshold: {
      valueType: 'float',
      defaultValue: 50,
      label: 'threshold %'
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
      await transformImage(image, (img) =>
        img.threshold(new Percentage(threshold))
      )
    );
  }
});
