import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

export const RemoveLight = makeFlowNodeDefinition({
  typeName: 'scene/removeLight',
  category: NodeCategory.Effect,
  label: 'Remove Light',
  in: {
    flow: 'flow',
    name: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getLightNames()
      };
    }
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    scene?.removeLight(read<string>('name'));
    commit('flow');
  }
});
