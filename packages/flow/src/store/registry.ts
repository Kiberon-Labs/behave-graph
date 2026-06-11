import { create } from 'zustand';
import type { INodeRegistry, ValueTypeMetadata } from '../types/NodeMetadata';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

export type RegistryStore = {
  readonly values: Record<string, ValueTypeMetadata>;
  readonly specs: NodeSpecJSON[];

  getRegistry: () => INodeRegistry;
  updateRegistry: (registry: INodeRegistry) => void;
  updateValues: (values: Record<string, ValueTypeMetadata>) => void;
  updateSpecs: (specs: NodeSpecJSON[]) => void;
};

export const registryStoreFactory = () =>
  create<RegistryStore>((set, get) => ({
    values: {},
    specs: [],

    getRegistry: (): INodeRegistry => {
      const state = get();
      return {
        values: state.values,
        specs: state.specs
      };
    },

    updateRegistry: (registry: INodeRegistry) =>
      set((x) => ({
        values: { ...x.values, ...registry.values },
        specs: [...registry.specs]
      })),

    updateValues: (values: Record<string, ValueTypeMetadata>) =>
      set((x) => ({
        values: { ...x.values, ...values }
      })),

    updateSpecs: (specs: NodeSpecJSON[]) =>
      set(() => ({
        specs
      }))
  }));
