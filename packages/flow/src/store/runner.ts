import type { Engine } from '@kinforge/behave-graph';
import { create } from 'zustand';
import type { System } from '@/system';

export type RunnerStore = {
  playing: boolean;
  engine?: Engine;
  setPlaying: (playing: boolean) => void;
  setEngine: (engine?: Engine) => void;
};

export const runnerStoreFactory = (_system: System) =>
  create<RunnerStore>((set) => ({
    playing: false,
    engine: undefined,
    setPlaying: (playing: boolean) => set({ playing }),
    setEngine: (engine?: Engine) => set({ engine })
  }));
