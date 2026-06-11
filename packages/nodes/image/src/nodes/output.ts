import {
  makePureInOutFunctionDesc,
  NodeCategory,
  Singleton
} from '@kiberon-labs/behave-graph';

export const OutputImage = makePureInOutFunctionDesc({
  typeName: 'output/image',
  label: 'Output: Image',
  category: NodeCategory.Effect,
  in: {
    image: {
      valueType: 'image',
      defaultValue: '',
      label: 'image'
    }
  },
  metadata: {
    [Singleton]: true
  },
  out: {},
  exec: () => {
    // No-op
  }
});
