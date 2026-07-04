import { AlphaAction } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

/** Manipulate the alpha channel (activate, deactivate, remove, set opaque...). */
export const Alpha = makePureInOutFunctionDesc({
  typeName: 'image/alpha',
  label: 'Image: Alpha',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    action: {
      valueType: 'string',
      defaultValue: 'On',
      label: 'action',
      choices: Object.keys(AlphaAction)
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const action = enumValue(
      AlphaAction,
      read<string>('action'),
      AlphaAction.On
    );
    write('image', await transformImage(image, (img) => img.alpha(action)));
  }
});
