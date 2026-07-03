---
"@kiberon-labs/behave-graph-flow": major
"@kiberon-labs/behave-graph": minor
---

Multiple graph tabs, subgraphs, auto-convert, and persisted editor settings.

## `@kiberon-labs/behave-graph-flow`

### Multiple isolated graphs

- Split the single `System` god-object into an editor-level system (shared:
  settings, registry, specs, menubar, tabs, conversions, …) and a per-graph
  `GraphSession` (nodes, edges, variables, selection, traces, layers, logs, undo,
  a private pubsub). Pubsub split into `EditorPubSys` / `GraphPubSys`.
- New providers/hooks: `GraphProvider`/`useGraph`, `useActiveGraph`, `useEditor`.
- Multiple graph tabs can be open at once (`graph:<id>` tabs), each fully
  isolated; panels follow the focused graph. New/close graph actions; sessions
  are created/disposed with their tabs.
- **Breaking:** per-graph store factories and the transformers `flowToBehave`
  and `buildUIGraphJSON` now take a `GraphSession` instead of `System`.

### Per-session execution

- Execution is per-graph: a shared `GraphRunner` connection plus a per-session
  `GraphRunController`; server messages are routed back to the originating graph
  by run id, so multiple graphs run independently. Run controls live in each
  graph's toolbar.

### Subgraphs (graph invokes graph)

- New `Call Subgraph` node plus `graph/input` / `graph/output` boundary nodes; a
  graph's contract (`graphInputs`/`graphOutputs`) is authored from the boundary
  nodes and serialized.
- Subgraph output (and input) socket display names are editable without breaking
  wiring (stable id + display label).

### Auto-convert transformer

- When connecting different-but-convertible value types (with the auto-convert
  setting on), a conversion node is automatically spliced in. Conversions are a
  configurable registry (`registerConversion`, edited in System Settings) that
  overrides a generic spec-derived default, so custom profiles can define their
  own.

### Graph & editor properties

- New Graph Properties panel for the graph name (reactive tab title) + arbitrary
  graph metadata.
- Editor settings (UI toggles + custom conversions) are serializable via
  `serializeSettings()` / `applySettings()` and persist through
  `enableSettingsPersistence()` (pluggable storage; localStorage by default).

## `@kiberon-labs/behave-graph`

- Subgraph runtime: `graph/input`, `graph/output`, `flow/callSubgraph` core nodes
  plus `runSubgraph()` and the `IGraphApi` / `ISubgraphRun` dependencies. A
  subgraph behaves like a function — it returns once at the first output, and
  recursion/cycles are guarded by a call-stack + depth limit.
- `Engine.dispose()` now also clears pending async nodes so execution winds down
  after disposal.
