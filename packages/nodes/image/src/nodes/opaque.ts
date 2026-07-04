import { MagickColor } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Replace every pixel matching `target` with `fill`. */
export const Opaque = makePureInOutFunctionDesc({
  typeName: 'image/opaque',
  label: 'Image: Opaque',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    target: {
      valueType: 'string',
      defaultValue: '#000000',
      label: 'target'
    },
    fill: {
      valueType: 'string',
      defaultValue: '#ff0000',
      label: 'fill'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const target = read<string>('target');
    const fill = read<string>('fill');
    write(
      'image',
      await transformImage(image, (img) =>
        img.opaque(new MagickColor(target), new MagickColor(fill))
      )
    );
  }
});
