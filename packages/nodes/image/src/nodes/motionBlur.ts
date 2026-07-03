import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { transformImage } from '@/utils.js';

/** Simulate directional motion blur at the given angle. */
export const MotionBlur = makePureInOutFunctionDesc({
  typeName: 'image/motionBlur',
  label: 'Image: Motion Blur',
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
      defaultValue: 1,
      label: 'sigma'
    },
    angle: {
      valueType: 'float',
      defaultValue: 0,
      label: 'angle'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const radius = read<number>('radius');
    const sigma = read<number>('sigma');
    const angle = read<number>('angle');
    write(
      'image',
      await transformImage(image, (img) => img.motionBlur(radius, sigma, angle))
    );
  }
});
