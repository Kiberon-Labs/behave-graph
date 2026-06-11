import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

export const SetSceneProperty = (valueTypeNames: string[]) =>
  valueTypeNames.map((valueTypeName) =>
    makeFlowNodeDefinition({
      typeName: `scene/set/${valueTypeName}`,
      category: NodeCategory.Effect,
      label: `Set Scene ${valueTypeName}`,
      in: {
        jsonPath: (_, graphApi) => {
          const scene = graphApi.getDependency('IScene');
          return {
            valueType: 'string',
            choices: scene?.getProperties(valueTypeName)
          };
        },
        value: valueTypeName,
        flow: 'flow'
      },
      out: {
        flow: 'flow'
      },
      initialState: undefined,
      triggered: ({ commit, read, graph }) => {
        const scene = graph.getDependency('IScene');
        scene?.setProperty(read('jsonPath'), valueTypeName, read('value'));
        commit('flow');
      }
    })
  );
