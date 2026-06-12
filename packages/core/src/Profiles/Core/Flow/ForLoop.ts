import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';

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
  // The loop cursor lives in node state (not a closure) so that suspension
  // mechanisms can serialize it and resume the loop mid-iteration. It is kept
  // as a number to stay JSON-serializable.
  initialState: { nextIndex: null as number | null },
  triggered: ({ read, write, commit, state }) => {
    const endIndex = read<bigint>('endIndex');

    // a fresh run starts at startIndex; a rehydrated run resumes mid-loop
    if (state.nextIndex === null) {
      state.nextIndex = Number(read<bigint>('startIndex'));
    }

    const loopBodyIteration = () => {
      const i = state.nextIndex;
      if (i !== null && BigInt(i) < endIndex) {
        write('index', BigInt(i));
        state.nextIndex = i + 1;
        commit('loopBody', () => {
          loopBodyIteration();
        });
      } else {
        state.nextIndex = null;
        commit('completed');
      }
    };
    loopBodyIteration();
  }
});
