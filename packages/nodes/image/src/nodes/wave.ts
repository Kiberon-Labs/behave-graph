import { PixelInterpolateMethod } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

/** Apply a sine-wave distortion along the vertical axis. */
export const Wave = makePureInOutFunctionDesc({
  typeName: 'image/wave',
  label: 'Image: Wave',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    amplitude: {
      valueType: 'float',
      defaultValue: 25,
      label: 'amplitude'
    },
    length: {
      valueType: 'float',
      defaultValue: 150,
      label: 'wavelength'
    },
    method: {
      valueType: 'string',
      defaultValue: 'Bilinear',
      label: 'interpolation',
      choices: Object.keys(PixelInterpolateMethod)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const amplitude = read<number>('amplitude');
    const length = read<number>('length');
    const method = enumValue(
      PixelInterpolateMethod,
      read<string>('method'),
      PixelInterpolateMethod.Bilinear
    );
    write(
      'image',
      await transformImage(image, (img) => img.wave(method, amplitude, length))
    );
  }
});
