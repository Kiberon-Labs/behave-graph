import {
  registerCoreProfile,
  ManualLifecycleEventEmitter,
  type IRegistry
} from '@kiberon-labs/behave-graph';

// Example: Create a custom registry with additional nodes or custom dependencies
export const registry: IRegistry = registerCoreProfile({
  values: {},
  nodes: {
    // Add custom node types here
    // Example:
    // 'custom/myNode': makeFlowNodeDefinition({ ... })
  },
  dependencies: {
    ILogger: console, // Use console logger instead of TransportLogger
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
    // Add custom dependencies here
  }
});

// Alternative: export as default
// export default registry;
