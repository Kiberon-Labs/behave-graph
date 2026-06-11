import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

const lightPropertyChoices = [
  { text: 'color', value: 'color' },
  { text: 'intensity', value: 'intensity' },
  { text: 'position', value: 'position' }
];

export const SetLightProperty = makeFlowNodeDefinition({
  typeName: 'scene/setLightProperty',
  category: NodeCategory.Effect,
  label: 'Set Light Property',
  in: {
    flow: 'flow',
    name: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getLightNames()
      };
    },
    property: (_) => ({
      valueType: 'string',
      choices: lightPropertyChoices
    }),
    floatValue: 'float',
    colorValue: 'color',
    vec3Value: 'vec3'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const name = read<string>('name');
    const property = read<string>('property');

    let value: unknown;
    switch (property) {
      case 'intensity':
        value = read<number>('floatValue');
        break;
      case 'color':
        value = read('colorValue');
        break;
      case 'position':
        value = read('vec3Value');
        break;
      default:
        value = read<number>('floatValue');
    }

    scene?.setLightProperty(name, property, value);
    commit('flow');
  }
});
