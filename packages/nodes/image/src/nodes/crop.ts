import { Gravity } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, enumValue, transformImage } from '@/utils.js';

export const Crop = makePureInOutFunctionDesc({
  typeName: 'image/crop',
  label: 'Image: Crop',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'width'
    },
    height: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'height'
    },
    gravity: {
      valueType: 'string',
      defaultValue: 'Center',
      label: 'gravity',
      choices: Object.keys(Gravity)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    const gravity = enumValue(Gravity, read<string>('gravity'), Gravity.Center);
    write(
      'image',
      await transformImage(image, (img) => img.crop(width, height, gravity))
    );
  }
});
