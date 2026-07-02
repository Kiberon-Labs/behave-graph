---
title: Flow UI Architecture
description: Understanding the decoupled, event-driven architecture of Behave-Graph Flow
---

Behave-Graph Flow is a highly modular, extensible React-based visual editor for behavior graphs. It implements a sophisticated architecture that decouples the UI layer from the graph execution engine, enabling powerful customization while maintaining clean separation of concerns.

## Core Architectural Principles

### 1. Separation of Authoring and Runtime

The Flow UI maintains a strict separation between:

- **Authoring Environment**: Rich visual editor with undo/redo, layout management, validation
- **Runtime Execution**: Lightweight engine that executes graphs without UI dependencies

This separation enables:
- Graphs authored in the UI to run in headless environments
- Runtime bundles without UI code overhead
- Different UIs for the same graph engine (web, desktop, mobile)

### 2. Event-Driven Communication

Instead of tight coupling between components, Flow uses a **publish-subscribe (pub/sub) event system** for communication:

```typescript
// Publishing events
system.pubsub.publish('node:added', nodeData);
system.pubsub.publish('graph:saved', graphJson);

// Subscribing to events
system.pubsub.subscribe('edge:removed', (edge) => {
  // Handle edge removal
});
```

This enables:
- Loose coupling between UI components
- Easy integration of plugins
- Testable, composable behaviors
- Runtime flexibility

### 3. Zustand State Management

Flow uses **Zustand** for state management, providing:

- **Subscribable stores**: React components can subscribe to specific slices of state
- **No provider hell**: Direct store access without React Context
- **TypeScript support**: Fully typed stores and selectors
- **Middleware support**: Undo/redo, persistence, logging

Each concern has its own store:
- `flowStore`: Graph nodes, edges, viewport
- `selectionStore`: Selected nodes/edges
- `tabStore`: Panel layout and window management  
- `actionStore`: Available actions and commands
- `variableStore`: Graph variables
- `eventsStore`: Custom events
- And many more...

### 4. Plugin Architecture

The System can be extended through a plugin system:

```typescript
import type { IPlugin } from '@kiberon-labs/behave-graph-flow';

const myPlugin: IPlugin = (system) => {
  // Register custom nodes
  system.registry.getState().registerNode(customNode);
  
  // Add menu items
  system.menubarStore.getState().addMenuItem({...});
  
  // Subscribe to events
  system.pubsub.subscribe('graph:saved', handleSave);
  
  // Add custom panels
  system.tabLoader.registerPanel('myPanel', MyComponent);
};

// Load plugin
system.registerPlugin(myPlugin);
```

Note that it is your responsibility to handle plugin order loading if that is necessary.

## The System Class

The `System` class is the central orchestrator, managing all stores, services, and subsystems:

```typescript
class System {
  // State management
  flowStore: StoreApi<FlowStore>;
  selectionStore: StoreApi<SelectionStore>;
  variableStore: StoreApi<VariableStore>;
  // ... many more stores
  
  // Event bus
  pubsub: PubSub<PubSys>;
  
  // Services
  undoManager: UndoManager;
  graph: Graph;
  ai: AISubsystem;
  notifications: Notifications;
  
  // Plugin support
  registerPlugin(plugin: IPlugin): void;
}
```

### System Lifecycle

1. **Construction**: Stores are initialized with default state
2. **Registry Loading**: Node and value type metadata is registered
3. **Plugin Loading**: Plugins extend the system
4. **Graph Loading**: Initial graph data is deserialized
5. **UI Rendering**: React components subscribe to stores
6. **User Interaction**: Actions trigger state updates → events → re-renders

## Store Architecture

Each store follows a consistent pattern:

```typescript
// Store factory
export const flowStoreFactory = (system: System): StoreApi<FlowStore> => {
  return createStore<FlowStore>()((set, get) => ({
    // State
    nodes: [],
    edges: [],
    viewport: defaultViewport,
    
    // Actions
    addNode: (node) => {
      set((state) => ({ nodes: [...state.nodes, node] }));
      system.pubsub.publish('node:added', node);
    },
    
    removeNode: (nodeId) => {
      const node = get().nodes.find(n => n.id === nodeId);
      set((state) => ({ 
        nodes: state.nodes.filter(n => n.id !== nodeId) 
      }));
      if (node) system.pubsub.publish('node:removed', node);
    },
    
    // Computed/derived state
    getNodeById: (id) => get().nodes.find(n => n.id === id)
  }));
};
```

