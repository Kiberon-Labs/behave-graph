import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Flip = makePureInOutFunctionDesc({
  typeName: 'image/flip',
  label: 'Image: Flip',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    direction: {
      valueType: 'string',
      defaultValue: 'vertical',
      label: 'direction',
      choices: ['vertical', 'horizontal']
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const direction = read<string>('direction');
    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        if (direction === 'vertical') {
          image.flip();
        } else {
          image.flop();
        }
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
