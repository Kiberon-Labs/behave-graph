import {
  makeFunctionNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Get the world-space position of a mesh.
export const GetMeshPosition = makeFunctionNodeDefinition({
  typeName: 'scene/getMeshPosition',
  category: NodeCategory.Query,
  label: 'Get Mesh Position',
  in: {
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    }
  },
  out: {
    x: 'float',
    y: 'float',
    z: 'float'
  },
  exec: ({ graph, read, write }) => {
    const scene = graph.getDependency('IScene');
    const pos = scene?.getMeshPosition(read<string>('meshName'));
    write('x', pos?.x ?? 0);
    write('y', pos?.y ?? 0);
    write('z', pos?.z ?? 0);
  }
});
