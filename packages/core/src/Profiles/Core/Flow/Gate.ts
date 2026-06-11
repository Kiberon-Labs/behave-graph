import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

// based on Unreal Engine Blueprint Gate node

// The flow socket is similar to the enter socket.

export const Gate = makeFlowNodeDefinition({
  typeName: 'flow/gate',
  label: 'Gate',
  category: NodeCategory.Flow,
  in: {
    flow: 'flow',
    open: 'flow',
    close: 'flow',
    toggle: 'flow',
    startClosed: 'boolean'
  },
  out: {
    flow: 'flow'
  },
  initialState: {
    isInitialized: false,
    isClosed: true
  },
  triggered: ({ commit, read, triggeringSocketName, state }) => {
    if (!state.isInitialized) {
      state.isClosed = !!read('startClosed');
      state.isInitialized = true;
    }

    switch (triggeringSocketName) {
      case 'flow':
        if (!state.isClosed) {
          commit('flow');
        }
        break;
      case 'open':
        state.isClosed = false;
        break;
      case 'close':
        state.isClosed = true;
        break;
      case 'toggle':
        state.isClosed = !state.isClosed;
        break;
      default:
        throw new Error(
          `Unexpected triggering socket: ${triggeringSocketName}`
        );
    }
  }
});
