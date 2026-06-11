import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

export const categoryColorMap: Record<NodeSpecJSON['category'], string> = {
  Event: 'red',
  Logic: 'green',
  Variable: 'purple',
  Query: 'purple',
  Action: 'blue',
  Flow: 'gray',
  Effect: 'lime',
  Time: 'gray',
  None: 'gray'
};
