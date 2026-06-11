import type { SocketsList } from '~/types/socket.js';
import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { sequence } from '../../../utils/sequence.js';

// https://docs.unrealengine.com/4.27/en-US/ProgrammingAndScripting/Blueprints/UserGuide/flow/

export const SwitchOnString = makeFlowNodeDefinition({
  typeName: 'flow/switch/string',
  label: 'Switch on String',
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
      { key: 'selection', valueType: 'string' }
    ];
    const cases =
      (configuration.cases as Record<string, string> | undefined) ?? {};
    for (const index of sequence(1, configuration.numCases + 1)) {
      sockets.push({
        key: `${index}`,
        valueType: 'string',
        defaultValue: cases[`${index}`] ?? `case${index}`
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
    const selection = read<string>('selection');

    for (const index of sequence(1, configuration.numCases + 1)) {
      const caseValue = read<string>(`${index}`);
      if (selection === caseValue) {
        commit(`${index}`);
        return;
      }
    }
    commit('default');
  }
});
