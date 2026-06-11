import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Show or hide a mesh.
export const SetMeshVisible = makeFlowNodeDefinition({
  typeName: 'scene/setMeshVisible',
  category: NodeCategory.Effect,
  label: 'Set Mesh Visible',
  in: {
    flow: 'flow',
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    visible: 'boolean'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    scene?.setMeshVisible(read<string>('meshName'), read<boolean>('visible'));
    commit('flow');
  }
});
