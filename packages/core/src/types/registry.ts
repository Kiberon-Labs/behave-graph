import type { IStateService } from '../Nodes/Node.js';
import type { NodeDefinitionsMap } from '../Nodes/Registry/NodeDefinitionsMap.js';
import type { ILifecycleEventEmitter } from '../Profiles/Core/Abstractions/ILifecycleEventEmitter.js';
import type { ILogger } from '../Profiles/Core/Abstractions/ILogger.js';
import type { ValueTypeMap } from '../Values/ValueTypeMap.js';

export interface Dependencies {
  ILogger: ILogger;
  ILifecycleEventEmitter: ILifecycleEventEmitter;
  IStateService?: IStateService;
}

export interface IRegistry {
  readonly values: ValueTypeMap;
  readonly nodes: NodeDefinitionsMap;
  readonly dependencies: Dependencies;
}

export interface IQueryableRegistry<T> {
  get: (id: string) => T | undefined;
  getAll: () => T[];
  getAllNames: () => string[];
  contains: (id: string) => boolean;
}
