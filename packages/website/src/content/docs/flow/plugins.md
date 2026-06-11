---
title: Plugin System
description: Extend Behave-Graph Flow with custom plugins
---

The Behave-Graph Flow plugin system enables powerful extensions to the editor without modifying core code. Plugins can register custom nodes, add UI panels, hook into events, and extend nearly every aspect of the system.

## What is a Plugin?

A plugin is a function that receives the `System` instance and extends it:

```typescript
import type { System } from '@kiberon-labs/behave-graph-flow';

export const myPlugin = (system: System) => {
  // Extend the system
  console.log('Plugin loaded!');
  
  // Register nodes, subscribe to events, add UI components, etc.
};
```

## Loading Plugins

Plugins are registered with the System during initialization:

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';
import { myPlugin } from './plugins/myPlugin';

const system = new System(registry);

// Load plugin
system.registerPlugin(myPlugin);
```

### Plugin with Options

Plugins can accept configuration:

```typescript
import type { System } from '@kiberon-labs/behave-graph-flow';

interface MyPluginOptions {
  apiKey: string;
  endpoint: string;
  enableDebug?: boolean;
}

export const createMyPlugin = (options: MyPluginOptions) => {
  return (system: System) => {
    console.log('Plugin initialized with:', options);
    
    // Use options to configure behavior
    if (options.enableDebug) {
      system.pubsub.subscribe('*', (event, data) => {
        console.log('Event:', event, data);
      });
    }
  };
};

// Usage
system.registerPlugin(createMyPlugin({
  apiKey: 'abc123',
  endpoint: 'https://api.example.com'
}));
```

## Plugin Capabilities

### 1. Register Custom Nodes

Add new node types to the registry:

```typescript
export const mathNodesPlugin = (system: System) => {
  const registry = system.registry.getState();
  
  registry.registerNode({
    type: 'math/power',
    category: 'Math',
    label: 'Power',
    in: {
      base: 'number',
      exponent: 'number'
    },
    out: {
      result: 'number'
    },
    exec: ({ base, exponent }) => ({
      result: Math.pow(base, exponent)
    })
  });
  
  registry.registerNode({
    type: 'math/sqrt',
    category: 'Math',
    label: 'Square Root',
    in: { value: 'number' },
    out: { result: 'number' },
    exec: ({ value }) => ({ result: Math.sqrt(value) })
  });
};
```

### 2. Add Menu Items

Extend the menu bar:

```typescript
export const customMenuPlugin = (system: System) => {
  const menubar = system.menubarStore.getState();
  
  menubar.addMenuItem({
    path: 'Tools',
    items: [
      {
        name: 'export-json',
        label: 'Export as JSON',
        icon: <DownloadIcon />,
        action: () => {
          const graph = system.flowStore.getState().getGraph();
          downloadJson(graph, 'graph.json');
        }
      },
      {
        name: 'validate',
        label: 'Validate Graph',
        action: () => {
          // Custom validation logic
          const { nodes, edges } = system.flowStore.getState();
          const errors = validateGraph(nodes, edges);
          
          if (errors.length === 0) {
            system.notifications.success('Graph is valid!');
          } else {
            system.notifications.error(`Found ${errors.length} errors`);
          }
        }
      }
    ]
  });
};
```

### 3. Subscribe to Events

React to system events:

```typescript
export const analyticsPlugin = (system: System) => {
  // Track node additions
  system.pubsub.subscribe('node:added', (node) => {
    analytics.track('Node Added', {
      type: node.type,
      timestamp: Date.now()
    });
  });
  
  // Track graph saves
  system.pubsub.subscribe('graph:saved', (graph) => {
    analytics.track('Graph Saved', {
      nodeCount: graph.flow.nodes.length,
      edgeCount: graph.flow.nodes.reduce((sum, n) => {
        return sum + 
          Object.keys(n.flows || {}).length +
          Object.keys(n.values || {}).length;
      }, 0)
    });
  });
  
  // Track errors
  system.pubsub.subscribe('notification', (data) => {
    if (data.type === 'error') {
      analytics.track('Error', { message: data.message });
    }
  });
};
```

### 4. Register Custom Panels

Add tool panels to the UI:

```typescript
import { MyCustomPanel } from './components/MyCustomPanel';

export const customPanelPlugin = (system: System) => {
  // Register panel component
  system.tabLoader.registerPanel('myPanel', MyCustomPanel);
  
  // Add menu item to open it
  system.menubarStore.getState().addMenuItem({
    path: 'Window',
    items: [{
      name: 'my-panel',
      label: 'My Custom Panel',
      action: () => {
        const layout = system.tabStore.getState().layout;
        const newLayout = addFloatingTab(layout, {
          id: 'myPanel',
          title: 'My Panel',
          content: () => <MyCustomPanel />
        });
        system.tabStore.getState().setLayout(newLayout);
      }
    }]
  });
};
```

### 5. Register Custom Controls

Add specialized input controls for node parameters:

```typescript
import { ColorPicker } from './controls/ColorPicker';

export const customControlsPlugin = (system: System) => {
  system.controlStore.getState().registerControl({
    valueType: 'color',
    component: ColorPicker
  });
  
  system.controlStore.getState().registerControl({
    valueType: 'gradient',
    component: GradientEditor
  });
};

