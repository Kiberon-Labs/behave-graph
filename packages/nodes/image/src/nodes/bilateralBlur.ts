import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Edge-preserving smoothing: blurs flat areas while keeping edges crisp. */
export const BilateralBlur = makePureInOutFunctionDesc({
  typeName: 'image/bilateralBlur',
  label: 'Image: Bilateral Blur',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: { valueType: 'integer', defaultValue: 5, label: 'width' },
    height: { valueType: 'integer', defaultValue: 5, label: 'height' },
    intensitySigma: {
      valueType: 'float',
      defaultValue: 10,
      label: 'intensitySigma'
    },
    spatialSigma: {
      valueType: 'float',
      defaultValue: 10,
      label: 'spatialSigma'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    const intensitySigma = read<number>('intensitySigma');
    const spatialSigma = read<number>('spatialSigma');
    write(
      'image',
      await transformImage(image, (img) =>
        img.bilateralBlur(width, height, intensitySigma, spatialSigma)
      )
    );
  }
});
