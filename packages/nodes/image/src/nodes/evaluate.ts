import { Channels, EvaluateOperator } from '@imagemagick/magick-wasm';
import { makePureInOutFunctionDesc } from '@kiberon-labs/behave-graph';
import { ImageValue } from '../values';
import { enumValue, transformImage } from '@/utils.js';

/** Apply a per-pixel arithmetic/bitwise operator across all channels. */
export const Evaluate = makePureInOutFunctionDesc({
  typeName: 'image/evaluate',
  label: 'Image: Evaluate',
  in: {
    image: {
      valueType: ImageValue.name,
      defaultValue: undefined,
      label: 'image'
    },
    operator: {
      valueType: 'string',
      defaultValue: 'Multiply',
      label: 'operator',
      choices: Object.keys(EvaluateOperator)
    },
    value: {
      valueType: 'float',
      defaultValue: 1,
      label: 'value'
    }
  },
  out: {
    image: ImageValue.name
  },
  exec: async ({ read, write }) => {
    const image = read<Uint8Array>('image');
    const operator = enumValue(
      EvaluateOperator,
      read<string>('operator'),
      EvaluateOperator.Multiply
    );
    const value = read<number>('value');
    write(
      'image',
      await transformImage(image, (img) =>
        img.evaluate(Channels.All, operator, value)
      )
    );
  }
});
