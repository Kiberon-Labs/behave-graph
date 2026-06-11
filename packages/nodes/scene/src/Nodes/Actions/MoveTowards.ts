import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Move a mesh towards a target position by (speed * deltaSeconds).
// Outputs 'done' when the mesh has arrived, otherwise 'ongoing'.
// Designed to be driven from an OnTick loop.
export const MoveTowards = makeFlowNodeDefinition({
  typeName: 'scene/moveTowards',
  category: NodeCategory.Effect,
  label: 'Move Towards',
  in: {
    flow: 'flow',
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    targetX: 'float',
    targetY: 'float',
    targetZ: 'float',
    speed: 'float',
    deltaSeconds: 'float'
  },
  out: {
    ongoing: 'flow',
    done: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const meshName = read<string>('meshName');
    const targetX = read<number>('targetX');
    const targetY = read<number>('targetY');
    const targetZ = read<number>('targetZ');
    const speed = read<number>('speed');
    const deltaSeconds = read<number>('deltaSeconds');

    const arrived = scene?.moveTowards(
      meshName,
      { x: targetX, y: targetY, z: targetZ },
      speed,
      deltaSeconds
    );

    if (arrived) {
      commit('done');
    } else {
      commit('ongoing');
    }
  }
});
