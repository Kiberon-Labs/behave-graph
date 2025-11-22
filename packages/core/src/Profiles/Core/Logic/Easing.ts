import { EasingFunctions, EasingModes } from '../../../Easing.js';
import { makeFunctionNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '~/Nodes/Registry/NodeCategory.js';

export const Easing = makeFunctionNodeDefinition({
  typeName: 'math/easing',
  category: NodeCategory.Logic,
  label: 'Easing',
  in: {
    easingFunction: {
      valueType: 'string',
      name: 'easingFunction',
      defaultValue: 'linear',
      options: Object.keys(EasingFunctions)
    },
    easingMode: {
      valueType: 'string',
      name: 'easingMode',
      defaultValue: 'inOut',
      options: Object.keys(EasingModes)
    },
    t: 'float'
  },
  out: {
    t: 'float'
  },
  exec: ({ read, write }) => {
    const easingFunction =
      EasingFunctions[read('easingFunction') as keyof typeof EasingFunctions];
    const easingMode =
      EasingModes[read('easingMode') as keyof typeof EasingModes];
    const easing = easingMode(easingFunction);
    const inputT = read('t') as number;

    write('t', easing(inputT));
  }
});
