import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Level = makePureInOutFunctionDesc({
  typeName: 'image/level',
  label: 'Image: Level',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    blackPoint: {
      valueType: 'float',
      defaultValue: 0,
      label: 'black point %'
    },
    whitePoint: {
      valueType: 'float',
      defaultValue: 100,
      label: 'white point %'
    },
    gamma: {
      valueType: 'float',
      defaultValue: 1,
      label: 'gamma'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const blackPoint = read<number>('blackPoint');
    const whitePoint = read<number>('whitePoint');
    const gamma = read<number>('gamma');
    write(
      'image',
      await transformImage(image, (img) =>
        img.level(new Percentage(blackPoint), new Percentage(whitePoint), gamma)
      )
    );
  }
});
