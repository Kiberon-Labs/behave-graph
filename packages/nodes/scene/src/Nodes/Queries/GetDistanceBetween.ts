import {
  makeFunctionNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Compute the distance between two meshes.
export const GetDistanceBetween = makeFunctionNodeDefinition({
  typeName: 'scene/getDistanceBetween',
  category: NodeCategory.Query,
  label: 'Get Distance Between',
  in: {
    meshA: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    meshB: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    }
  },
  out: {
    distance: 'float'
  },
  exec: ({ graph, read, write }) => {
    const scene = graph.getDependency('IScene');
    const distance =
      scene?.getDistanceBetween(read<string>('meshA'), read<string>('meshB')) ??
      0;
    write('distance', distance);
  }
});
