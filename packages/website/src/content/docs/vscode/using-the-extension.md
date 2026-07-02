---
title: Using the VS Code Extension
description: Edit and run Behave Graphs directly inside VS Code with the Behave Graph extension.
---

The **Behave Graph** VS Code extension embeds the full visual editor inside the
editor and runs graphs locally. It registers a custom editor for `.kbgraph`
files, so opening one drops you straight into the node graph , no separate app.

## Installing

Install the **Behave Graph** extension (publisher `kiberon-labs`) from the
Extensions view, or install a packaged `.vsix` with **Extensions: Install from
VSIX…**.

The extension requires a **trusted workspace** , it loads configuration and code
(custom registries/plugins) from the workspace and executes graphs, so it does
not run in Restricted Mode or virtual workspaces.

## Opening and creating graphs

- **Open** any `.kbgraph` file and it opens in the visual editor (a custom
  editor), complete with the node canvas, panels, and toolbar.
- **Create** a new graph with the command **Graph Engine: Create new Behave
  Graph file** from the Command Palette.

`.kbgraph` is the serialized Behave Graph format; the file on disk stays in sync
as you edit visually.

## Editing

Inside the custom editor you get the complete Flow editor: add nodes, wire
sockets, define variables, group nodes, and use the side panels (Node Inputs,
Variables, Events, Traces, …). See [Customizing the Editor](../flow/customizing-the-editor)
for everything the editor surfaces, and [Subgraphs](../flow/subgraphs) for
splitting logic across reusable graphs.

## Running a graph

There are two ways to execute:

- **One-shot run** , right-click a `.kbgraph` file in the Explorer and choose
  **Execute Graph** (also available as a command). The graph runs on the built-in
  local execution server and the result opens in a new JSON tab.
- **Interactive run** , use the editor's own run controls (play/stop) while a
  graph is open; execution streams traces and logs back into the editor's panels.

The extension uses the **local** execution model. For how that compares to the
web-worker and remote models, see [Graph Runners](../flow/graph-runners).

## Two ways to extend: registry vs. plugins

The extension lets you extend a graph in **two separate ways**, and it matters
which one you reach for:

- The **registry** defines *what nodes (and value types) exist* , the vocabulary
  the engine can execute. Adding a node is a **registry** change. This is a
  runtime concern: it changes what the graph can *do*.
- A **plugin** adds *editor experience* around those nodes (commands, panels,
  controls, icons, per-graph state, and so on). A plugin **never** adds nodes; it
  changes how the editor *behaves*.

