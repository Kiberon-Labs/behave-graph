# Kiberon Labs Behave Graph for VS Code

Author, run, and debug Behave Graphs directly in VS Code. This extension adds a
visual node editor for `.kbgraph` files, a built-in execution server that runs
graphs against the core node profile (or your own custom registry), and an MCP
server so external AI agents can drive the editor as a tool.

## Features

- **Visual graph editor** for `.kbgraph` files, opened as a custom editor with a
  right-click node picker preloaded with the full core node profile.
- **Built-in execution server** that runs graphs locally, with support for
  custom registries that extend or replace the default nodes.
- **Custom registries and editor plugins** loaded from files next to a graph. A
  `.ts` / `.tsx` registry or `plugin` is transpiled on demand, so no build step
  is required (see [Requirements](#requirements)).
- **MCP server** that exposes the open editors as tools over HTTP and to VS Code
  Copilot, so external agents can inspect and edit graphs.
- **Cascading editor settings** stored in `.kbgraphrc.json` files, resolved
  local-then-global.
- **Custom file icons** and a dedicated language for the `.kbgraph` format.

## Getting started

1. Create a graph: run **Graph Engine: Create new Behave Graph file** from the
   Command Palette, or open any existing `.kbgraph` file.
2. Build the graph: right-click the canvas to add nodes from the picker, then
   wire them together.
3. Run it: open the **Remote Graph Runner** panel (Window menu) and press
   **Run**, or use the `p` hotkey.

Graphs are plain JSON with a `.kbgraph` extension, so they diff and version like
any other source file.

## Commands

All commands are available from the Command Palette. Those in the **Graph
Engine** category are grouped together when you type "Graph Engine".

| Command | Title | Notes |
| --- | --- | --- |
| `kiberon-labs-behave-graph.graph.new` | Create new Behave Graph file | Requires an open workspace folder. |
| `kiberon-labs-behave-graph.executeGraph` | Execute Graph | Runs a subgraph-style graph headlessly and writes its outputs next to the file. Also on the Explorer right-click menu for `.kbgraph` files; enabled only for graphs with an input/output contract. |
| `kiberon-labs-behave-graph.mcpStatus` | Show MCP Server Status | Reports the active transport, port, and connected editors. |
| `kiberon-labs-behave-graph.openLocalSettings` | Open Local Editor Settings | Opens the workspace `.kbgraphrc.json`, creating it if needed. |
| `kiberon-labs-behave-graph.openGlobalSettings` | Open Global Editor Settings | Opens the home-directory `.kbgraphrc.json`, creating it if needed. |

## Custom registry support

The execution server loads custom registries to extend or replace the default
core profile nodes. When you open a `.kbgraph`, an adjacent `registry.ts` /
`registry.js` (or one named by a `.kbworkspace` file) is loaded automatically. A
`.ts` registry is transpiled on demand using a compiler resolved from your
workspace, so it works without a build step (see [Requirements](#requirements)).

Create a `registry.ts` (or `.js`) that exports a configured registry:

```typescript
import { registerCoreProfile, ManualLifecycleEventEmitter } from '@kiberon-labs/behave-graph';

export const registry = registerCoreProfile({
  values: {},
  nodes: {
    // Add custom node types here
  },
  dependencies: {
    ILogger: console,
    ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
  }
});
```

A registry module may also export two optional seams the run server honors:

- **`executionHandlers`**: a map of custom node *kind* to handler, taught to the
  engine via `registerNodeExecutionHandler`. This lets you add brand-new node
  *kinds* (not just node types).
- **`createEngine`**: a factory `(graph, registry) => Engine` to run on a
  different engine, e.g. `RealtimeEngine`. See
  [examples/game/registry.ts](examples/game/registry.ts).

See [examples/](examples) for complete, runnable registries.

## Custom frontend plugins

You can extend the editor UI itself with a `plugin.js` / `plugin.mjs` /
`plugin.ts` / `plugin.tsx` file placed next to a graph. The plugin is injected
into the webview and runs after the editor's own plugins load, so it can
register controls, custom node renderers, or swap the remote runner for an
in-browser one. TypeScript plugins are transpiled on demand.

## Examples

Ready-to-run example graphs live in [`examples/`](examples). Open an example's
`.kbgraph` in the editor and press **Run**; any adjacent `registry.ts` is loaded
automatically so its custom nodes are available. The set covers:

- [`workflow/`](examples/workflow): an n8n-style automation (trigger, HTTP,
  branch, store) that runs headlessly.
- [`game/`](examples/game): a fixed-timestep loop running on `RealtimeEngine`
  via a `createEngine` factory.
- [`subgraph/`](examples/subgraph): a function-style graph with a typed
  input/output contract, runnable with **Execute Graph**.
- [`general/`](examples/general): plain core-profile graphs (no custom
  registry required).

See [examples/README.md](examples/README.md) for details.

## Requirements

The extension itself has no special requirements. The editor, execution server
and MCP server all run out of the box.

One optional case needs a workspace dependency: if you author a **`.ts` / `.tsx`
registry or `plugin`** and want it transpiled on demand (no build step), the
extension resolves a TypeScript compiler from your workspace rather than
bundling one. Install either `esbuild` (preferred) or `typescript` as a dev
dependency:

```bash
npm install -D esbuild
# or
npm install -D typescript
```

Projects that ship compiled `.js` / `.mjs` registries and plugins, or that use
no custom registry at all, need neither.

## Extension settings

The extension contributes the following VS Code settings under the
`behaveGraph.mcp` namespace. They control the
[Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that
exposes the open graph editors as tools to external AI agents. Set them in your
User or Workspace `settings.json`, or via the Settings UI (search for "Behave
Graph").

| Setting | Type | Default | Description |
| --- | --- | --- | --- |
| `behaveGraph.mcp.httpServer.enabled` | boolean | `true` | Enable the MCP HTTP server so external agents (Claude Desktop, OpenCode, Cursor, etc.) can connect via URL. |
| `behaveGraph.mcp.httpServer.port` | number | `3100` | Port for the MCP HTTP server. |
| `behaveGraph.mcp.vscodeProvider.enabled` | boolean | `true` | Register the MCP tools as a VS Code MCP Server Definition Provider so VS Code Copilot can discover and use them. |

Notes:

- `behaveGraph.mcp.vscodeProvider.enabled` depends on the HTTP server: the VS
  Code provider only registers when `behaveGraph.mcp.httpServer.enabled` is also
  `true`, because it points Copilot at the same local HTTP endpoint.
- Changing any of these settings restarts the MCP server automatically; you do
  not need to reload the window.
- Run **Graph Engine: Show MCP Server Status** from the Command Palette to check
  the active transport, port, and connected editors.

## Editor settings files

Separate from the VS Code settings above, the **editor** (node appearance, type
conversions, and similar preferences) is configured through `.kbgraphrc.json`
files that cascade local-then-global:

- **Local**: `.kbgraphrc.json` at the workspace folder root. Open it with
  **Graph Engine: Open Local Editor Settings**.
- **Global**: `.kbgraphrc.json` in your home directory. Open it with **Graph
  Engine: Open Global Editor Settings**.

Local values override global ones. Changes you make in the editor UI are saved
back to the local file automatically.

## Known issues

Due to how serialization handles array buffers and typed arrays, VS Code
`1.57.0` or later is required to avoid large data-transfer inefficiencies.

## Release notes

See the project changelog for release history.
