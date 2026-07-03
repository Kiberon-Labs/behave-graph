import {
  makeEventNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

type State = {
  handleMeshClicked?: ((meshName: string) => void) | undefined;
};

const initialState = (): State => ({});

// Fires whenever any mesh in the scene is clicked, outputting which mesh.
export const OnAnyMeshClicked = makeEventNodeDefinition({
  typeName: 'scene/onAnyMeshClicked',
  category: NodeCategory.Event,
  label: 'On Any Mesh Clicked',
  in: {},
  out: {
    flow: 'flow',
    meshName: 'string'
  },
  initialState: initialState(),
  init: ({ commit, write, graph }) => {
    const handleMeshClicked = (meshName: string) => {
      write('meshName', meshName);
      commit('flow');
    };

    const scene = graph.getDependency('IScene');
    console.log('[OnAnyMeshClicked] init , scene dependency:', !!scene);

    scene?.addOnAnyMeshClickedListener(handleMeshClicked);

    const state: State = {
      handleMeshClicked
    };

    return state;
  },
  dispose: ({ state: { handleMeshClicked }, graph: { getDependency } }) => {
    if (!handleMeshClicked) return {};

    const scene = getDependency('IScene');
    scene?.removeOnAnyMeshClickedListener(handleMeshClicked);

    return {};
  }
});
