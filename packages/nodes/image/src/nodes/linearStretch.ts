import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Linearly remap the histogram between the black and white percentages. */
export const LinearStretch = makePureInOutFunctionDesc({
  typeName: 'image/linearStretch',
  label: 'Image: Linear Stretch',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    blackPoint: {
      valueType: 'float',
      defaultValue: 0,
      label: 'blackPoint'
    },
    whitePoint: {
      valueType: 'float',
      defaultValue: 100,
      label: 'whitePoint'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const blackPoint = read<number>('blackPoint');
    const whitePoint = read<number>('whitePoint');
    write(
      'image',
      await transformImage(image, (img) =>
        img.linearStretch(
          new Percentage(blackPoint),
          new Percentage(whitePoint)
        )
      )
    );
  }
});
