import {
  makeEventNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

type State = {
  handleSceneChanged?: (() => void) | undefined;
};

const initialState = (): State => ({});

export const OnSceneChanged = makeEventNodeDefinition({
  typeName: 'scene/onSceneChanged',
  category: NodeCategory.Event,
  label: 'On Scene Changed',
  in: {},
  out: {
    flow: 'flow'
  },
  initialState: initialState(),
  init: ({ commit, graph }) => {
    const handleSceneChanged = () => {
      commit('flow');
    };

    const scene = graph.getDependency('IScene');
    scene?.addOnSceneChangedListener(handleSceneChanged);

    const state: State = {
      handleSceneChanged
    };

    return state;
  },
  dispose: ({ state: { handleSceneChanged }, graph: { getDependency } }) => {
    if (!handleSceneChanged) return {};

    const scene = getDependency('IScene');
    scene?.removeOnSceneChangedListener(handleSceneChanged);

    return {};
  }
});
