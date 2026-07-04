import { AutoThresholdMethod } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

/** Binarize the image, choosing the threshold automatically. */
export const AutoThreshold = makePureInOutFunctionDesc({
  typeName: 'image/autoThreshold',
  label: 'Image: Auto Threshold',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    method: {
      valueType: 'string',
      defaultValue: 'OTSU',
      label: 'method',
      choices: Object.keys(AutoThresholdMethod)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const method = enumValue(
      AutoThresholdMethod,
      read<string>('method'),
      AutoThresholdMethod.OTSU
    );
    write(
      'image',
      await transformImage(image, (img) => img.autoThreshold(method))
    );
  }
});
