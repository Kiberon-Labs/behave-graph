import type { ReactFlowInstance } from 'reactflow';
import { create, useStore, type StoreApi } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type Refs = {
  reactflow: ReactFlowInstance;
};

export type RefStore = {
  refs: Refs;
  setRef: <T extends keyof Refs>(key: T, ref: Refs[T]) => void;
  getRef: <T extends keyof Refs>(key: T) => Refs[T] | undefined;
  removeRef: (key: keyof Refs) => void;
  hasRef: (key: keyof Refs) => boolean;
};

export const refStoreFactory = () =>
  create<RefStore>()(
    subscribeWithSelector((set, get) => ({
      refs: {} as Refs,

      setRef: <T extends keyof Refs>(key: T, ref: Refs[T]) => {
        set((state) => ({
          refs: {
            ...state.refs,
            [key]: ref
          }
        }));
      },

      getRef: <T extends keyof Refs>(key: T) => {
        return get().refs[key] as Refs[T] | undefined;
      },

      removeRef: (key: keyof Refs) => {
        set((state) => {
          const { [key]: _, ...rest } = state.refs;
          return { refs: rest as Refs };
        });
      },

      hasRef: (key: string) => {
        return key in get().refs;
      }
    }))
  );

/**
 * Subscribe to changes of a specific ref
 * @param store - The ref store
 * @param key - The key of the ref to watch
 * @param callback - Callback fired when the ref changes
 * @returns Unsubscribe function
 */
export function subscribeToRef<T extends keyof Refs>(
  store: StoreApi<RefStore>,
  key: T,
  callback: (ref: Refs[T] | undefined) => void
) {
  return store.subscribe((state, prevState) => {
    const current = state.refs[key] as Refs[T] | undefined;
    const previous = prevState.refs[key] as Refs[T] | undefined;
    if (current !== previous) {
      return current;
    }
    callback(current);
  });
}

/**
 * Hook to access the current value of a ref from the store
 * @param store - The ref store
 * @param key - The key of the ref
 * @returns The current value of the ref or null
 */
export function useRefFromStore<T extends keyof Refs>(
  store: StoreApi<RefStore>,
  key: T
): Refs[T] | undefined {
  return useStore(store, (state) => state.refs[key] as Refs[T] | undefined);
}
