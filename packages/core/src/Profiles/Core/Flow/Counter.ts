import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

export const Counter = makeFlowNodeDefinition({
  typeName: 'flow/counter',
  label: 'Counter',
  in: {
    flow: 'flow',
    reset: 'flow'
  },
  out: {
    flow: 'flow',
    count: 'integer'
  },
  initialState: {
    count: 0
  },
  category: NodeCategory.Flow,
  triggered: ({ commit, write, triggeringSocketName, state }) => {
    switch (triggeringSocketName) {
      case 'flow': {
        state.count++;
        // through type enforcement, write and commit can only write to one of the keys of `out`
        write('count', state.count);
        commit('flow');
        break;
      }
      case 'reset': {
        state.count = 0;
        break;
      }
      default:
        throw new Error('should not get here');
    }
  }
});
