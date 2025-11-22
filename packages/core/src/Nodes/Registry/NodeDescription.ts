import type { IGraph } from '../../Graphs/Graph.js';
import type {
  IHasNodeFactory,
  INodeDefinition,
  NodeFactory
} from '../NodeDefinitions.js';
import type { INode } from '../NodeInstance.js';
import type { NodeConfiguration } from './../Node.js';
import { type NodeCategoryType } from './NodeCategory.js';

export type NodeConfigurationDescription = {
  [key: string]: {
    valueType: string;
    defaultValue?: any;
    choices?: string[];
  };
};

export function getNodeDescriptions(importWildcard: {
  [key: string]: INodeDefinition;
}): INodeDefinition[] {
  return Object.values(importWildcard) as INodeDefinition[];
}

export interface INodeDescription {
  readonly typeName: string;
  readonly category: NodeCategoryType | string;
  readonly label: string;
  readonly otherTypeNames: string[];
  readonly helpDescription: string;
  readonly configuration: NodeConfigurationDescription;
}

export type NodeFactoryWithDescription = (
  entry: NodeDescription,
  graph: IGraph,
  config: NodeConfiguration,
  id: string
) => INode;

export class NodeDescription implements INodeDescription, IHasNodeFactory {
  nodeFactory: NodeFactory;

  readonly typeName: string;
  readonly category: NodeCategoryType | string;
  readonly label: string;

  readonly otherTypeNames: string[];
  readonly helpDescription: string;

  readonly configuration: NodeConfigurationDescription;
  constructor(
    typeName: string,
    category: NodeCategoryType | string,
    label: string = '',
    factory: NodeFactoryWithDescription,
    otherTypeNames: string[] = [],
    helpDescription: string = '',

    configuration: NodeConfigurationDescription = {}
  ) {
    this.typeName = typeName;
    this.category = category;
    this.label = label;
    this.otherTypeNames = otherTypeNames;
    this.helpDescription = helpDescription;
    this.configuration = configuration;
    this.nodeFactory = (graph, config, id) => factory(this, graph, config, id);
  }
}

export class NodeDescription2 extends NodeDescription {
  constructor(properties: {
    typeName: string;
    category: NodeCategoryType | string;
    label?: string;
    configuration?: NodeConfigurationDescription;
    factory: NodeFactoryWithDescription;
    otherTypeNames?: string[];
    helpDescription?: string;
  }) {
    super(
      properties.typeName,
      properties.category,
      properties.label,
      properties.factory,
      properties.otherTypeNames,
      properties.helpDescription,
      properties.configuration
    );
  }
}
