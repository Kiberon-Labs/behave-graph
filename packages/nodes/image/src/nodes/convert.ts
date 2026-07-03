import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage, clampInt, enumValue } from '@/utils.js';

const FORMAT_CHOICES = ['Png', 'Jpeg', 'WebP', 'Gif', 'Bmp', 'Tiff'] as const;

/** Re-encode the image into a different file format, optionally setting quality. */
export const Convert = makePureInOutFunctionDesc({
  typeName: 'image/convert',
  label: 'Image: Convert Format',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    format: {
      valueType: 'string',
      defaultValue: 'Png',
      label: 'format',
      choices: [...FORMAT_CHOICES]
    },
    quality: {
      valueType: 'integer',
      defaultValue: 90,
      label: 'quality'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const format = enumValue(
      MagickFormat,
      read<string>('format'),
      MagickFormat.Png
    );
    const quality = clampInt(read<number>('quality'), 1, 100);
    const result = await ImageMagick.read(
      cloneImage(image),
      async (img: IMagickImage) => {
        img.quality = quality;
        return await img.write(format, (data) => cloneImage(data));
      }
    );
    write('image', result);
  }
});
