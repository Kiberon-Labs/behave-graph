import { makeAsyncNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

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
      return;
    }

    state.timeoutPending = true;

    setTimeout(async () => {
      // check if cancelled
      if (!state.timeoutPending) return;

      state.timeoutPending = false;
      commit('flow');
      finished();
    }, read<number>('duration'));
  },
  dispose: () => {
    return {
      timeoutPending: false
    };
  }
});
