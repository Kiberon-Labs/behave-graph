import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';

import type { SocketBase, DynamicPorts } from '../types.js';
import { mergeSockets } from './mergeSockets.js';

const getPairs = <T, U>(arr1: T[], arr2: U[]) => {
  const max = Math.max(arr1.length, arr2.length);
  const pairs = [];
  for (let i = 0; i < max; i++) {
    const pair: [T | undefined, U | undefined] = [arr1[i], arr2[i]];
    pairs.push(pair);
  }
  return pairs;
};

type Configuration = Record<string, any>;

export function configureSockets(
  config: Configuration,
  spec: NodeSpecJSON,
  ports?: DynamicPorts
) {
  const configInputs = config?.socketInputs || [];

  const configOutputs = config?.socketOutputs || [];

  // Merge spec sockets with ports overrides (specifics can override subset of sockets)
  const baseInputs = mergeSockets(spec.inputs, ports?.inputs);
  const baseOutputs = mergeSockets(spec.outputs, ports?.outputs);

  const inputs: SocketBase[] = [...baseInputs, ...configInputs];
  const outputs: SocketBase[] = [...baseOutputs, ...configOutputs];

  const flowInputs = inputs.filter((input) => input.valueType === 'flow');
  const flowOutputs = outputs.filter((output) => output.valueType === 'flow');

  const valueInputs = inputs.filter((input) => input.valueType !== 'flow');
  const valueOutputs = outputs.filter((output) => output.valueType !== 'flow');

  const pairs = getPairs(flowInputs, [...flowOutputs, ...valueOutputs]);

  return { pairs, valueInputs, valueOutputs, flowInputs, flowOutputs };
}