// Now nodes can use these value types
registry.registerNode({
  type: 'visual/setColor',
  in: {
    color: 'color',  // Uses ColorPicker control
    gradient: 'gradient'  // Uses GradientEditor control
  },
  // ...
});
```

### 6. Add Hotkeys

Register keyboard shortcuts:

```typescript
export const hotkeysPlugin = (system: System) => {
  const hotkeys = system.hotKeyStore.getState();
  
  hotkeys.registerHotkey({
    key: 'ctrl+shift+e',
    description: 'Execute current graph',
    action: () => {
      const graph = system.flowStore.getState().getGraph();
      executeGraph(graph);
    }
  });
  
  hotkeys.registerHotkey({
    key: 'ctrl+shift+v',
    description: 'Validate graph',
    action: () => {
      validateCurrentGraph(system);
    }
  });
};
```

### 7. Extend the System Interface

Add custom services to the System:

```typescript
import type { System } from '@kiberon-labs/behave-graph-flow';

// Extend the System interface
declare module '@kiberon-labs/behave-graph-flow' {
  interface ISystem {
    analytics: AnalyticsService;
    storage: StorageService;
  }
}

// Plugin implementation
export const servicesPlugin = (system: System) => {
  // Add custom services
  system.decorate('analytics', new AnalyticsService());
  system.decorate('storage', new LocalStorageService());
};

// Now accessible everywhere
system.analytics.track('event');
system.storage.save('key', data);
```

### 8. Custom Variable Types

Register custom variable types:

```typescript
export const customVariablesPlugin = (system: System) => {
  system.registry.getState().registerValueType({
    name: 'vector3',
    creator: () => ({ x: 0, y: 0, z: 0 }),
    deserialize: (value) => {
      if (typeof value === 'string') {
        const [x, y, z] = value.split(',').map(Number);
        return { x, y, z };
      }
      return value;
    },
    serialize: (value) => `${value.x},${value.y},${value.z}`,
    lerp: (a, b, t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    })
  });
};
```

## Complete Plugin Example

Here's a full-featured plugin:

```typescript
import type { System } from '@kiberon-labs/behave-graph-flow';
import { createStore } from 'zustand';

interface HistoryEntry {
  timestamp: number;
  action: string;
  data: any;
}

interface HistoryStore {
  entries: HistoryEntry[];
  addEntry: (action: string, data: any) => void;
  clear: () => void;
}

export const historyPlugin = (system: System) => {
  // 1. Create a custom store
  const historyStore = createStore<HistoryStore>()((set) => ({
    entries: [],
    addEntry: (action, data) => {
      set((state) => ({
        entries: [
          ...state.entries,
          { timestamp: Date.now(), action, data }
        ]
      }));
    },
    clear: () => set({ entries: [] })
  }));
  
  // 2. Attach to system
  system.decorate('historyStore', historyStore);
  
  // 3. Subscribe to events
  system.pubsub.subscribe('node:added', (node) => {
    historyStore.getState().addEntry('Node Added', {
      type: node.type,
      id: node.id
    });
  });
  
  system.pubsub.subscribe('edge:added', (edge) => {
    historyStore.getState().addEntry('Edge Added', {
      source: edge.source,
      target: edge.target
    });
  });
  
  // 4. Register panel
  system.tabLoader.registerPanel('history', () => {
    const entries = useStore(historyStore, (s) => s.entries);
    
    return (
      <div>
        <h3>Action History</h3>
        <ul>
          {entries.map((entry, i) => (
            <li key={i}>
              {new Date(entry.timestamp).toLocaleTimeString()}: {entry.action}
            </li>
          ))}
        </ul>
      </div>
    );
  });
  
  // 5. Add menu item
  system.menubarStore.getState().addMenuItem({
    path: 'Window/History',
    action: () => {
      // Open history panel
      const layout = system.tabStore.getState().layout;
      // ... add panel to layout
    }
  });
};
```

## Plugin Best Practices

### 1. Namespace Your Nodes

Prefix custom node types with a unique namespace:

```typescript
// ✅ Good
registry.registerNode({ type: 'myplugin/customNode', ... });

// ❌ Bad - might conflict
registry.registerNode({ type: 'customNode', ... });
```


### 2. Type Safety

Extend TypeScript interfaces for type-safe plugins:

```typescript
declare module '@kiberon-labs/behave-graph-flow' {
  interface ISystem {
    myService: MyService;
  }
  
  interface PubSys {
    'myplugin:event': MyEventData;
  }
}
```

### 3. Documentation

Document your plugin's API:

```typescript
/**
 * Analytics Plugin
 * 
 * Tracks user interactions and sends analytics events.
 * 
 * @example
 * ```typescript
 * system.registerPlugin(createAnalyticsPlugin({
 *   apiKey: 'your-key',
 *   endpoint: 'https://analytics.example.com'
 * }));
 * ```
 */
export const createAnalyticsPlugin = (options: AnalyticsOptions) => {
  // ...
};
```

## Built-in Plugins

Behave-Graph Flow includes several built-in plugins:

- **Alignment Plugin**: Node alignment and distribution tools
- **AI Plugin**: AI-powered node suggestions
- **Documentation Plugin**: Inline help and documentation
- **Toolbar Plugin**: Customizable toolbar actions

## Publishing Plugins

To share your plugin:

1. **Package it**: Create an npm package
2. **Export types**: Include TypeScript declarations
3. **Document usage**: Provide clear setup instructions
4. **Version carefully**: Follow semantic versioning

```typescript
// my-plugin/index.ts
export { myPlugin } from './plugin';
export type { MyPluginOptions } from './types';
```
