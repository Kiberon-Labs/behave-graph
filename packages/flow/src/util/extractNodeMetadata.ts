import {
  writeNodeSpecsToJSON,
  type IRegistry
} from '@kiberon-labs/behave-graph';
import type { INodeRegistry } from '../types/NodeMetadata.js';

/**
 * Extract pure node metadata from a behave-graph registry.
 * Used by the visual graph editor to initialize a System without execution dependencies.
 */
export function extractNodeMetadata(registry: IRegistry): INodeRegistry {
  return {
    values: registry.values,
    specs: writeNodeSpecsToJSON(registry)
  };
}
