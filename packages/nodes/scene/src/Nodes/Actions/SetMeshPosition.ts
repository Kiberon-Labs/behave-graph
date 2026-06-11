import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Directly set a mesh's world position.
export const SetMeshPosition = makeFlowNodeDefinition({
  typeName: 'scene/setMeshPosition',
  category: NodeCategory.Effect,
  label: 'Set Mesh Position',
  in: {
    flow: 'flow',
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    x: 'float',
    y: 'float',
    z: 'float'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    scene?.setMeshPosition(read<string>('meshName'), {
      x: read<number>('x'),
      y: read<number>('y'),
      z: read<number>('z')
    });
    commit('flow');
  }
});
