import type { localGraphRunnerStoreFactory } from './store';

/**
 * Extend the System interface to include the local graph runner store
 */
declare module '@/system/system' {
  interface System {
    localGraphRunnerStore: ReturnType<typeof localGraphRunnerStoreFactory>;
  }
}
