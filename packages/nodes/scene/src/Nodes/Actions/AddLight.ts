import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

import { LightType } from '../../Abstractions/IScene.js';

const lightTypeChoices = Object.values(LightType).map((v) => ({
  text: v,
  value: v
}));

export const AddLight = makeFlowNodeDefinition({
  typeName: 'scene/addLight',
  category: NodeCategory.Effect,
  label: 'Add Light',
  in: {
    flow: 'flow',
    name: 'string',
    lightType: (_) => ({
      valueType: 'string',
      choices: lightTypeChoices
    }),
    color: 'color',
    intensity: 'float'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ commit, read, graph }) => {
    const scene = graph.getDependency('IScene');
    const name = read<string>('name');
    const lightType = read<string>('lightType');
    const color = read<{ r: number; g: number; b: number }>('color');
    const intensity = read<number>('intensity');

    scene?.addLight(
      name,
      lightType as (typeof LightType)[keyof typeof LightType],
      color,
      intensity
    );
    commit('flow');
  }
});
