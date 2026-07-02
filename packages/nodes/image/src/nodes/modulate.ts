import { Percentage } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/**
 * Adjust brightness, saturation and hue. Each value is a percentage where 100
 * leaves the channel unchanged.
 */
export const Modulate = makePureInOutFunctionDesc({
  typeName: 'image/modulate',
  label: 'Image: Modulate (HSB)',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    brightness: {
      valueType: 'float',
      defaultValue: 100,
      label: 'brightness %'
    },
    saturation: {
      valueType: 'float',
      defaultValue: 100,
      label: 'saturation %'
    },
    hue: {
      valueType: 'float',
      defaultValue: 100,
      label: 'hue %'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const brightness = read<number>('brightness');
    const saturation = read<number>('saturation');
    const hue = read<number>('hue');
    write(
      'image',
      await transformImage(image, (img) =>
        img.modulate(
          new Percentage(brightness),
          new Percentage(saturation),
          new Percentage(hue)
        )
      )
    );
  }
});
