import type { NodeDefinitionsMap } from './Nodes/Registry/NodeDefinitionsMap.js';
import type { ValueTypeMap } from './Values/ValueTypeMap.js';

export interface IRegistry<Deps = Record<string, unknown>> {
  readonly values: ValueTypeMap;
  readonly nodes: NodeDefinitionsMap;
  readonly dependencies: Deps;
}

export interface IQueryableRegistry<T> {
  get: (id: string) => T | undefined;
  getAll: () => T[];
  getAllNames: () => string[];
  contains: (id: string) => boolean;
}
