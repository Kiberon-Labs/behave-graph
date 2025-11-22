import type { NodeCategoryType } from '~/Nodes/Registry/NodeCategory.js';
import type { NodeConfiguration } from '../../Nodes/Node.js';
import type { IRegistry } from '../../Registry.js';
import type { Choices } from '../../Sockets/Socket.js';
import { createNode, makeGraphApi } from '../Graph.js';
import type {
  ChoiceJSON,
  ConfigurationSpecJSON,
  InputSocketSpecJSON,
  NodeSpecJSON,
  OutputSocketSpecJSON
} from './NodeSpecJSON.js';

function toChoices(valueChoices: Choices | undefined): ChoiceJSON | undefined {
  return valueChoices?.map((choice) => {
    if (typeof choice === 'string') return { text: choice, value: choice };
    return choice;
  });
}

function writeConfigurationToJSON(
  configuration: NodeConfiguration
): ConfigurationSpecJSON[] {
  return Object.entries(configuration).map(([name, configuration]) => {
    const configurationSpecJSON: ConfigurationSpecJSON = {
      name,
      valueType: configuration.valueType,
      defaultValue: configuration.defaultValue
    };

    return configurationSpecJSON;
  });
}

export function writeNodeSpecsToJSON(registry: IRegistry): NodeSpecJSON[] {
  const nodeSpecsJSON: NodeSpecJSON[] = [];

  // const graph = new Graph(registry);

  const graph = makeGraphApi({
    ...registry,
    customEvents: {},
    variables: {}
  });

  Object.entries(registry.nodes).forEach(([nodeTypeName, nodeDefinition]) => {
    const { configuration } = nodeDefinition;
    const node = createNode({
      id: '0',
      graph,
      registry,
      nodeTypeName,
      nodeConfiguration: configuration
    });

    const nodeSpecJSON: NodeSpecJSON = {
      type: nodeTypeName,
      category: node.description.category as NodeCategoryType,
      label: node.description.label,
      inputs: [],
      outputs: [],
      configuration: writeConfigurationToJSON(node.configuration)
    };

    node.inputs.forEach((inputSocket) => {
      const valueType =
        inputSocket.valueTypeName === 'flow'
          ? undefined
          : registry.values[inputSocket.valueTypeName];

      let defaultValue = inputSocket.value;
      if (valueType !== undefined) {
        defaultValue = valueType.serialize(defaultValue);
      }
      if (defaultValue === undefined && valueType !== undefined) {
        defaultValue = valueType.serialize(valueType.creator());
      }
      const socketSpecJSON: InputSocketSpecJSON = {
        name: inputSocket.name,
        valueType: inputSocket.valueTypeName,
        defaultValue,
        choices: toChoices(inputSocket.valueChoices)
      };
      nodeSpecJSON.inputs.push(socketSpecJSON);
    });

    node.outputs.forEach((outputSocket) => {
      const socketSpecJSON: OutputSocketSpecJSON = {
        name: outputSocket.name,
        valueType: outputSocket.valueTypeName
      };
      nodeSpecJSON.outputs.push(socketSpecJSON);
    });

    nodeSpecsJSON.push(nodeSpecJSON);
  });

  return nodeSpecsJSON;
}
