/**
 * Type definitions for Web Worker Graph Runner
 */

import type { StoreApi } from 'zustand';
import type { WebWorkerGraphRunnerStore } from './store.js';

declare module '@/system/system' {
  interface System {
    /**
     * Web Worker Graph Runner store
     */
    webWorkerGraphRunnerStore: StoreApi<WebWorkerGraphRunnerStore>;
  }
}

export type { WebWorkerGraphRunnerStore };