### Store Subscriptions in React

Components use Zustand's `useStore` hook to subscribe:

```typescript
import { useSystem } from '@/system';
import { useStore } from 'zustand';

function MyComponent() {
  const system = useSystem();
  
  // Subscribe to specific slice
  const nodes = useStore(system.flowStore, (s) => s.nodes);
  const selectedIds = useStore(system.selectionStore, (s) => s.selectedIds);
  
  // Selector only re-renders when derived value changes
  const selectedNodeCount = useStore(
    system.selectionStore,
    (s) => s.selectedIds.filter(id => nodes.some(n => n.id === id)).length
  );
  
  return <div>{selectedNodeCount} nodes selected</div>;
}
```

## Event System (PubSub)

The pub/sub system enables decoupled communication:

### Event Types

```typescript
interface PubSys {
  'node:added': Node;
  'node:removed': Node;
  'edge:added': Edge;
  'edge:removed': Edge;
  'graph:saved': UIGraphJSON;
  'layout:saved': LayoutBase;
  'notification': NotificationData;
  // ... extensible
}
```

### Publishing Events

```typescript
// From any component or store
system.pubsub.publish('graph:saved', graphData);
```

### Subscribing to Events

```typescript
// In plugins or components
const unsubscribe = system.pubsub.subscribe('node:added', (node) => {
  console.log('New node:', node);
});

// Cleanup
unsubscribe();
```

### Use Cases

- **Undo/Redo**: Track state changes via events
- **Auto-save**: Listen to graph modifications
- **Analytics**: Track user actions
- **Validation**: React to graph changes
- **Cross-cutting Concerns**: Logging, debugging, telemetry

## Graph vs UI State

The system maintains two types of state:

### Inner Graph (Runtime)

```typescript
interface GraphJSON {
  nodes: Array<{
    type: string;
    id: string;
    parameters?: Record<string, any>;
    flows?: Record<string, FlowConnection>;
    values?: Record<string, ValueConnection>;
  }>;
  variables?: Array<{
    id: string;
    name: string;
    valueTypeName: string;
    initialValue: any;
  }>;
  customEvents?: Array<{
    id: string;
    name: string;
  }>;
}
```

This is the **pure execution graph**,no UI metadata, ready for runtime.

### UI Graph (Authoring)

```typescript
interface UIGraphJSON {
  flow: GraphJSON;  // Inner graph
  
  // UI-specific metadata
  ui: {
    nodes: Record<string, {
      position: { x: number; y: number };
      width?: number;
      height?: number;
      collapsed?: boolean;
    }>;
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
    layout?: LayoutBase;  // Panel arrangement
  };
}
```

The UI graph extends the runtime graph with authoring metadata.

## Customization Points

### 1. Custom Controls

Register custom input controls for node parameters:

```typescript
system.controlStore.getState().registerControl({
  valueType: 'color',
  component: ColorPickerControl
});
```

### 2. Custom Panels

Add custom tool panels:

```typescript
system.tabLoader.registerPanel('inspector', InspectorPanel);
```

### 3. Custom Menu Items

Extend the menu bar:

```typescript
system.menubarStore.getState().addMenuItem({
  path: 'Tools/My Tool',
  action: () => { /* ... */ }
});
```

### 4. Custom Nodes

Register custom node types:

```typescript
system.registry.getState().registerNode({
  type: 'custom/myNode',
  category: 'Custom',
  label: 'My Node',
  in: { input: 'number' },
  out: { output: 'string' },
  exec: (input) => ({ output: input.toString() })
});
```

### 5. Custom Hotkeys

Define keyboard shortcuts:

```typescript
system.hotKeyStore.getState().registerHotkey({
  key: 'ctrl+shift+f',
  action: () => system.pubsub.publish('find:open', {})
});
```

## Benefits of This Architecture

### Modularity
- Each store manages one concern
- Plugins extend without modifying core
- Components are self-contained

### Testability
- Stores can be tested in isolation
- Event-driven logic is easily mocked
- No tight coupling to React

### Performance
- Fine-grained subscriptions (only re-render what changes)
- Zustand's selector-based updates
- Memoization and lazy evaluation

### Extensibility
- Plugin system for third-party extensions
- Event system for cross-cutting concerns
- Type-safe extension points

### Maintainability
- Clear separation of concerns
- Single responsibility per store
- Explicit data flow (stores → events → UI)
