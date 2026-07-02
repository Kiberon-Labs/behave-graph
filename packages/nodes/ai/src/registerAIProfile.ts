import type { IRegistry } from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';

/**
 * Merge the AI nodes + value types into an execution registry. Mirrors
 * `registerSceneProfile` , the host composes this on top of the core profile
 * and injects the `IConversationService` dependency. See the README.
 */
export const registerAIProfile = (registry: IRegistry): IRegistry => ({
  ...registry,
  nodes: { ...registry.nodes, ...nodes },
  values: { ...registry.values, ...values },
  dependencies: registry.dependencies
});
