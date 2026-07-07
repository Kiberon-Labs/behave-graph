# Subgraph example (Execute Graph)

A function-style graph with the **typed input/output contract**: two float inputs
`a` and `b`, one float output `sum`.

```
graph/input(a, b) → math/add/float → graph/output(sum = a + b)
```

## Run it

Right-click [`sum.kbgraph`](sum.kbgraph) in the Explorer and choose **Execute
Graph**. Because this graph declares `graph/input` / `graph/output` boundary
nodes, the command is **enabled** (graphs without that contract are greyed out).

The command:

1. **Prompts** you with a single run form listing every input *and the output
   path* at once. Pick **Run** to execute with the pre-filled values, edit an
   individual input, change the **Output file** (inline or via **Browse…**), or
   choose **Enter all inputs as JSON**.
2. **Runs** the graph headlessly with your values.
3. **Writes** the result to the shown output path and opens it. The path
   defaults to `<DATE>-<RUNID>.json` in the graph's folder (e.g.
   `2026-06-19-1f3c… .json`), or to a directory configured in the nearest
   [`.kbworkspace`](#preferred-output-path)  you only change it if you need to:

```json
{
  "runId": "1f3c…",
  "graph": "examples/subgraph/sum.kbgraph",
  "executedAt": "2026-06-19T…",
  "inputs": { "a": 2, "b": 40 },
  "outputs": { "sum": 42 }
}
```

## What it demonstrates

- **Execute Graph is gated on the subgraph contract.** Only graphs with
  `graph/input` / `graph/output` nodes are runnable this way; others are greyed
  out in the context menu.
- **Typed input elicitation.** Inputs are prompted with type-aware parsing
  (numbers validated, booleans picked, etc.) via the registry's value types.
- **Headless run via `runSubgraph`**  inputs are seeded onto the boundary, the
  graph runs to its output, and the result is captured to a file.

Graphs with custom nodes can be executed too: an adjacent `registry.ts` is loaded
(and transpiled) just like the editor does. This example uses only core nodes, so
it needs no registry.

## Preferred output path

By default the run output lands next to the graph. To send all runs in a project
to a fixed folder, add an `outputPath` to the nearest
[`.kbworkspace`](../../readme.md) (the run form pre-fills it; relative paths
resolve against the `.kbworkspace`):

```jsonc
// .kbworkspace
{
  "registry": "./registry.ts",
  "outputPath": "./runs"   // run outputs → <workspace>/runs/<DATE>-<RUNID>.json
}
```
