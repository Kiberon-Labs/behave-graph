import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { clampInt, transformImage } from '@/utils.js';

/** Resize using data-dependent triangulation (better for large downscales). */
export const AdaptiveResize = makePureInOutFunctionDesc({
  typeName: 'image/adaptiveResize',
  label: 'Image: Adaptive Resize',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    width: { valueType: 'integer', defaultValue: 128, label: 'width' },
    height: { valueType: 'integer', defaultValue: 128, label: 'height' }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);
    write(
      'image',
      await transformImage(image, (img) => img.adaptiveResize(width, height))
    );
  }
});
