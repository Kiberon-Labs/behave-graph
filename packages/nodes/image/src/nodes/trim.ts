import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Trim = makePureInOutFunctionDesc({
  typeName: 'image/trim',
  label: 'Image: Trim',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    fuzz: {
      valueType: 'float',
      defaultValue: 0,
      label: 'fuzz %'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const fuzz = read<number>('fuzz');
    write(
      'image',
      await transformImage(image, (img) => {
        if (fuzz > 0) {
          img.trim(new Percentage(fuzz));
        } else {
          img.trim();
        }
      })
    );
  }
});
