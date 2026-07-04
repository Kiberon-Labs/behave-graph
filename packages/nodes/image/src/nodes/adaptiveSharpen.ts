import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Sharpen more strongly near edges (edge-aware unsharp). */
export const AdaptiveSharpen = makePureInOutFunctionDesc({
  typeName: 'image/adaptiveSharpen',
  label: 'Image: Adaptive Sharpen',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    radius: { valueType: 'float', defaultValue: 0, label: 'radius' },
    sigma: { valueType: 'float', defaultValue: 1, label: 'sigma' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    write(
      'image',
      await transformImage(image, (img) => img.adaptiveSharpen(radius, sigma))
    );
  }
});
