import type { SocketsList } from '~/types/socket.js';
import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';

// https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/UserGuide/flow/

export const Sequence = makeFlowNodeDefinition({
  typeName: 'flow/sequence',
  label: 'Sequence',
  configuration: {
    numOutputs: {
      valueType: 'number'
    }
  },
  in: {
    flow: 'flow'
  },
  out: (configuration) => {
    const numOutputs = configuration.numOutputs;
    const sockets: SocketsList = [];

    for (let outputIndex = 1; outputIndex <= numOutputs; outputIndex++) {
      const key = `${outputIndex}`;

      sockets.push({
        key,
        valueType: 'flow'
      });
    }

    return sockets;
  },
  // The sequence cursor lives in node state (not a closure) so that suspension
  // mechanisms can serialize it and resume from the next un-fired output.
  initialState: { nextIndex: null as number | null },
  triggered: ({ commit, outputSocketKeys, state }) => {
    // these outputs are fired sequentially in an sync fashion but without delays.
    // Thus a promise is returned and it continually returns a promise until each of the sequences has been executed.
    if (state.nextIndex === null) {
      state.nextIndex = 0;
    }

    const sequenceIteration = () => {
      const i = state.nextIndex;
      if (i !== null && i < outputSocketKeys.length) {
        const outputKey = outputSocketKeys[i];
        state.nextIndex = i + 1;
        commit(outputKey, () => {
          sequenceIteration();
        });
      } else {
        state.nextIndex = null;
      }
    };
    sequenceIteration();
  }
});
