import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Local (windowed) thresholding with an optional bias percentage. */
export const AdaptiveThreshold = makePureInOutFunctionDesc({
  typeName: 'image/adaptiveThreshold',
  label: 'Image: Adaptive Threshold',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: { valueType: 'integer', defaultValue: 16, label: 'width' },
    height: { valueType: 'integer', defaultValue: 16, label: 'height' },
    bias: { valueType: 'float', defaultValue: 0, label: 'bias' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    const bias = read<number>('bias');
    write(
      'image',
      await transformImage(image, (img) =>
        img.adaptiveThreshold(width, height, new Percentage(bias))
      )
    );
  }
});
