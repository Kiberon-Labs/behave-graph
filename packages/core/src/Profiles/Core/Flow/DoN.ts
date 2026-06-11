import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

// based on Unreal Engine Blueprint DoN node

export const DoN = makeFlowNodeDefinition({
  typeName: 'flow/doN',
  label: 'DoN',
  category: NodeCategory.Flow,
  in: {
    flow: 'flow',
    n: {
      valueType: 'integer',
      defaultValue: 1
    },
    reset: 'flow'
  },
  out: {
    flow: 'flow',
    count: 'integer'
  },
  initialState: {
    count: 0
  },
  triggered: ({ commit, read, write, triggeringSocketName, state }) => {
    if (triggeringSocketName === 'reset') {
      state.count = 0;
      return;
    }

    if (state.count < Number(read('n'))) {
      write('count', state.count);
      commit('flow');
      state.count++;
      return;
    }
  }
});
