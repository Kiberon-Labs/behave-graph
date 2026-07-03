---
title: Plugin System
description: Extend the Behave-Graph Flow editor with plugins , commands, panels, per-graph state and more, without forking the core.
---

The Flow editor is built to be extended. Almost everything you can configure ,
commands, context menus, keyboard shortcuts, toolbar buttons, dockable panels,
input controls, socket icons/colours, automatic type conversions and per-graph
state , is exposed through small **registries** that a plugin writes to. Core
code never has to change.

This page is the reference for the plugin model and every extension surface. For
a high-level map of what's customizable, see
[Customizing the Editor](./customizing-the-editor); if you'd rather learn by
building, follow the [Build your own plugin](../guides/build-a-plugin) tutorial.

## The mental model: editor vs. graph

Two objects matter:

- **`System`** , the *editor*. One per application. It owns everything shared
  across graphs: settings, the node registry & specs, the menu bar, tabs,
  hotkeys, the toolbar, notifications, and the registries below.
- **`GraphSession`** , a *single open graph* (one editor tab). It owns per-graph
  state: nodes, edges, variables, selection, traces, undo history and its own
  scoped pub/sub. Multiple graphs are open at once, fully isolated.

A plugin is given the `System`. When it needs to touch *each graph* (e.g. attach
a per-graph controller), it registers a **session extension** rather than reaching
for a single "active" graph , see [Per-graph state](#per-graph-state-session-extensions).

## What a plugin is

A plugin is a loader function that receives the `System` and (optionally) typed
options. Wrap it with the `plugin()` helper, which tags it with a name:

```typescript
import { plugin, type System } from '@kiberon-labs/behave-graph-flow';

export const helloPlugin = plugin(
  (system: System) => {
    // extend the editor here
  },
  { name: 'hello' }
);
```

The loader may be `async` and may return a `Promise`.

### Registering a plugin

```typescript
import { System } from '@kiberon-labs/behave-graph-flow';
import { helloPlugin } from './plugins/hello';

const system = new System(registry);

await system.registerPlugin(helloPlugin);
```

### Options

Type the options on the loader; pass them as the second argument to
`registerPlugin`:

```typescript
interface AnalyticsOptions {
  apiKey: string;
  debug?: boolean;
}

export const analyticsPlugin = plugin<AnalyticsOptions>(
  (system, options) => {
    if (options.debug) console.log('analytics on', options.apiKey);
  },
  { name: 'analytics' }
);

await system.registerPlugin(analyticsPlugin, { apiKey: 'abc123', debug: true });
```

## Extension surfaces

Each surface is a store reached through the `System` (`system.<store>`). The
pattern is always the same: call a `register`/`add` method, optionally keeping the
returned disposer to undo it.

### Commands

Commands are named, dispatchable actions. Defining behaviour as a command means a
single implementation is reachable from a keyboard shortcut, a menu item **and** a
context-menu entry , they all dispatch by id.

```typescript
system.commandStore.getState().register({
  id: 'myplugin.exportPng',
  title: 'Export as PNG',
  run: (ctx) => {
    // ctx = { editor, session, nodeId?, edgeId?, ... }
    exportPng(ctx.session);
  }
});
```

Run a command against the focused graph from anywhere:

```typescript
system.runCommand('myplugin.exportPng');
// or target a specific node:
system.runCommand('node.focus', { nodeId });
```

Re-registering the same `id` replaces the command, so a plugin can override a
built-in (e.g. `editor.save`) without forking.

### Context menus

Context-menu items are registered per target (`node` | `edge` | `selection` |
`pane`) and dispatch a command (or run inline). `label` may be a function for
state-dependent text, and `when` hides an item dynamically.

```typescript
system.contextMenuStore.getState().register({
  id: 'myplugin.node.exportPng',
  target: 'node',
  label: 'Export as PNG',
  commandId: 'myplugin.exportPng',
  order: 100,
  group: 'export'
});
```

Items with different adjacent `group`s get a separator between them.

### Keyboard shortcuts

```typescript
system.hotKeyStore.getState().register({
  action: 'EXPORT_PNG',
  trigger: ['ctrl+shift+e', 'command+shift+e'],
  description: 'Export as PNG',
  handler: () => system.runCommand('myplugin.exportPng')
});
```

### Toolbar buttons

Add a group to the floating toolbar. `buttons` accepts either a `ToolbarButton`
descriptor or a raw React node:

```typescript
system.toolbarStore.getState().addGroup({
  id: 'myplugin-tools',
  label: 'My Tools',
  buttons: [
    {
      id: 'export-png',
      icon: <DownloadIcon />,
      label: 'Export PNG',
      onClick: () => system.runCommand('myplugin.exportPng'),
      disabled: () => false
    }
  ]
});
```

### Menu-bar items

The menu bar is organised into named sub-menus (`file`, `edit`, `window`, …).
Append items to one with `setSubMenuItems`. Each item renders itself:

```typescript
import { MenuItemElement } from '@kiberon-labs/behave-graph-flow';

const windowMenu = system.menubarStore.getState().items.find((m) => m.name === 'window');
system.menubarStore.getState().setSubMenuItems('window', [
  ...(windowMenu?.items ?? []),
  {
    name: 'myplugin-panel',
    render: (rest) => (
      <MenuItemElement onClick={() => openMyPanel(system)} {...rest}>
        My Panel
      </MenuItemElement>
    )
  }
]);
```

### Dockable panels

Register a panel loader with the `tabLoader`; it returns an rc-dock `TabData`.
Once registered, the tab id can be opened from a command, menu item or the layout
API.

```typescript
system.tabLoader.register('myplugin:panel', () => ({
  id: 'myplugin:panel',
  title: 'My Panel',
  content: () => <MyPanel />
}));
```

### Input controls

Controls are the editors shown for a value type in the **Node Inputs** panel.
Register a React component for a value-type name:

```typescript
system.controlStore.getState().registerControl('color', ColorPickerControl);
```

A control receives `{ value, onChange, valueType }`. Value types without a
registered control fall back to the default control.

### Socket icons & colours (legend)

```typescript
system.legendStore.getState().setIcon('color', SwatchIcon);
system.legendStore.getState().setValueTypeColor('color', '#e2c08d');
system.legendStore.getState().setCategoryColor('Logic', '#59a4f9');
```

### Automatic type conversions

When the user connects two different-but-convertible sockets, auto-convert can
splice in a converter node. Register a rule pinning the converter node and the
exact ports to wire:

```typescript
system.registerConversion({
  from: 'integer',
  to: 'string',
  nodeType: 'math/toString/integer',
  inputKey: 'a',
  outputKey: 'result'
});
```

See [Type Conversions](./type-conversions) for the full feature, including the
in-editor rule editor.

### Socket generators

Generators build a node's dynamic ports (and an optional inline/panel editor)
from its configuration , this is how variadic nodes and the
[subgraph](./subgraphs) boundary/call nodes work.

```typescript
system.socketGeneratorStore.getState().registerGenerator({
  name: 'myplugin/myNode.generator',
  check: (spec) => spec.type === 'myplugin/myNode',
  render: (props) => <MyNodePortsEditor {...props} />
});
```

## Per-graph state (session extensions)

To attach state or behaviour to **every graph** , existing tabs and any opened
later , register a *session extension*. It runs once per `GraphSession`, and may
return a cleanup that runs when that graph's tab is closed.

```typescript
import { plugin, type System, type GraphSession } from '@kiberon-labs/behave-graph-flow';

// Make the new property typed on every session.
declare module '@kiberon-labs/behave-graph-flow' {
  interface IGraphSession {
    myController?: MyController;
  }
}

export const myControllerPlugin = plugin(
  (system: System) => {
    system.registerSessionExtension((session: GraphSession) => {
      const controller = new MyController(session);
      session.decorate('myController', controller);
      return () => controller.dispose(); // runs on session dispose
    });
  },
  { name: 'my-controller' }
);
```

Now `session.myController` is available and typed wherever you have a
`GraphSession`. This is exactly how the built-in graph runner attaches a
per-graph run controller. You can also register cleanup directly with
`session.onDispose(fn)`.

## Editor-level services

For state that is genuinely editor-wide (not per-graph), attach it to the
`System` the same way , augment the `System` interface and `decorate`:

```typescript
declare module '@kiberon-labs/behave-graph-flow' {
  interface System {
    analytics: AnalyticsService;
  }
}

export const analyticsPlugin = plugin(
  (system) => system.decorate('analytics', new AnalyticsService()),
  { name: 'analytics' }
);

// accessible everywhere as system.analytics
```

> Note the asymmetry: editor-wide properties augment `interface System`, while
> per-graph properties augment `interface IGraphSession`.

## Events (pub/sub)

There are two buses. The **editor** bus (`system.pubsub`) carries global events
(`EditorPubSys`); each graph has its **own** bus (`session.pubsub`) for graph
events (`GraphPubSys`). Augment the matching interface to add typed topics.

```typescript
const off = system.pubsub.subscribe('graph:saved', (_topic, graph) => {
  console.log('saved', graph);
});
// later: off();
```

## Defining custom nodes

Custom *nodes* are **not** registered through the editor plugin API. They live in
the underlying graph **registry** you pass to `new System(registry)` , a separate
concern from plugins (see
[Registry vs. plugins](./customizing-the-editor#registry-vs-plugins)). Define them
with the core node/value-type machinery and bundle them into a profile. See
[Core Concepts → Nodes](../core-concepts/nodes),
[Profiles](../core-concepts/profiles) and
[Registry](../core-concepts/registry). A Flow plugin then layers the
*editor experience* (icons, controls, generators, conversions) on top.

## Loading packages from a manifest

Everything above registers extensions *imperatively* — a plugin imports the
package's code and writes to the stores. A package can instead ship a static
**manifest** that the editor loads **without importing the package's code**: the
node palette and value types populate from JSON alone, while the UI contributions
declared in the manifest map onto the same extension surfaces documented here and
are registered only under an explicit trust gate.

This is a separate subject with its own reference — see
[Package Manifests](../../manifests/overview/) for the format, the build-time
generator, the `loadManifest` / `manifestPlugin` API and the trust model.

## Built-in plugins

The editor ships these as plugins you can study or replace:

- **Graph runners** , three execution models (local, web worker, remote) over a
  shared client protocol. See [Graph Runners](./graph-runners).
- **Alignment** , node alignment & distribution.
- **Documentation** , inline node help.

Editor defaults (the standard socket generators and the subgraph contract sync)
are registered through `registerDefaults(system)`.

## Best practices

- **Namespace your ids.** Prefix commands, context-menu items, panels and node
  types with your plugin name (`myplugin.…`, `myplugin:panel`) to avoid clashes.
- **Type your augmentations.** Augment `System` / `IGraphSession` /
  `EditorPubSys` / `GraphPubSys` so `decorate`, `subscribe` and `session.x` are
  type-checked.
- **Clean up.** Return a cleanup from session extensions and keep the disposers
  from `register(...)` calls so your plugin can be torn down.
- **Prefer commands.** Put behaviour in a command and have keys/menus/context
  menus dispatch it , one implementation, many entry points.
- **Make setup idempotent** if it can run more than once (registries upsert by
  id/name, so re-registering is safe).
