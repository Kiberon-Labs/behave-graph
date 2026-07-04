import { MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Make every pixel matching `color` fully transparent. */
export const Transparent = makePureInOutFunctionDesc({
  typeName: 'image/transparent',
  label: 'Image: Transparent',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    color: {
      valueType: 'string',
      defaultValue: '#000000',
      label: 'color'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const color = read<string>('color');
    write(
      'image',
      await transformImage(image, (img) =>
        img.transparent(new MagickColor(color))
      )
    );
  }
});
