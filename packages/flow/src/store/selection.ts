import type { GraphSession } from '@/system/graphSession';
import { create } from 'zustand';

export type SelectionStore = {
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
};

export const selectionStoreFactory = (session: GraphSession) => {
  const store = create<SelectionStore>((set) => ({
    selectedNodeId: null,
    setSelectedNodeId: (selectedNodeId: string | null) =>
      set(() => ({ selectedNodeId }))
  }));
  //Track side effect of selected node in the node store
  session.nodeStore.subscribe((state) => {
    const selectedNode = state.nodes.find((n) => n.selected);
    store.getState().setSelectedNodeId(selectedNode?.id ?? null);
  });

  return store;
};
