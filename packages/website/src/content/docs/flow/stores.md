---
title: Zustand Stores
description: Understanding the state management architecture
---

Behave-Graph Flow uses Zustand for state management, providing a lightweight, performant, and React-agnostic solution. The architecture employs multiple specialized stores, each responsible for a specific domain of the editor state.

## Why Zustand?

Zustand was chosen for several key advantages:

- **No Provider Hell**: Direct store access without wrapping components in providers
- **Fine-Grained Subscriptions**: Components subscribe only to data they need
- **Framework Agnostic**: Can be used outside React (testing, automation)
- **TypeScript First**: Excellent type inference and safety
- **Minimal Boilerplate**: Simple, clean API
- **Middleware Support**: Easy to add logging, persistence, devtools

## Store Architecture Overview

Flow uses **~15 specialized stores**, each managing a specific concern:

```typescript
system.flowStore          // Nodes, edges, viewport
system.selectionStore     // Selected elements
system.variableStore      // Graph variables
system.eventsStore        // Custom events
system.actionStore        // Actions and commands
system.tabStore           // Panel layout
system.menubarStore       // Menu structure
system.controlStore       // Input controls
system.registryStore      // Node metadata
system.legendStore        // Node type legend
system.logsStore          // Debug logs
system.hotKeyStore        // Keyboard shortcuts
system.nodeStore          // Node-specific state
system.edgeStore          // Edge-specific state
system.traceStore         // Execution traces
```

## Core Stores

### FlowStore

Manages the graph structure: nodes, edges, and viewport.

```typescript
interface FlowStore {
  // State
  nodes: Node[];
  edges: Edge[];
  viewport: Viewport;
  
  // Actions
  addNode(node: Node): void;
  removeNode(nodeId: string): void;
  updateNode(nodeId: string, data: Partial<Node>): void;
  
  addEdge(edge: Edge): void;
  removeEdge(edgeId: string): void;
  
  setViewport(viewport: Viewport): void;
  
  // Computed
  getNodeById(id: string): Node | undefined;
  getEdgesByNodeId(nodeId: string): Edge[];
  getGraph(): GraphJSON;  // Serialize to runtime format
  setGraph(graph: GraphJSON): void;  // Deserialize
}
```

**Usage:**

```typescript
const FlowComponent = () => {
  const system = useSystem();
  
  // Subscribe to all nodes
  const nodes = useStore(system.flowStore, (s) => s.nodes);
  
  // Subscribe to specific derived data
  const nodeCount = useStore(system.flowStore, (s) => s.nodes.length);
  
  // Add a node
  const addNode = () => {
    system.flowStore.getState().addNode({
      id: 'new-node',
      type: 'math/add',
      position: { x: 100, y: 100 },
      data: {}
    });
  };
  
  return <div>Nodes: {nodeCount}</div>;
};
```

### SelectionStore

Tracks selected nodes and edges.

```typescript
interface SelectionStore {
  selectedIds: string[];  // Selected node/edge IDs
  
  select(ids: string[]): void;
  selectAdd(id: string): void;
  selectRemove(id: string): void;
  clearSelection(): void;
  
  isSelected(id: string): boolean;
}
```

**Usage:**

```typescript
const NodeComponent = ({ id }: { id: string }) => {
  const system = useSystem();
  
  // Only re-render when THIS node's selection changes
  const isSelected = useStore(
    system.selectionStore,
    (s) => s.selectedIds.includes(id)
  );
  
  const handleClick = () => {
    system.selectionStore.getState().select([id]);
  };
  
  return (
    <div
      onClick={handleClick}
      className={isSelected ? 'selected' : ''}
    >
      Node {id}
    </div>
  );
};
```

### VariableStore

Manages graph variables.

```typescript
interface VariableStore {
  variables: Array<{
    id: string;
    name: string;
    valueTypeName: string;
    initialValue: any;
  }>;
  
  addVariable(variable: Variable): void;
  removeVariable(id: string): void;
  updateVariable(id: string, changes: Partial<Variable>): void;
  getVariableByName(name: string): Variable | undefined;
}
```

**Usage:**

