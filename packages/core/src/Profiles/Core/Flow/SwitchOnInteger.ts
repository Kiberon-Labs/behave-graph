import type { SocketsList } from '~/types/socket.js';
import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { sequence } from '../../../utils/sequence.js';

// https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/UserGuide/flow/

export const SwitchOnInteger = makeFlowNodeDefinition({
  typeName: 'flow/switch/integer',
  label: 'Switch on Int',
  configuration: {
    numCases: {
      valueType: 'number'
    },
    cases: {
      valueType: 'object'
    }
  },
  in: (configuration) => {
    const sockets: SocketsList = [
      { key: 'flow', valueType: 'flow' },
      { key: 'selection', valueType: 'integer' }
    ];
    const cases =
      (configuration.cases as Record<string, bigint> | undefined) ?? {};
    for (const index of sequence(1, configuration.numCases + 1)) {
      sockets.push({
        key: `${index}`,
        valueType: 'integer',
        //Expected to be overridden by node data ports if provided
        defaultValue: cases[`${index}`] ?? undefined
      });
    }
    return sockets;
  },
  out: (configuration) => {
    const sockets: SocketsList = [];

    sockets.push({ key: 'default', valueType: 'flow' });
    for (const index of sequence(1, configuration.numCases + 1)) {
      sockets.push({ key: `${index}`, valueType: 'flow' });
    }

    return sockets;
  },
  initialState: undefined,
  triggered: ({ read, commit, configuration }) => {
    const selection = read<bigint>('selection');

    for (const index of sequence(1, configuration.numCases + 1)) {
      const caseValue = read<bigint>(`${index}`);
      if (selection === caseValue) {
        commit(`${index}`);
        return;
      }
    }
    commit('default');
  }
});
