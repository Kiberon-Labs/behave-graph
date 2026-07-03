import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const BrightnessContrast = makePureInOutFunctionDesc({
  typeName: 'image/brightnessContrast',
  label: 'Image: Brightness/Contrast',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    brightness: {
      valueType: 'float',
      defaultValue: 0,
      label: 'brightness %'
    },
    contrast: {
      valueType: 'float',
      defaultValue: 0,
      label: 'contrast %'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const brightness = read<number>('brightness');
    const contrast = read<number>('contrast');
    write(
      'image',
      await transformImage(image, (img) =>
        img.brightnessContrast(
          new Percentage(brightness),
          new Percentage(contrast)
        )
      )
    );
  }
});
