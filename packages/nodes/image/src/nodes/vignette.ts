import { makeFunctionNodeDefinition } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

export const Vignette = makeFunctionNodeDefinition({
  typeName: 'image/vignette',
  label: 'Image: Vignette',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    radius: {
      valueType: 'float',
      defaultValue: 0,
      label: 'radius'
    },
    sigma: {
      valueType: 'float',
      defaultValue: 0,
      label: 'sigma'
    },
    x: {
      valueType: 'float',
      defaultValue: 0,
      label: 'x'
    },
    y: {
      valueType: 'float',
      defaultValue: 0,
      label: 'y'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    const x = read<number>('x');
    const y = read<number>('y');
    write(
      'image',
      await transformImage(image, (img) => img.vignette(radius, sigma, x, y))
    );
  }
});
