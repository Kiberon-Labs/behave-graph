import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Clone an existing mesh under a new name.
export const CloneMesh = makeFlowNodeDefinition({
  typeName: 'scene/cloneMesh',
  category: NodeCategory.Effect,
  label: 'Clone Mesh',
  in: {
    flow: 'flow',
    sourceName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    newName: 'string'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    scene?.cloneMesh(read<string>('sourceName'), read<string>('newName'));
    commit('flow');
  }
});
