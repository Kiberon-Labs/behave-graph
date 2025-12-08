import type {
  IRegistry,
  NodeDefinitionsMap,
  ValueTypeMap
} from '@kinforge/behave-graph';
import { create } from 'zustand';

export type RegistryStore = {
  readonly values: ValueTypeMap;
  readonly nodes: NodeDefinitionsMap;
  readonly dependencies: Record<string, unknown>;

  getRegistry: () => IRegistry;
  updateValues: (registry: IRegistry) => void;
};

export const registryStoreFactory = () =>
  create<RegistryStore>((set, get) => ({
    values: {},
    nodes: {},
    dependencies: {},

    getRegistry: (): IRegistry => {
      const state = get();
      return {
        values: state.values,
        nodes: state.nodes,
        dependencies: state.dependencies
      };
    },

    updateValues: (registry: IRegistry) =>
      set((x) => ({
        values: { ...x.values, ...registry.values },
        nodes: { ...x.nodes, ...registry.nodes },
        dependencies: { ...x.dependencies, ...registry.dependencies }
      }))
  }));
