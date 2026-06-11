import { createStore } from 'zustand';

export interface LocalGraphRunnerStore {
  // Execution settings
  executionSpeed: number; // Multiplier for execution speed (1.0 = normal)
  stepDelay: number; // Delay in milliseconds between steps
  tickInterval: number; // Delay in milliseconds between tick events

  // Runtime state
  isExecuting: boolean;
  isPaused: boolean;
  activeRuns: number;

  // Actions
  setExecutionSpeed: (speed: number) => void;
  setStepDelay: (delay: number) => void;
  setTickInterval: (interval: number) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setActiveRuns: (count: number) => void;
}

export const localGraphRunnerStoreFactory = () => {
  return createStore<LocalGraphRunnerStore>((set) => ({
    // Initial state
    executionSpeed: 1.0,
    stepDelay: 0,
    tickInterval: 50,
    isExecuting: false,
    isPaused: false,
    activeRuns: 0,

    // Actions
    setExecutionSpeed: (executionSpeed) => set({ executionSpeed }),
    setStepDelay: (stepDelay) => set({ stepDelay }),
    setTickInterval: (tickInterval) => set({ tickInterval }),
    setIsExecuting: (isExecuting) => set({ isExecuting }),
    setIsPaused: (isPaused) => set({ isPaused }),
    setActiveRuns: (activeRuns) => set({ activeRuns })
  }));
};
