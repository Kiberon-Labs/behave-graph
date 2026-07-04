# Behave Graph examples

Runnable example graphs for the **Behave Graph** VS Code extension. Each folder
is a self-contained project: a `.kbgraph` you open in the visual editor and a
`registry.ts` next to it that the run server loads to add the custom nodes,
value types, capabilities (and, where needed, a custom engine).

## How to run one

1. Open the example's `.kbgraph` file. It opens in the visual node editor.
2. Press the editor's **Run** (play) button. Logs stream into the editor's log
   panel.

When a graph opens, the extension automatically discovers the adjacent
`registry.ts` and loads it into the local execution server, so the custom nodes
are available both for editing and for running. (Custom-node graphs must be run
with the editor's Run button rather than the right-click **Execute Graph**
command, which uses only the built-in core profile.)

## The examples

| Example | What it shows | Key seam |
|---------|---------------|----------|
| [`workflow/`](workflow) | n8n-style trigger → HTTP → branch → store, run headlessly | custom nodes + typed host capabilities (HTTP client, result sink) |
| [`game/`](game) | a fixed-timestep loop integrating an entity each tick | running on `RealtimeEngine` via a `createEngine` factory |
| [`subgraph/`](subgraph) | a function-style graph with a typed input/output contract (two float inputs, one float output) | runnable headlessly with the right-click **Execute Graph** command |
| [`general/`](general) | a starter project: a template `registry.ts`, a `.kbworkspace`, and editor settings/conversions in `.kbgraphrc.json` | how a project wires up its registry and editor configuration |

These were previously the standalone `behave-graph-showcase` package; they now
live here so they can be opened and run directly inside the extension.

## How a registry extends a run

The run server loads `registry.ts` and reads three exports:

- **`registry`** (required): a registry built with `registerCoreProfile`,
  adding custom `values`, `nodes`, and `dependencies` (host capabilities).
- **`executionHandlers`** (optional): a map of custom node *kind* to
  handler, taught to the engine so brand-new kinds can run.
- **`createEngine`** (optional): a factory `(graph, registry) => Engine` to
  run on a different engine such as `RealtimeEngine`. See
  [`game/registry.ts`](game/registry.ts).

## Editor plugins (`plugin.ts`)

A `registry.ts` defines what the *server* engine can run. An adjacent
**`plugin.ts`** (or `.tsx`/`.js`/`.mjs`) instead extends the *editor experience*
in the webview. It runs after the editor's own plugins, with the libraries
available on `window.behaveGraph` / `window.behaveGraphFlow` (and `window.React`
for `.tsx` controls), and can register controls or even swap the runner (for
example, replacing the default server runner with the editor's in-browser
engine for a single graph). TypeScript is transpiled on the fly, so there's
**no build step**.
