# Behave Graph examples

Runnable example graphs for the **Behave Graph** VS Code extension. Each folder
is a self-contained project: a `.kbgraph` you open in the visual editor and a
`registry.ts` next to it that the run server loads to add the custom nodes,
value types, capabilities (and, where needed, a custom engine).

## How to run one

1. Open the example's `.kbgraph` file — it opens in the visual node editor.
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
| [`audio/`](audio) | a Web-Audio-style oscillator → gain → render chain that **plays a 440 Hz tone** | a custom value type (`audioBuffer`), a custom node *kind* (`AudioRate`), and an in-browser-runner `plugin.js` for live audio |
| [`game/`](game) | a fixed-timestep loop integrating an entity each tick | running on `RealtimeEngine` via a `createEngine` factory |
| [`embed/`](embed) | a custom `Vector3` value type + nodes (the editor-control half is reference) | the `Interpolatable` value type; registry-vs-plugin split |

These were previously the standalone `behave-graph-showcase` package; they now
live here so they can be opened and run directly inside the extension.

## How a registry extends a run

The run server loads `registry.ts` and reads three exports:

- **`registry`** (required) — a registry built with `registerCoreProfile`,
  adding custom `values`, `nodes`, and `dependencies` (host capabilities).
- **`executionHandlers`** (optional) — a map of custom node *kind* →
  handler, taught to the engine so brand-new kinds (e.g. `audio`'s `AudioRate`)
  can run. See [`audio/registry.ts`](audio/registry.ts).
- **`createEngine`** (optional) — a factory `(graph, registry) => Engine` to
  run on a different engine such as `RealtimeEngine`. See
  [`game/registry.ts`](game/registry.ts).

## Editor plugins (`plugin.ts`)

A `registry.ts` defines what the *server* engine can run. An adjacent
**`plugin.ts`** (or `.tsx`/`.js`/`.mjs`) instead extends the *editor experience*
in the webview — it runs after the editor's own plugins, with the libraries
available on `window.behaveGraph` / `window.behaveGraphFlow` (and `window.React`
for `.tsx` controls), and can register controls or even swap the runner.
TypeScript is transpiled on the fly, so there's **no build step**. The
[audio example](audio/plugin.ts) uses one to run the graph in the editor's
**in-browser engine** (which has a real `AudioContext`) so it can play sound,
overriding the default server runner for that graph only.

## Regenerating the graphs

The `.kbgraph` files are generated from each example's engine graph by
[`scripts/build-kbgraph.mjs`](scripts/build-kbgraph.mjs); the end-to-end run
check is [`scripts/verify.mjs`](scripts/verify.mjs):

```bash
node examples/scripts/build-kbgraph.mjs   # (re)write the .kbgraph files
node examples/scripts/verify.mjs          # run every example headlessly
```
