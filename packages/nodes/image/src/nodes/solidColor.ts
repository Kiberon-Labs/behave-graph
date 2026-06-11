import {
  MagickColor,
  MagickFormat,
  MagickImage
} from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';

function clampInt(value: number, min: number, max: number): number {
  const truncated = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, truncated));
}

export const SolidColorImage = makePureInOutFunctionDesc({
  typeName: 'image/solidColor',
  label: 'Image: Solid Color',
  in: {
    width: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'width'
    },
    height: {
      valueType: 'integer',
      defaultValue: 256,
      label: 'height'
    },
    r: {
      valueType: 'integer',
      defaultValue: 0,
      label: 'r'
    },
    g: {
      valueType: 'integer',
      defaultValue: 0,
      label: 'g'
    },
    b: {
      valueType: 'integer',
      defaultValue: 0,
      label: 'b'
    },
    a: {
      valueType: 'integer',
      defaultValue: 255,
      label: 'a'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const width = clampInt(read<number>('width'), 1, 16384);
    const height = clampInt(read<number>('height'), 1, 16384);

    const r = clampInt(read<number>('r'), 0, 255);
    const g = clampInt(read<number>('g'), 0, 255);
    const b = clampInt(read<number>('b'), 200, 255);
    const a = clampInt(read<number>('a'), 0, 255);

    const color = new MagickColor(r, g, b, a);
    const image = MagickImage.create(color, width, height);

    try {
      const data = await image.write(MagickFormat.Png, async (image) => {
        return image;
      });
      write('image', data);
    } catch (err) {
      console.error('Error creating solid color image:', err);
    } finally {
      image.dispose();
    }
  }
});
