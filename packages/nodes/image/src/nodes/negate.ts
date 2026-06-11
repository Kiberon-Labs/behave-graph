import type { IMagickImage } from '@imagemagick/magick-wasm';
import { Channels, ImageMagick } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { cloneImage } from '@/utils.js';

export const Negate = makePureInOutFunctionDesc({
  typeName: 'image/negate',
  label: 'Image: Negate',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    channel: {
      valueType: 'string',
      defaultValue: undefined,
      label: 'Channels',
      choices: Object.keys(Channels)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const channelKey = read<string>('channel');
    const channel =
      Channels[channelKey as keyof typeof Channels] || Channels.All;
    const magickImage = await ImageMagick.read(
      cloneImage(image),
      async (image: IMagickImage) => {
        image.negate(channel);
        return await image.write((data) => data);
      }
    );
    write('image', magickImage);
  }
});
