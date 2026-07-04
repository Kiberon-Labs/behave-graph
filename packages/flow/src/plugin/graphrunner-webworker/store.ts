/**
 * Store for Web Worker Graph Runner state
 */

import { create, type StoreApi } from 'zustand';

export type WebWorkerGraphRunnerStore = {
  /**
   * Number of active graph runs in the worker
   */
  activeRuns: number;

  /**
   * Whether a graph is currently executing
   */
  isExecuting: boolean;

  /**
   * Whether execution is paused
   */
  isPaused: boolean;

  /**
   * Tick interval in milliseconds (for tick events)
   * Default: 50ms
   */
  tickInterval: number;

  /**
   * Step delay in milliseconds (between execution steps)
   * Default: 0ms (no delay)
   */
  stepDelay: number;

  /**
   * Execution speed multiplier
   * 1.0 = normal speed, 0.5 = half speed, 2.0 = double speed
   * Default: 1.0
   */
  executionSpeed: number;

  /**
   * Set the number of active runs
   */
  setActiveRuns: (count: number) => void;

  /**
   * Set execution state
   */
  setIsExecuting: (isExecuting: boolean) => void;

  /**
   * Set pause state
   */
  setIsPaused: (isPaused: boolean) => void;

  /**
   * Set tick interval
   */
  setTickInterval: (interval: number) => void;

  /**
   * Set step delay
   */
  setStepDelay: (delay: number) => void;

  /**
   * Set execution speed
   */
  setExecutionSpeed: (speed: number) => void;
};

export const webWorkerGraphRunnerStoreFactory =
  (): StoreApi<WebWorkerGraphRunnerStore> =>
    create<WebWorkerGraphRunnerStore>((set) => ({
      activeRuns: 0,
      isExecuting: false,
      isPaused: false,
      tickInterval: 50,
      stepDelay: 0,
      executionSpeed: 1.0,

      setActiveRuns: (count) => set({ activeRuns: count }),
      setIsExecuting: (isExecuting) => set({ isExecuting }),
      setIsPaused: (isPaused) => set({ isPaused }),
      setTickInterval: (interval) => set({ tickInterval: interval }),
      setStepDelay: (delay) => set({ stepDelay: delay }),
      setExecutionSpeed: (speed) => set({ executionSpeed: speed })
    }));

declare module '@/system/system' {
  interface System {
    /**
     * Web Worker Graph Runner store
     */
    webWorkerGraphRunnerStore: StoreApi<WebWorkerGraphRunnerStore>;
  }
}
