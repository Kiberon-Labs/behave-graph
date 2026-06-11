import { create } from 'zustand';
import type React from 'react';

/**
 * Documentation metadata for a node type
 */
export type NodeDocumentation = {
  /** The node type this documentation applies to */
  type: string;
  /** Optional icon to display for the node */
  icon?: React.ReactNode;
  /** Short description (one line) */
  shortDescription?: string;
  /** Tags for categorization and search */
  tags?: string[];
  /** Long rich markdown description */
  markdownDescription?: string;
};

export type DocumentationStore = {
  /** Map of node type to documentation */
  docs: Map<string, NodeDocumentation>;
  /** Set documentation for a specific node type */
  setDocumentation: (
    type: string,
    doc: Omit<NodeDocumentation, 'type'>
  ) => void;
  /** Set documentation for multiple node types at once */
  setMultipleDocumentation: (docs: NodeDocumentation[]) => void;
  /** Get documentation for a specific node type */
  getDocumentation: (type: string) => NodeDocumentation | undefined;
  /** Clear all documentation */
  clearDocumentation: () => void;
  /** Remove documentation for a specific type */
  removeDocumentation: (type: string) => void;
};

export const documentationStoreFactory = () => {
  return create<DocumentationStore>((set, get) => ({
    docs: new Map(),

    setDocumentation: (type: string, doc: Omit<NodeDocumentation, 'type'>) =>
      set((state) => {
        const newDocs = new Map(state.docs);
        newDocs.set(type, { type, ...doc });
        return { docs: newDocs };
      }),

    setMultipleDocumentation: (docs: NodeDocumentation[]) =>
      set((state) => {
        const newDocs = new Map(state.docs);
        for (const doc of docs) {
          newDocs.set(doc.type, doc);
        }
        return { docs: newDocs };
      }),

    getDocumentation: (type: string) => get().docs.get(type),

    clearDocumentation: () => set({ docs: new Map() }),

    removeDocumentation: (type: string) =>
      set((state) => {
        const newDocs = new Map(state.docs);
        newDocs.delete(type);
        return { docs: newDocs };
      })
  }));
};
