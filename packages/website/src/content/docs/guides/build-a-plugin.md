---
title: Build your own plugin
description: A step-by-step walkthrough assembling a real Behave-Graph Flow plugin , per-graph state, a command, a context-menu item, a hotkey and a panel.
---

This guide walks through building a complete editor plugin end to end. We'll make
a **Graph Stats** plugin that:

- tracks a live node/edge count for **every** open graph (per-graph state),
- exposes a command to log those stats,
- adds a context-menu entry and a keyboard shortcut that run the command,
- and contributes a panel that shows the stats live.

For the full API reference behind each step, see the
[Plugin System](../flow/plugins) page.

## Prerequisites

A project that already renders the Flow editor and constructs a `System`:

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';

const system = new System(registry);
```

## 1. Scaffold the plugin

A plugin is a loader function wrapped with `plugin()`. Start with an empty one and
register it:

```typescript
// graphStatsPlugin.tsx
import { plugin, type System } from '@kiberon-labs/behave-graph-flow';

export const graphStatsPlugin = plugin(
  (system: System) => {
    // we'll fill this in
  },
  { name: 'graph-stats' }
);
```

```typescript
await system.registerPlugin(graphStatsPlugin);
```

## 2. Attach per-graph state with a session extension

Each open graph is a `GraphSession`. To track stats for *every* graph , including
ones opened later , register a **session extension**. It runs once per session and
returns a cleanup that runs when that graph's tab closes.

First, declare the new property so it's typed on every session:

```typescript
declare module '@kiberon-labs/behave-graph-flow' {
  interface IGraphSession {
    graphStats?: GraphStats;
  }
}
```

Then write a small controller that watches the session's node store, and attach it:

```typescript
import { createStore, type StoreApi } from 'zustand';

export type GraphStats = {
  store: StoreApi<{ nodes: number; edges: number }>;
  dispose: () => void;
};

function createGraphStats(session: GraphSession): GraphStats {
  const store = createStore<{ nodes: number; edges: number }>(() => ({
    nodes: session.nodeStore.getState().nodes.length,
    edges: session.edgeStore.getState().edges.length
  }));

  const recount = () =>
    store.setState({
      nodes: session.nodeStore.getState().nodes.length,
      edges: session.edgeStore.getState().edges.length
    });

  const unsubNodes = session.nodeStore.subscribe(recount);
  const unsubEdges = session.edgeStore.subscribe(recount);

  return {
    store,
    dispose: () => {
      unsubNodes();
      unsubEdges();
    }
  };
}
```

Wire it into the plugin:

```typescript
export const graphStatsPlugin = plugin(
  (system: System) => {
    system.registerSessionExtension((session) => {
      const stats = createGraphStats(session);
      session.decorate('graphStats', stats);
      return () => stats.dispose(); // runs on session dispose
    });
  },
  { name: 'graph-stats' }
);
```

Now `session.graphStats` exists, is typed, and is kept up to date for every graph.

## 3. Add a command

Put the behaviour in a **command** so a shortcut, a menu item and a context menu
can all trigger the same code. Commands receive a context with the focused
`session`:

```typescript
system.commandStore.getState().register({
  id: 'graphStats.log',
  title: 'Log Graph Stats',
  run: (ctx) => {
    const stats = ctx.session.graphStats?.store.getState();
    if (!stats) return;
    ctx.editor.notifications.info(
      `${stats.nodes} nodes, ${stats.edges} edges`
    );
  }
});
```

## 4. Trigger it from a hotkey and a context menu

Both dispatch the command by id , no duplicated logic.

```typescript
// Keyboard shortcut
system.hotKeyStore.getState().register({
  action: 'LOG_GRAPH_STATS',
  trigger: ['ctrl+shift+i', 'command+shift+i'],
  description: 'Log graph stats',
  handler: () => system.runCommand('graphStats.log')
});

// Right-click on empty canvas (the "pane" target)
system.contextMenuStore.getState().register({
  id: 'graphStats.pane.log',
  target: 'pane',
  label: 'Log graph stats',
  commandId: 'graphStats.log'
});
```

## 5. Contribute a panel

Register a panel with the `tabLoader`. The component reads the active graph's
stats reactively:

```tsx
import { useGraph } from '@kiberon-labs/behave-graph-flow';
import { useStore } from 'zustand';

function GraphStatsPanel() {
  const session = useGraph();
  const stats = useStore(session.graphStats!.store, (s) => s);
  return (
    <div style={{ padding: '0.5rem' }}>
      <div>Nodes: {stats.nodes}</div>
      <div>Edges: {stats.edges}</div>
    </div>
  );
}

system.tabLoader.register('graphStats:panel', () => ({
  id: 'graphStats:panel',
  title: 'Graph Stats',
  content: () => <GraphStatsPanel />
}));
```

Open it from a command if you like:

```typescript
system.commandStore.getState().register({
  id: 'graphStats.openPanel',
  title: 'Open Graph Stats',
  run: (ctx) => ctx.editor.tabStore.getState().openTab('graphStats:panel')
});
```

## 6. Put it together

```typescript
export const graphStatsPlugin = plugin(
  (system: System) => {
    system.registerSessionExtension((session) => {
      const stats = createGraphStats(session);
      session.decorate('graphStats', stats);
      return () => stats.dispose();
    });

    system.commandStore.getState().register({
      id: 'graphStats.log',
      title: 'Log Graph Stats',
      run: (ctx) => {
        const stats = ctx.session.graphStats?.store.getState();
        if (stats) {
          ctx.editor.notifications.info(
            `${stats.nodes} nodes, ${stats.edges} edges`
          );
        }
      }
    });

    system.hotKeyStore.getState().register({
      action: 'LOG_GRAPH_STATS',
      trigger: ['ctrl+shift+i', 'command+shift+i'],
      description: 'Log graph stats',
      handler: () => system.runCommand('graphStats.log')
    });

    system.contextMenuStore.getState().register({
      id: 'graphStats.pane.log',
      target: 'pane',
      label: 'Log graph stats',
      commandId: 'graphStats.log'
    });

    system.tabLoader.register('graphStats:panel', () => ({
      id: 'graphStats:panel',
      title: 'Graph Stats',
      content: () => <GraphStatsPanel />
    }));
  },
  { name: 'graph-stats' }
);
```

```typescript
await system.registerPlugin(graphStatsPlugin);
```

## 7. Package and share

Ship a plugin as its own npm package:

```jsonc
// package.json
{
  "name": "behave-graph-plugin-graph-stats",
  "peerDependencies": {
    "@kiberon-labs/behave-graph-flow": "*"
  }
}
```

```typescript
// index.ts
export { graphStatsPlugin } from './graphStatsPlugin';
export type { GraphStats } from './graphStatsPlugin';
```

Consumers then `registerPlugin(graphStatsPlugin)`. Because the package only
augments the public `IGraphSession`/`System` interfaces and writes to the
registries, it needs no changes to the editor core.

## Where to go next

- [Plugin System reference](../flow/plugins) , every extension surface and its
  API.
- [Architecture](../flow/architecture) , how the editor and graph sessions fit
  together.
- [Defining a graph](./defining-a-graph) and
  [Core Concepts → Nodes](../core-concepts/nodes) , for adding custom *nodes* (a
  registry/profile concern, layered under the editor).
