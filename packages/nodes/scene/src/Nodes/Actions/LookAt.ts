import type { Vec3 } from '@/Values/Internal/Vec3';
import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

// Orient a mesh to face a world-space target position.
export const LookAt = makeFlowNodeDefinition({
  typeName: 'scene/lookAt',
  category: NodeCategory.Effect,
  label: 'Look At',
  in: {
    flow: 'flow',
    meshName: (_, graphApi) => {
      const scene = graphApi.getDependency('IScene');
      return {
        valueType: 'string',
        choices: scene?.getMeshNames()
      };
    },
    target: 'vec3'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const meshName = read<string>('meshName');
    const target = read<Vec3>('target');
    scene?.lookAt(meshName, { x: target.x, y: target.y, z: target.z });
    commit('flow');
  }
});
