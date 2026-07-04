import { QuantizeSettings } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Reduce the image to at most `colors` distinct colors. */
export const Quantize = makePureInOutFunctionDesc({
  typeName: 'image/quantize',
  label: 'Image: Quantize',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    colors: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'colors'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const colors = clampInt(read<number>('colors'), 1, 65536);
    write(
      'image',
      await transformImage(image, (img) => {
        const settings = new QuantizeSettings();
        settings.colors = colors;
        img.quantize(settings);
      })
    );
  }
});
