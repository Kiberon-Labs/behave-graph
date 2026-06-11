import {
  makeFunctionNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

export const GetSceneProperty = (valueTypeNames: string[]) =>
  valueTypeNames.map((valueTypeName) =>
    makeFunctionNodeDefinition({
      typeName: `scene/get/${valueTypeName}`,
      category: NodeCategory.Query,
      label: `Scene get ${valueTypeName}`,
      in: {
        jsonPath: (_, graphApi) => {
          const scene = graphApi.getDependency('IScene');

          return {
            valueType: 'string',
            choices: scene?.getProperties(valueTypeName)
          };
        }
      },
      out: {
        value: valueTypeName
      },
      exec: ({ graph, read, write }) => {
        const scene = graph.getDependency('IScene');
        const propertyValue = scene?.getProperty(
          read('jsonPath'),
          valueTypeName
        );
        write('value', propertyValue);
      }
    })
  );