```typescript
const VariablesPanel = () => {
  const system = useSystem();
  const variables = useStore(system.variableStore, (s) => s.variables);
  
  const addVariable = () => {
    system.variableStore.getState().addVariable({
      id: generateId(),
      name: 'newVar',
      valueTypeName: 'number',
      initialValue: 0
    });
  };
  
  return (
    <div>
      <button onClick={addVariable}>Add Variable</button>
      <ul>
        {variables.map(v => (
          <li key={v.id}>{v.name}: {v.valueTypeName}</li>
        ))}
      </ul>
    </div>
  );
};
```

### TabStore

Manages the panel layout system using rc-dock.

```typescript
interface TabStore {
  layout: LayoutBase;  // rc-dock layout structure
  currentPanel: string | null;
  
  setLayout(layout: LayoutBase): void;
  setCurrentPanel(panelId: string): void;
  
  openPanel(panelId: string, config?: PanelConfig): void;
  closePanel(panelId: string): void;
}
```

**Usage:**

```typescript
const LayoutManager = () => {
  const system = useSystem();
  const layout = useStore(system.tabStore, (s) => s.layout);
  
  const openInspector = () => {
    const newLayout = addFloatingTab(layout, {
      id: 'inspector',
      title: 'Inspector',
      content: () => <InspectorPanel />
    });
    system.tabStore.getState().setLayout(newLayout);
  };
  
  return <button onClick={openInspector}>Open Inspector</button>;
};
```

### ActionStore

Defines available actions and their state.

```typescript
interface ActionStore {
  actions: {
    save(): void;
    load(): void;
    export(): void;
    clear(): void;
    // ...
  };
  
  registerAction(name: string, handler: () => void): void;
  executeAction(name: string): void;
}
```

**Usage:**

```typescript
const SaveButton = () => {
  const system = useSystem();
  
  const handleSave = () => {
    system.actionStore.getState().actions.save();
  };
  
  return <button onClick={handleSave}>Save</button>;
};
```

## Specialized Stores

### ControlStore

Manages custom input controls for value types.

```typescript
interface ControlStore {
  controls: Map<string, React.ComponentType>;
  
  registerControl(valueType: string, component: React.ComponentType): void;
  getControl(valueType: string): React.ComponentType | undefined;
}
```

### RegistryStore

Holds node and value type metadata.

```typescript
interface RegistryStore {
  nodes: Map<string, NodeDefinition>;
  valueTypes: Map<string, ValueTypeDefinition>;
  
  registerNode(definition: NodeDefinition): void;
  registerValueType(definition: ValueTypeDefinition): void;
  
  getNode(type: string): NodeDefinition | undefined;
  getNodesInCategory(category: string): NodeDefinition[];
}
```

### EventsStore

Manages custom graph events.

```typescript
interface EventsStore {
  events: Array<{
    id: string;
    name: string;
  }>;
  
  addEvent(event: CustomEvent): void;
  removeEvent(id: string): void;
  getEventByName(name: string): CustomEvent | undefined;
}
```

### LogsStore

Stores debug logs and console output.

```typescript
interface LogsStore {
  logs: Array<{
    timestamp: number;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
  
  addLog(log: LogEntry): void;
  clearLogs(): void;
}
```

## Store Factory Pattern

All stores use a factory pattern for creation:

```typescript
export const myStoreFactory = (system: System): StoreApi<MyStore> => {
  return createStore<MyStore>()((set, get) => ({
    // Initial state
    someValue: 0,
    items: [],
    
    // Actions
    increment: () => {
      set((state) => ({ someValue: state.someValue + 1 }));
    },
    
    addItem: (item) => {
      set((state) => ({ items: [...state.items, item] }));
      
      // Publish event
      system.pubsub.publish('item:added', item);
    },
    
    // Computed values
    getItemById: (id) => {
      return get().items.find(item => item.id === id);
    }
  }));
};
```

## Best Practices

### 1. Selective Subscriptions

Subscribe only to the data you need:

```typescript
// ✅ Good - only re-renders when count changes
const count = useStore(system.flowStore, (s) => s.nodes.length);

// ❌ Bad - re-renders on any flowStore change
const flowStore = useStore(system.flowStore);
const count = flowStore.nodes.length;
```

### 2. Derived State

Compute derived data in selectors:

