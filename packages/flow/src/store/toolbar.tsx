import { createStore } from 'zustand';
import React from 'react';

export type ToolbarButtonGroup = {
  id: string;
  label?: string;
  buttons: (ToolbarButton | React.ReactNode)[];
};

export type ToolbarButton = {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean | (() => boolean);
};

export type ToolbarStore = {
  visible: boolean;
  setVisible: (visible: boolean) => void;
  groups: ToolbarButtonGroup[];
  setGroups: (groups: ToolbarButtonGroup[]) => void;
  addGroup: (group: ToolbarButtonGroup) => void;
  removeGroup: (groupId: string) => void;
  updateGroup: (groupId: string, group: Partial<ToolbarButtonGroup>) => void;
};

export const toolbarStoreFactory = () =>
  createStore<ToolbarStore>((set) => ({
    visible: true,
    setVisible: (visible) => set({ visible }),
    groups: [],
    setGroups: (groups) => set({ groups }),
    addGroup: (group) => set((state) => ({ groups: [...state.groups, group] })),
    removeGroup: (groupId) =>
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== groupId)
      })),
    updateGroup: (groupId, updates) =>
      set((state) => ({
        groups: state.groups.map((g) =>
          g.id === groupId ? { ...g, ...updates } : g
        )
      }))
  }));
