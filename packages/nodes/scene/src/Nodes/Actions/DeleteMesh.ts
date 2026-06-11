import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

export const DeleteMesh = makeFlowNodeDefinition({
  typeName: 'scene/deleteMesh',
  category: NodeCategory.Effect,
  label: 'Delete Mesh',
  in: {
    flow: 'flow',
    name: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    }
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    scene?.deleteMesh(read<string>('name'));
    commit('flow');
  }
});
