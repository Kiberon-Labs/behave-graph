import type { System } from '@/system';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import { create } from 'zustand';

export type SpecsStore = {
  specs: NodeSpecJSON[];
  specDict: Record<string, NodeSpecJSON>;
  setSpecs: (specs: NodeSpecJSON[]) => void;
};

export const specsStoreFactory = (sys: System) => {
  const store = create<SpecsStore>((set) => ({
    specs: [],
    specDict: {},
    setSpecs: (specs: NodeSpecJSON[]) =>
      set(() => ({
        specs,
        specDict: specs.reduce(
          (dict, spec) => {
            dict[spec.type] = spec;
            return dict;
          },
          {} as Record<string, NodeSpecJSON>
        )
      }))
  }));

  // Subscribe to registry changes to sync specs
  sys.registry.subscribe((registryState) => {
    const registry = registryState.getRegistry();
    store.getState().setSpecs(registry.specs);
  });

  return store;
};
