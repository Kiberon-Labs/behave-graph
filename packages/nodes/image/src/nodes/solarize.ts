import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Solarize = makePureInOutFunctionDesc({
  typeName: 'image/solarize',
  label: 'Image: Solarize',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    factor: {
      valueType: 'float',
      defaultValue: 50,
      label: 'factor'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const factor = read<number>('factor');
    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        image.solarize(factor);
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
