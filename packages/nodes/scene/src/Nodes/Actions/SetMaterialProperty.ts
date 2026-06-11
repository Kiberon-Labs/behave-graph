import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

const materialPropertyChoices = [
  { text: 'color', value: 'color' },
  { text: 'opacity', value: 'opacity' },
  { text: 'visible', value: 'visible' },
  { text: 'wireframe', value: 'wireframe' }
];

export const SetMaterialProperty = makeFlowNodeDefinition({
  typeName: 'scene/setMaterialProperty',
  category: NodeCategory.Effect,
  label: 'Set Material Property',
  in: {
    flow: 'flow',
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    property: (_) => ({
      valueType: 'string',
      choices: materialPropertyChoices
    }),
    floatValue: 'float',
    booleanValue: 'boolean',
    colorValue: 'color'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const meshName = read<string>('meshName');
    const property = read<string>('property');

    let value: unknown;
    switch (property) {
      case 'color':
        value = read('colorValue');
        break;
      case 'opacity':
        value = read<number>('floatValue');
        break;
      case 'visible':
      case 'wireframe':
        value = read<boolean>('booleanValue');
        break;
      default:
        value = read<number>('floatValue');
    }

    scene?.setMaterialProperty(meshName, property, value);
    commit('flow');
  }
});