A project can use either, both, or neither. See
[Registry vs. plugins](../flow/customizing-the-editor#registry-vs-plugins) for the
full conceptual split.

## The workspace manifest (`.kbworkspace`)

A `.kbworkspace` file at the root of a project declares where those two things
live, keeping the registry (nodes) and the plugins (editor experience) as
distinct, explicitly-pointed-to entry points:

```jsonc
// .kbworkspace
{
  "plugins": "./plugins.js", // editor plugins (the experience)
  "registry": "./registry.ts", // custom nodes (the vocabulary)
  "outputPath": "./runs" // where Execute Graph writes run outputs (optional)
}
```

`outputPath` (relative to the `.kbworkspace`) pre-fills the output location in the
**Execute Graph** run form, so saved runs land in a consistent folder; you can
still change it per run.

By convention the extension also discovers an adjacent **`plugin`** (editor
plugins, as `plugin.ts` / `.tsx` / `.js` / `.mjs`) and **`registry.ts`** (custom
registry) sitting next to a `.kbgraph` file, so a single-graph project can skip
the manifest entirely. Both are transpiled on the fly, so TypeScript works with
no build step.

### Custom nodes (the registry)

The execution server loads the **registry** to add or replace node types. A
registry file exports a configured registry built from a profile:

```typescript
// registry.ts
import {
  registerCoreProfile,
  ManualLifecycleEventEmitter
} from '@kiberon-labs/behave-graph';

export const registry = registerCoreProfile({
  values: {},
  nodes: {
    // your custom node types here
  },
  dependencies: {
    ILogger: console,
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
  }
});
```

The registry is the **only** entry point for adding nodes (or value types and
dependencies). See [Core Concepts → Profiles](../core-concepts/profiles) and
[Registry](../core-concepts/registry) for how to define the nodes themselves.

The TypeScript registry is transpiled on demand, so a `registry.ts` runs without
a separate build step. Besides `registry`, a registry module may export two
optional seams the execution server honors:

- **`executionHandlers`** — a map of custom node *kind* → handler, installed via
  `registerNodeExecutionHandler`. Use it to add brand-new node *kinds* (not just
  node types), e.g. a custom-rate render node.
- **`createEngine`** — a factory `(graph, registry) => Engine` to run the graph
  on a different engine, such as `RealtimeEngine`.

### Example graphs

The extension ships runnable examples (a headless workflow, a Web-Audio-style
chain with a custom value type and node kind, a `RealtimeEngine` game loop, and a
custom `Vector3` value type). Each is a `.kbgraph` with an adjacent `registry.ts`
— open one and press **Run**. They live in the extension's `examples/` folder.

### Custom editor plugins

The **plugins** file extends the *editor experience* (commands, panels, controls,
per-graph state, the runner, and so on) and is loaded into the webview when a
graph opens. Write it in **TypeScript** (`plugin.ts` / `.tsx`) or plain JS — the
extension transpiles it on the fly, so there's no build step. It runs as an
inline classic script (no ESM `import`/`export`); the editor exposes the
libraries on `window.behaveGraph` (core), `window.behaveGraphFlow` (flow) and
`window.React` (for `.tsx` controls), and drains a `window.behaveGraphPlugins`
queue **after** its own plugins are registered — so a plugin can register
controls or even override editor defaults such as the graph runner. Because the
queue is drained after the editor boots, do the work inside the pushed function
(by then the libraries are available).

```ts
// plugin.ts — push a function that receives the editor System
(window.behaveGraphPlugins = window.behaveGraphPlugins || []).push(
  async (system) => {
    const { localGraphRunnerPlugin } = window.behaveGraphFlow;
    const { registerCoreProfile } = window.behaveGraph;
    // e.g. run this graph in the in-browser engine instead of the server:
    await system.registerPlugin(localGraphRunnerPlugin, {
      registry: registerCoreProfile({ values: {}, nodes: {}, dependencies: { /* … */ } })
    });
  }
);
```

The audio example uses exactly this to play live audio through a Web Audio
`AudioContext`, which only exists in the webview. Author richer plugins the same
way you would any Flow plugin: see the [Plugin System](../flow/plugins) reference
and the [Build your own plugin](../guides/build-a-plugin) tutorial.

## Editor settings (`.kbgraphrc`)

Editor preferences and custom [type conversions](../flow/type-conversions) are
configured with `.kbgraphrc.json` files, using a familiar rc-style cascade: the
extension walks up from the graph's directory collecting config, plus a global
file in your home directory. **Closer files win**, so a project-local file
overrides the global one.

Open them with the commands **Graph Engine: Open Local Editor Settings** and
**Graph Engine: Open Global Editor Settings** (each is created from a template if
it doesn't exist). The format mirrors the editor's serialized settings:

```jsonc
{
  "settings": {
    "autoConvert": true,
    "showGrid": true,
    "gridSize": 15,
    "edgeType": "Bezier",
    "layoutType": "Dagre"
  },
  "conversions": [
    { "from": "integer", "to": "string", "nodeType": "math/toString/integer" },
    { "from": "float", "to": "string", "nodeType": "math/toString/float" }
  ]
}
```

`settings` are applied to the editor on open; `conversions` register custom
[auto-convert rules](../flow/type-conversions).

## AI agent access (MCP)

The extension runs a **Model Context Protocol** server so external AI agents can
inspect and work with your open graphs. Two transports are available:

- an **HTTP server** (default port `3100`) that agents like Claude Desktop,
  Cursor or OpenCode connect to by URL, and
- a **VS Code MCP definition provider** so GitHub Copilot Chat can discover the
  tools natively.

Both are configurable under the **Behave Graph** settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `behaveGraph.mcp.httpServer.enabled` | `true` | Enable the HTTP MCP server. |
| `behaveGraph.mcp.httpServer.port` | `3100` | Port for the HTTP server. |
| `behaveGraph.mcp.vscodeProvider.enabled` | `true` | Register the tools with VS Code (Copilot). |

Run **Graph Engine: Show MCP Server Status** to see whether the transports are
running and which graphs are currently open.

## Requirements & notes

- Requires VS Code **1.99+** and a **trusted** workspace.
- For large graphs with typed arrays/array buffers, use a recent VS Code build to
  avoid inefficient serialization between the editor and the extension host.
