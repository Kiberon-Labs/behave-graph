import { MagickGeometry } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Insert a block of background color into the image, growing it. */
export const Splice = makePureInOutFunctionDesc({
  typeName: 'image/splice',
  label: 'Image: Splice',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    x: { valueType: 'integer', defaultValue: 0, label: 'x' },
    y: { valueType: 'integer', defaultValue: 0, label: 'y' },
    width: { valueType: 'integer', defaultValue: 4, label: 'width' },
    height: { valueType: 'integer', defaultValue: 4, label: 'height' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const x = clampInt(read<number>('x'), 0, 16384);
    const y = clampInt(read<number>('y'), 0, 16384);
    const width = clampInt(read<number>('width'), 0, 16384);
    const height = clampInt(read<number>('height'), 0, 16384);
    write(
      'image',
      await transformImage(image, (img) =>
        img.splice(new MagickGeometry(x, y, width, height))
      )
    );
  }
});
