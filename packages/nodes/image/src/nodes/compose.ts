import type { IMagickImage } from '@imagemagick/magick-wasm';
import { CompositeOperator, ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Compose = makePureInOutFunctionDesc({
  typeName: 'image/compose',
  label: 'Image: Compose',
  in: {
    a: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    b: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    operator: {
      valueType: 'string',
      defaultValue: 'Dissolve',
      choices: Object.keys(CompositeOperator),
      label: 'operator'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const a = read<Uint8Array>('a');
    const b = read<Uint8Array>('b');
    const compositeOperator = read<keyof typeof CompositeOperator>('operator');
    const aa = cloneImage(a);

    const bb = cloneImage(b);
    const magickImage = await ImageMagick.read(
      aa,
      async (image: IMagickImage) => {
        return await ImageMagick.read(bb, async (bbb: IMagickImage) => {
          image.composite(bbb, CompositeOperator[compositeOperator]);
          return await image.write((data) => data);
        });
      }
    );
    write('image', magickImage);
  }
});
