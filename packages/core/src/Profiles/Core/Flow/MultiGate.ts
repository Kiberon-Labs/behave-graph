import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '@/Nodes/Registry/NodeCategory.js';
// https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/UserGuide/flow/

export const MultiGate = makeFlowNodeDefinition({
  typeName: 'flow/multiGate',
  category: NodeCategory.Flow,
  label: 'MultiGate',
  in: {
    flow: 'flow',
    reset: 'flow',
    loop: 'boolean',
    startIndex: 'integer'
  },
  out: {
    1: 'flow',
    2: 'flow',
    3: 'flow'
  },
  initialState: {
    isInitialized: false,
    nextIndex: 0
  },
  triggered: ({
    state,
    commit,
    read,
    outputSocketKeys,
    triggeringSocketName
  }) => {
    let nextIndex = state.nextIndex;
    let isInitialized = state.isInitialized;
    if (!isInitialized) {
      nextIndex = Number(read('startIndex'));
      isInitialized = true;
    }

    if (read<boolean>('loop')) {
      nextIndex = nextIndex % outputSocketKeys.length;
    }

    switch (triggeringSocketName) {
      case 'reset': {
        nextIndex = 0;
        state.isInitialized = isInitialized;
        state.nextIndex = nextIndex;
        return;
      }
      case 'flow': {
        if (0 <= nextIndex && nextIndex < outputSocketKeys.length) {
          const output = outputSocketKeys[nextIndex]!;
          commit(output);
        }
        nextIndex++;
        state.isInitialized = isInitialized;
        state.nextIndex = nextIndex;
        return;
      }
    }
  }
});
