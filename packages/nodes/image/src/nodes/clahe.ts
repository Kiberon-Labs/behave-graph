import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Contrast Limited Adaptive Histogram Equalization (local contrast boost). */
export const Clahe = makePureInOutFunctionDesc({
  typeName: 'image/clahe',
  label: 'Image: CLAHE',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    xTiles: { valueType: 'integer', defaultValue: 8, label: 'xTiles' },
    yTiles: { valueType: 'integer', defaultValue: 8, label: 'yTiles' },
    numberBins: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'numberBins'
    },
    clipLimit: { valueType: 'float', defaultValue: 3, label: 'clipLimit' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const xTiles = clampInt(read<number>('xTiles'), 1, 16384);
    const yTiles = clampInt(read<number>('yTiles'), 1, 16384);
    const numberBins = clampInt(read<number>('numberBins'), 1, 65536);
    const clipLimit = read<number>('clipLimit');
    write(
      'image',
      await transformImage(image, (img) =>
        img.clahe(xTiles, yTiles, numberBins, clipLimit)
      )
    );
  }
});
