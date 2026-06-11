import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

import { GeometryType } from '../../Abstractions/IScene.js';

const geometryChoices = Object.values(GeometryType).map((v) => ({
  text: v,
  value: v
}));

export const CreateMesh = makeFlowNodeDefinition({
  typeName: 'scene/createMesh',
  category: NodeCategory.Effect,
  label: 'Create Mesh',
  in: {
    flow: 'flow',
    name: 'string',
    geometryType: (_) => ({
      valueType: 'string',
      choices: geometryChoices
    }),
    sizeX: 'float',
    sizeY: 'float',
    sizeZ: 'float'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const name = read<string>('name');
    const geometryType = read<string>('geometryType');
    const sizeX = read<number>('sizeX');
    const sizeY = read<number>('sizeY');
    const sizeZ = read<number>('sizeZ');

    scene?.createMesh(
      name,
      geometryType as (typeof GeometryType)[keyof typeof GeometryType],
      { x: sizeX, y: sizeY, z: sizeZ }
    );
    commit('flow');
  }
});
