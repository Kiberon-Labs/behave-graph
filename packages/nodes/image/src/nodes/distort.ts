import { DistortMethod } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

/**
 * Geometrically distort the image. `params` is a comma/space separated list of
 * numbers whose meaning depends on `method` (e.g. a single angle for
 * ScaleRotateTranslate, or an Arc angle for Arc).
 */
export const Distort = makePureInOutFunctionDesc({
  typeName: 'image/distort',
  label: 'Image: Distort',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    method: {
      valueType: 'string',
      defaultValue: 'ScaleRotateTranslate',
      label: 'method',
      choices: Object.keys(DistortMethod)
    },
    params: {
      valueType: 'string',
      defaultValue: '0',
      label: 'params'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const method = enumValue(
      DistortMethod,
      read<string>('method'),
      DistortMethod.ScaleRotateTranslate
    );
    const params = read<string>('params')
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    write(
      'image',
      await transformImage(image, (img) => img.distort(method, params))
    );
  }
});
