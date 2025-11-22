import { makeFlowNodeDefinition } from '../../../Nodes/NodeDefinitions.js';
import { NodeCategory } from '~/Nodes/Registry/NodeCategory.js';

export const Branch = makeFlowNodeDefinition({
  typeName: 'flow/branch',
  category: NodeCategory.Flow,
  label: 'Branch',
  helpDescription:
    "Checks the value of the 'condition' input and if true, executes the 'true' branch, otherwise it executes the 'false' branch.",
  in: {
    flow: 'flow',
    condition: 'boolean'
  },
  out: {
    true: 'flow',
    false: 'flow'
  },
  triggered: async ({ read, commit }) => {
    commit(read('condition') === true ? 'true' : 'false');
  },
  initialState: undefined
});
