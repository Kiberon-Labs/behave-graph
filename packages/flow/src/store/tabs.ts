import { create } from 'zustand';

export type TabStore = {
  currentPanel?: string;
  setCurrentPanel: (currentPanel: string) => void;
};

export const tabStoreFactory = () =>
  create<TabStore>((set) => ({
    currentPanel: 'string',
    setCurrentPanel: (currentPanel: string) => set(() => ({ currentPanel }))
  }));
