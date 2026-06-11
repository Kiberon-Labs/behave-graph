import {
  makeFunctionNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

const lightPropertyChoices = [
  { text: 'color', value: 'color' },
  { text: 'intensity', value: 'intensity' },
  { text: 'position', value: 'position' }
];

export const GetLightProperty = makeFunctionNodeDefinition({
  typeName: 'scene/getLightProperty',
  category: NodeCategory.Query,
  label: 'Get Light Property',
  in: {
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
    })
  },
  out: {
    floatValue: 'float',
    colorValue: 'color',
    vec3Value: 'vec3'
  },
  exec: ({ graph, read, write }) => {
    const scene = graph.getDependency('IScene');
    const name = read<string>('name');
    const property = read<string>('property');

    const value = scene?.getLightProperty(name, property);

    switch (property) {
      case 'intensity':
        write('floatValue', value ?? 0);
        break;
      case 'color':
        write('colorValue', value ?? { r: 0, g: 0, b: 0 });
        break;
      case 'position':
        write('vec3Value', value ?? { x: 0, y: 0, z: 0 });
        break;
    }
  }
});
