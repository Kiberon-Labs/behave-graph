import { create } from 'zustand';

export type SelectionStore = {
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
};

export const selectionStoreFactory = () =>
  create<SelectionStore>((set) => ({
    selectedNodeId: null,
    setSelectedNodeId: (selectedNodeId: string | null) =>
      set(() => ({ selectedNodeId }))
  }));
