import { MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Composite the image over a solid color, flattening transparency. */
export const ColorAlpha = makePureInOutFunctionDesc({
  typeName: 'image/colorAlpha',
  label: 'Image: Color Alpha',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    color: {
      valueType: 'string',
      defaultValue: '#ffffff',
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
        img.colorAlpha(new MagickColor(color))
      )
    );
  }
});
