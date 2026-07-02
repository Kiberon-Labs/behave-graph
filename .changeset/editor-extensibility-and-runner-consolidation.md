---
"@kiberon-labs/behave-graph-flow": minor
---

Editor extensibility (plugin registries + session extensions), runner
consolidation, declarative config, reactivity/trace fixes, and a UI polish pass.

## Plugin & extension system

- **Session extensions** for per-graph state: `system.registerSessionExtension`
  runs against every graph (existing + future) and may return a cleanup;
  `GraphSession.onDispose()` and a typed `decorate()` (augment `IGraphSession`)
  attach plugin-owned per-graph state. The graph runner's per-session
  `runController` now attaches through this hook, so core no longer depends on the
  runner plugin.
- **Command registry**: `system.commandStore` + `system.runCommand(id, ctx?)`
  with built-in editor/view/selection commands. Hotkeys, the menu bar and context
  menus all dispatch by command id (one implementation, many entry points). Fixes
  the previously no-op Edit ▸ Copy/Paste menu items.
- **Context-menu registry**: `system.contextMenuStore` (targets `node` / `edge` /
  `selection` / `pane`); the built-in menus are migrated onto it so hosts can
  add/override items by id.
- **`registerDefaults(system)`** (idempotent) bootstraps built-in content
  (default socket generators + the subgraph contract sync); fixes a latent
  double-registration when multiple graph tabs were open.
- The **web-worker graph runner** plugin (`webWorkerGraphRunnerPlugin` /
  `WorkerTransport`) is now exported from the package root.

## Runner consolidation

- New `IExecutionControl` capability interface (+ `supportsExecutionControl`
  guard) for pause/resume/step; `LocalTransport` implements it and the run
  controller uses it instead of reaching into transport internals.
- The local transport now reuses the shared execution utilities (tracing,
  registry preparation, the `ActiveRun` shape) rather than duplicating them,
  removing drift between the local and web-worker runners.

## Declarative configuration

- The editor settings store is derived from a single schema (state, setters and
  the persisted-key list). Fixes: `inlineValues` now round-trips on load and
  `setShowMenu` is properly typed.
- Hotkeys are defined by one declarative binding table that dispatches commands;
  fixes the `ZOOM_RESET` (Ctrl+0) keymap/handler mismatch and makes Toggle
  Minimap work.

## Auto-convert

- Conversion rules can pin the converter node's input/output **ports**
  (`inputKey` / `outputKey`), with type-aware port resolution for multi-port
  converters and matching port pickers in the System Settings editor.

## Call Subgraph reactivity

- Call Subgraph nodes stay in sync with their referenced graph's contract:
  adding, removing, renaming or retyping a subgraph input/output now propagates to
  every caller across open graphs without re-selecting the graph.

## Trace panel fixes (web-worker runner)

- Fixed duplicate spans (double client-listener registration), incorrect/huge
  timeline timestamps (relative tick labels; preserve `0` start times), invisible
  zero-duration spans (minimum visual length), and the inability to zoom out past
  the captured range.

## Editor UI

- A VS Code-style density/theming pass: shared compact section headers across
  panels, tighter node/socket density, floating toolbar and menus re-themed to
  `--vscode-*` tokens, a fixed (oversized) dock resize divider, settings-panel and
  Node Inputs cleanup, consistent Variables/Events headers, consolidated design
  tokens with the vscode theme backfilled, and Storybook defaulting to dark mode.
