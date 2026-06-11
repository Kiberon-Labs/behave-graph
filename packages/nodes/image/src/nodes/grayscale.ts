import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';
import { makeFunctionNodeDefinition } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Grayscale = makeFunctionNodeDefinition({
  typeName: 'image/grayscale',
  label: 'Image: Grayscale',
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
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        image.grayscale();
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
