import type { IHasNodeFactory, INodeDefinition } from '../NodeDefinitions.js';

export type NodeDefinition = IHasNodeFactory &
  Pick<INodeDefinition, 'typeName' | 'otherTypeNames' | 'configuration'>;

export type NodeDefinitionsMap = {
  readonly [type: string]: NodeDefinition;
};
