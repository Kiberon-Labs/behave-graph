import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '~/Nodes/Registry/NodeCategory.js';

export const ForLoop = makeFlowNodeDefinition({
  typeName: 'flow/forLoop',
  category: NodeCategory.Flow,
  label: 'For Loop',
  in: {
    flow: 'flow',
    startIndex: 'integer',
    endIndex: 'integer'
  },
  out: {
    loopBody: 'flow',
    index: 'integer',
    completed: 'flow'
  },
  initialState: undefined,
  triggered: ({ read, write, commit }) => {
    const startIndex = read<bigint>('startIndex');
    const endIndex = read<bigint>('endIndex');
    const loopBodyIteration = (i: bigint) => {
      if (i < endIndex) {
        write('index', i);
        commit('loopBody', () => {
          loopBodyIteration(i + BigInt(1));
        });
      } else {
        commit('completed');
      }
    };
    loopBodyIteration(startIndex);
  }
});
