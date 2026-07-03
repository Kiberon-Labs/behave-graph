import { Channels } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

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
    const channel = enumValue(Channels, read<string>('channel'), Channels.All);
    write('image', await transformImage(image, (img) => img.negate(channel)));
  }
});
