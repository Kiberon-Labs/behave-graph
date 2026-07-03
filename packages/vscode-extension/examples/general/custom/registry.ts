import {
  registerCoreProfile,
  type IRegistry
} from '@kiberon-labs/behave-graph';

// Example: Create a custom registry with additional nodes or custom dependencies
export const registry: IRegistry = {
  values: {},
  nodes: {
    // Add custom node types here
    // Example:
    // 'custom/myNode': makeFlowNodeDefinition({ ... })
  },
  //@ts-ignore
  dependencies: {}
};

// Alternative: export as default
// export default registry;
