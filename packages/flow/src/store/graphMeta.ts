import { create, type StoreApi } from 'zustand';

/**
 * Reactive graph-level properties for a single {@link GraphSession}: the display
 * name (also the tab title) and an arbitrary metadata bag (the graph
 * annotations). Backed by a store so the Graph Properties panel, the tab title
 * and anything else stay in sync.
 */
export type GraphMetaStore = {
  name: string;
  metadata: Record<string, any>;
  setName: (name: string) => void;
  /** Replace the whole metadata bag. */
  setMetadata: (metadata: Record<string, any>) => void;
  /** Shallow-merge into the metadata bag. */
  mergeMetadata: (partial: Record<string, any>) => void;
  setMetadataValue: (key: string, value: any) => void;
  removeMetadataKey: (key: string) => void;
};

export const graphMetaStoreFactory = (
  name = 'Graph'
): StoreApi<GraphMetaStore> =>
  create<GraphMetaStore>((set) => ({
    name,
    metadata: {},
    setName: (name) => set({ name }),
    setMetadata: (metadata) => set({ metadata: { ...metadata } }),
    mergeMetadata: (partial) =>
      set((s) => ({ metadata: { ...s.metadata, ...partial } })),
    setMetadataValue: (key, value) =>
      set((s) => ({ metadata: { ...s.metadata, [key]: value } })),
    removeMetadataKey: (key) =>
      set((s) => {
        const next = { ...s.metadata };
        delete next[key];
        return { metadata: next };
      })
  }));