```typescript
// ✅ Good - computed in selector
const selectedNodes = useStore(system.flowStore, (s) => {
  const selectedIds = system.selectionStore.getState().selectedIds;
  return s.nodes.filter(n => selectedIds.includes(n.id));
});

// ❌ Bad - computed in component (re-runs on every render)
const allNodes = useStore(system.flowStore, (s) => s.nodes);
const selectedIds = useStore(system.selectionStore, (s) => s.selectedIds);
const selectedNodes = allNodes.filter(n => selectedIds.includes(n.id));
```

### 3. Batch Updates

Use Zustand's batching for multiple updates:

```typescript
system.flowStore.setState((state) => ({
  ...state,
  nodes: [...state.nodes, newNode],
  edges: [...state.edges, newEdge]
}));
// Only triggers one re-render
```

### 4. Shallow Equality

Use shallow equality for object/array selectors:

```typescript
import { shallow } from 'zustand/shallow';

const selectedIds = useStore(
  system.selectionStore,
  (s) => s.selectedIds,
  shallow  // Prevent re-render if array contents haven't changed
);
```

### 5. Actions over Direct Mutation

Use store actions instead of direct setState:

```typescript
// ✅ Good - encapsulated logic
system.flowStore.getState().addNode(node);

// ❌ Bad - bypasses event system and validation
system.flowStore.setState((s) => ({
  nodes: [...s.nodes, node]
}));
```

## Integration with Events

Stores publish events when state changes:

```typescript
export const flowStoreFactory = (system: System) => {
  return createStore<FlowStore>()((set, get) => ({
    nodes: [],
    
    addNode: (node) => {
      set((s) => ({ nodes: [...s.nodes, node] }));
      system.pubsub.publish('node:added', node);  // Event published
      system.undoManager.pushState();  // Undo tracking
    },
    
    removeNode: (nodeId) => {
      const node = get().nodes.find(n => n.id === nodeId);
      set((s) => ({ nodes: s.nodes.filter(n => n.id !== nodeId) }));
      
      if (node) {
        system.pubsub.publish('node:removed', node);
        
        // Clean up related edges
        const edges = get().edges.filter(
          e => e.source === nodeId || e.target === nodeId
        );
        edges.forEach(edge => {
          system.pubsub.publish('edge:removed', edge);
        });
      }
    }
  }));
};
```

## Testing Stores

Stores can be tested in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { flowStoreFactory } from './flow';

describe('FlowStore', () => {
  it('adds nodes correctly', () => {
    const mockSystem = {
      pubsub: { publish: vi.fn() }
    } as any;
    
    const store = flowStoreFactory(mockSystem);
    
    store.getState().addNode({
      id: 'test',
      type: 'math/add',
      position: { x: 0, y: 0 }
    });
    
    expect(store.getState().nodes).toHaveLength(1);
    expect(mockSystem.pubsub.publish).toHaveBeenCalledWith(
      'node:added',
      expect.objectContaining({ id: 'test' })
    );
  });
});
```

## Middleware

Zustand supports middleware for cross-cutting concerns:

```typescript
import { devtools, persist } from 'zustand/middleware';

export const persistentStoreFactory = () => {
  return createStore<MyStore>()(
    devtools(
      persist(
        (set, get) => ({
          // Store implementation
        }),
        {
          name: 'behave-graph-storage',
          partialize: (state) => ({
            // Only persist certain fields
            savedGraphs: state.savedGraphs
          })
        }
      )
    )
  );
};
```

## Performance Optimization

### Memoization

Use React.memo and useMemo with Zustand:

```typescript
const NodeComponent = React.memo(({ id }: { id: string }) => {
  const system = useSystem();
  
  const node = useStore(
    system.flowStore,
    useCallback((s) => s.nodes.find(n => n.id === id), [id])
  );
  
  return <div>{node?.type}</div>;
});
```

### Computed Stores

Create stores that derive from other stores:

```typescript
const computedStoreFactory = (system: System) => {
  return createStore<ComputedStore>()((set) => {
    // Subscribe to base store
    system.flowStore.subscribe((flowState) => {
      set({
        nodeCount: flowState.nodes.length,
        edgeCount: flowState.edges.length
      });
    });
    
    return {
      nodeCount: 0,
      edgeCount: 0
    };
  });
};
```

## Next Steps

- [Architecture Overview](./architecture) - Understanding the System
- [Event System](./events) - Pub/sub communication
- [Plugin Development](./plugins) - Extending stores
- [Performance Guide](./performance) - Optimization techniques
