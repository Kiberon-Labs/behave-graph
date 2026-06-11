import type { IRegistry } from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import { ensureImageMagickInitialized } from './wasm';

export const registerProfile = async (
  registry: IRegistry
): Promise<IRegistry> => {
  await ensureImageMagickInitialized();

  return {
    ...registry,
    nodes: {
      ...registry.nodes,
      ...nodes
    },
    values: {
      ...registry.values,
      ...values
    }
  };
};
