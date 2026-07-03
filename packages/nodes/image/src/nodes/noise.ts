import { NoiseType } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

export const AddNoise = makePureInOutFunctionDesc({
  typeName: 'image/noise',
  label: 'Image: Add Noise',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    type: {
      valueType: 'string',
      defaultValue: 'Gaussian',
      label: 'type',
      choices: Object.keys(NoiseType)
    },
    attenuate: {
      valueType: 'float',
      defaultValue: 1,
      label: 'attenuate'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const type = enumValue(NoiseType, read<string>('type'), NoiseType.Gaussian);
    const attenuate = read<number>('attenuate');
    write(
      'image',
      await transformImage(image, (img) => img.addNoise(type, attenuate))
    );
  }
});
