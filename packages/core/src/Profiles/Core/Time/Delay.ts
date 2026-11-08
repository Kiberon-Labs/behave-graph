import { makeAsyncNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

const pendingDelays = new WeakMap<
  object,
  { timeout: ReturnType<typeof setTimeout>; finish: () => void }
>();

// New format
export const Delay = makeAsyncNodeDefinition({
  typeName: 'time/delay',
  otherTypeNames: ['flow/delay'],
  category: NodeCategory.Time,
  label: 'Delay',
  in: {
    flow: {
      valueType: 'flow'
    },
    duration: {
      valueType: 'float',
      defaultValue: 1
    }
  },
  out: {
    flow: 'flow'
  },
  initialState: {
    timeoutPending: false
  },
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  triggered: async ({ state, finished = () => {}, commit, read }) => {
    // if there is a valid timeout running, leave it.
    if (state.timeoutPending) {
      // Suppression completes this invocation; the existing timer owns its
      // own completion callback and still commits only once.
      finished();
      return;
    }

    state.timeoutPending = true;

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pendingDelays.delete(state);
      finished();
    };
    const timeout = setTimeout(() => {
      state.timeoutPending = false;
      try {
        commit('flow');
      } finally {
        finish();
      }
    }, read<number>('duration'));
    pendingDelays.set(state, { timeout, finish });
  },
  dispose: ({ state }) => {
    state.timeoutPending = false;
    const pending = pendingDelays.get(state);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.finish();
    }
    return { timeoutPending: false };
  }
});
