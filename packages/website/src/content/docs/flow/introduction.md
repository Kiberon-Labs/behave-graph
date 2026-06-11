---
title: Behave-Graph Flow
description: Visual editor for behavior graphs with extensible, event-driven architecture
---

Behave-Graph Flow is a powerful, modular React-based visual editor for creating and editing behavior graphs. It provides a rich authoring environment built on top of the core Behave-Graph execution engine, with a focus on extensibility, performance, and developer experience.

## Overview

Flow is designed as a **UI layer** that sits on top of Behave-Graph, providing:

- **Visual node-based editing** using React Flow
- **Extensible plugin architecture** for customization
- **Event-driven communication** via pub/sub patterns
- **Decoupled state management** using Zustand stores
- **Customizable UI components** for controls, panels, and menus
- **Separation of authoring and runtime** concerns

It forms the foundation for the VS Code extension and can be integrated into web applications, Electron apps, or other JavaScript environments.

## Key Features

### 🔌 Plugin Architecture

Extend the editor with custom nodes, panels, menu items, and behaviors without modifying core code:

```typescript
const myPlugin = (system: System) => {
  system.registry.getState().registerNode(customNode);
  system.menubarStore.getState().addMenuItem({...});
  system.pubsub.subscribe('graph:saved', handleSave);
};

system.registerPlugin(myPlugin);
```

### 📡 Event-Driven Design

Components communicate through a decoupled pub/sub event system:

```typescript
// Publish events
system.pubsub.publish('node:added', nodeData);

// Subscribe anywhere
system.pubsub.subscribe('node:added', (node) => {
  console.log('New node:', node);
});
```

### 🏪 Zustand State Management

Fine-grained, subscribable state stores for optimal performance:

```typescript
// Subscribe to specific state slices
const nodes = useStore(system.flowStore, (s) => s.nodes);
const selected = useStore(system.selectionStore, (s) => s.selectedIds);

// Components only re-render when subscribed data changes
```

### 🎨 Customizable Controls

Register custom input controls for any value type:

```typescript
system.controlStore.getState().registerControl({
  valueType: 'color',
  component: ColorPickerControl
});
```

### 🪟 Flexible Panel System

Add custom tool panels with docking and floating windows:

```typescript
system.tabLoader.registerPanel('inspector', InspectorPanel);
```

### ⌨️ Keyboard Shortcuts

Define custom hotkeys and actions:

```typescript
system.hotKeyStore.getState().registerHotkey({
  key: 'ctrl+shift+f',
  action: () => openFindPanel()
});
```

## Architecture Highlights

### Separation of Concerns

Flow maintains a clear separation between:

- **Inner Graph** (`GraphJSON`): Pure runtime data, no UI metadata
- **UI Graph** (`UIGraphJSON`): Extends inner graph with visual layout, panel state, etc.
- **Authoring Metadata**: Documentation, categories, examples (kept separate from runtime)

This enables:
- Runtime execution without UI dependencies
- Optimized bundles (tree-shake authoring metadata)
- Multiple UIs for the same graph format

### The System Class

The `System` class orchestrates all stores, services, and subsystems:

```typescript
class System {
  // State stores
  flowStore: StoreApi<FlowStore>;
  selectionStore: StoreApi<SelectionStore>;
  variableStore: StoreApi<VariableStore>;
  // ... 15+ stores for different concerns
  
  // Event bus
  pubsub: PubSub<PubSys>;
  
  // Services
  undoManager: UndoManager;
  graph: Graph;
  notifications: Notifications;
  
  // Extensibility
  registerPlugin(plugin: IPlugin): void;
}
```

### Decoupled Events

Events flow through the system without tight coupling:

```
User Action → Store Update → Event Published → Subscribers Notified → UI Updates
```

This pattern enables:
- Cross-cutting concerns (logging, analytics, validation)
- Plugin hooks without modifying core
- Testable, composable behaviors

## Core Concepts

### Stores

Each store manages one aspect of the editor state:

- **flowStore**: Nodes, edges, viewport
- **selectionStore**: Selected elements
- **variableStore**: Graph variables
- **eventsStore**: Custom events
- **actionStore**: Available actions
- **tabStore**: Panel layout
- **menubarStore**: Menu structure
- **controlStore**: Input controls
- **registryStore**: Node & value type metadata

Stores are independent but can communicate via events.

### Graph Management

The `Graph` class provides high-level graph operations:

```typescript
// Serialize the entire UI state
const uiGraph = system.graph.serialize();

// Load UI state
system.graph.deserialize(uiGraph);

// Get just the runtime graph
const runtimeGraph = system.flowStore.getState().getGraph();
```

### Undo/Redo

Built-in undo/redo manager tracks state changes:

```typescript
system.undoManager.undo();
system.undoManager.redo();

// Automatically tracks changes to:
// - Node positions
// - Edge connections
// - Parameter values
```

## Integration

### Embedding in React

```typescript
import { BehaveGraphFlow } from '@kiberon-labs/behave-graph-flow';
import '@kiberon-labs/behave-graph-flow/dist/entry.css';

function App() {
  return (
    <BehaveGraphFlow
      initialGraph={graphData}
      registry={nodeRegistry}
      onSave={(graph) => console.log('Saved:', graph)}
    />
  );
}
```

### Headless Usage

Use the System without UI for testing or automation:

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';

const system = new System(registry);

// Programmatic graph manipulation
system.flowStore.getState().addNode({...});
system.flowStore.getState().addEdge({...});

// Get graph data
const graph = system.flowStore.getState().getGraph();
```

## Compiler Integration

Flow works seamlessly with the Behave-Graph Compiler to separate authoring metadata from runtime logic:

```typescript
// 1. Write nodes as TypeScript functions
export function add(a: number, b: number, result: Output<number>) {
  result.value = a + b;
}

// 2. Compile to runtime nodes
// $ behave-graph-compile src/nodes.ts --out dist/nodes.ts

// 3. Load in Flow
import * as nodes from './dist/nodes';
system.registry.getState().registerNodes(Object.values(nodes));
```

This approach:
- Reduces runtime bundle size
- Improves type safety
- Simplifies node authoring
- Enables code generation workflows

## Use Cases

Behave-Graph Flow is ideal for:

- **Game logic editors**: Visual scripting for game behaviors
- **Workflow automation**: Business process modeling
- **AI agent design**: Behavior trees and state machines
- **Data processing pipelines**: Transform and filter data flows
- **IoT rule engines**: Device automation and triggers
- **Animation systems**: Keyframe and procedural animation
- **Testing frameworks**: Visual test case creation

## Next Steps

Explore the documentation to learn more:

- [Architecture](./architecture) - System design and patterns
- [Plugin System](./plugins) - Extending the editor
- [Compiler](./compiler) - Code generation and separation
- [Customization](./customization) - Controls, panels, themes
- [API Reference](../reference/flow-api) - Complete API documentation