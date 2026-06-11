import {
  makeFunctionNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

const materialPropertyChoices = [
  { text: 'color', value: 'color' },
  { text: 'opacity', value: 'opacity' },
  { text: 'visible', value: 'visible' },
  { text: 'wireframe', value: 'wireframe' }
];

export const GetMaterialProperty = makeFunctionNodeDefinition({
  typeName: 'scene/getMaterialProperty',
  category: NodeCategory.Query,
  label: 'Get Material Property',
  in: {
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
    })
  },
  out: {
    floatValue: 'float',
    booleanValue: 'boolean',
    colorValue: 'color'
  },
  exec: ({ graph, read, write }) => {
    const scene = graph.getDependency('IScene');
    const meshName = read<string>('meshName');
    const property = read<string>('property');

    const value = scene?.getMaterialProperty(meshName, property);

    switch (property) {
      case 'color':
        write('colorValue', value ?? { r: 0, g: 0, b: 0 });
        break;
      case 'opacity':
        write('floatValue', (value as number) ?? 1);
        break;
      case 'visible':
      case 'wireframe':
        write('booleanValue', (value as boolean) ?? false);
        break;
    }
  }
});
