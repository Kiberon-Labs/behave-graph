# @kiberon-labs/behave-graph-flow

## 3.0.0

### Major Changes

- cf72d27: Multiple graph tabs, subgraphs, auto-convert, and persisted editor settings.

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
    subgraph behaves like a function  it returns once at the first output, and
    recursion/cycles are guarded by a call-stack + depth limit.
  - `Engine.dispose()` now also clears pending async nodes so execution winds down
    after disposal.

### Minor Changes

- cf72d27: New AI nodes package (agents, conversations, tools, multimodal), plus the
  realtime-preview and chat-panel plumbing that powers it.

  ## @kiberon-labs/behave-graph-nodes-ai (new package)

  A node package for building AI agents in the graph, on the [Vercel AI SDK](https://ai-sdk.dev)
  (`ai` + `@ai-sdk/openai` + `@ai-sdk/anthropic`).

  - **Agents & providers**: `ai/provider` (OpenAI / OpenRouter / custom
    OpenAI-compatible / Anthropic), `ai/agent`, `ai/tool`. `createModel` maps a
    serializable config onto an SDK `LanguageModel`.
  - **Conversation runtime**: `ConversationRuntime` bridges headless graph
    execution to the editor's chat panel via an injected `IConversationService`
    dependency (the same pattern the scene package uses for `IScene`), mirroring
    the focused conversation into `system.chatStore` and driving `streamText`.
    Streaming and the multi-step tool loop are the SDK's job; graph-defined tools
    become SDK tools whose `execute` bridges to `ai/onToolCall` / `ai/toolResult`.
  - **Conversation as a graph value + exploration**: `aiConversation` handles flow
    through sockets. `ai/conversation` + `ai/forkConversation` branch an
    exploration (forks clone history and are independent); `ai/sendMessage` /
    `ai/onMessage` / `ai/setupConversation` take an optional `conversation` input.
    A **Conversations tree panel** (the `conversations` tab) visualizes branches
    and switches focus.
  - **Per-conversation agents**: each branch has its own agent, so you can run the
    same prompt down two branches with two different models; forks inherit the
    parent's agent and the chat panel follows the focused branch.
  - **Multimodal**: `ai/generateImage` emits an `image` value into the graph
    (visualized via the image package's preview / Image Output panel,
    name-coupled); `ai/sendMessage` takes an optional `image` input for vision.
  - **Credential injection (no keys in the graph)**: the `ai/provider` node carries
    only a non-secret `credentialRef`; the host resolves it to a real key at the
    API-call boundary via an injected `IAICredentials` dependency. Keys never live
    in node params or saved graph JSON.

  ## @kiberon-labs/behave-graph-flow

  - **Realtime preview runner**: evaluate every _watched_ node output (pull the
    upstream function graph on demand), so live previews work for pure data graphs
    (e.g. image nodes) that no flow fiber drives. Previously only nodes carrying a
    `ui.realtime` annotation , which nothing set , were computed.
  - **Registry**: `updateRegistry` now merges node specs by type instead of
    replacing them, so layering multiple profiles/plugins (core + image + ai + …)
    no longer clobbers previously-registered node types.
  - **Conversation panel / chat store**: a `chat:userMessage` editor pubsub topic
    (fixing a standing type error), and a `ChatAttachment` / `attachments` field on
    chat messages with the `ConversationPanel` rendering image thumbnails , so a
    host AI subsystem can drive a multimodal chat.

  ## @kiberon-labs/behave-graph-nodes-image

  - The image plugin now builds an execution registry for the realtime preview
    runner (accepting an optional `registry`), so inline node previews and the
    Image Output panel actually render. Previously the runner had no registry and
    never built an engine.
  - The inline preview matches any node with an `image` output socket (value-type
    coupling) instead of only `image/*` node types, so image-producing nodes from
    other packages (e.g. `ai/generateImage`) get the inline preview for free.

- cf72d27: Abstract the editor's design system behind an intermediary `--ds-*` token layer
  so theming no longer hard-codes VS Code variables.

  - `css/vars.css` now defines a `--ds-*` "theme bridge" (canonical VS Code-dark
    defaults), and the semantic tokens (`--colors-*`, `--color-neutral-*`, …)
    resolve through it. Components reference `--ds-*` only  the ~283 raw
    `var(--vscode-*)` references across the component CSS were migrated, and the
    bundled `css/vscode.css` defaults file was removed.
  - VS Code coupling now lives in a single mapping the host owns: the extension
    re-declares the `--ds-*` layer as `var(--vscode-*, …)`, so the editor still
    tracks the user's active VS Code theme. (The lone remaining `--vscode-*`
    reference in the components is `--vscode-tree-item-padding`, a
    `@vscode-elements` component API var, not a theme token.)

  Migration note for VS Code webview hosts: map the editor's `--ds-*` tokens from
  `--vscode-*` in a small `:root` rule so the chrome follows the active VS Code
  theme. Standalone hosts (web, Storybook, tests) need no setup  they get the
  canonical dark defaults.

- cf72d27: Editor extensibility (plugin registries + session extensions), runner
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

- cf72d27: Add a Kiberon Labs theme  an opt-in alternate theme for the editor.

  - `css/themes/kiberon.css` re-declares the `--ds-*` bridge with the Kiberon Labs
    design tokens (dark, brand-canonical): crystal-purple accents, Geist type, and
    the brand surfaces/shadows. It is scoped (`[data-flow-theme="kiberon"]` /
    `.flow-theme-kiberon`) and ships inert in the bundle, so it coexists with the
    built-in theme rather than replacing it.
  - Graph node category accents are now themeable tokens (`--ds-node-*`); the
    Kiberon theme recolors them to the crystal palette and rounds the node corners.
  - A Storybook toolbar **Theme** toggle switches Default ↔ Kiberon for previewing.

  Activate by putting `data-flow-theme="kiberon"` (or `class="flow-theme-kiberon"`)
  on the editor's root container or `<html>`. Fonts fall back gracefully when Geist
  isn't loaded by the host.

- cf72d27: Static package-manifest system: let editors and tooling discover the nodes,
  value types, UI contributions and host requirements a package provides
  **without importing or executing the package's code**.

  Previously the only way to learn what a package offered was to call its
  `registerProfile`, which imports and runs every node implementation (closures,
  side effects, even WASM init)  a security and performance cost just to list
  nodes. A manifest is the persisted, on-disk form of the static projection the
  editor already renders from (`NodeSpecJSON` + value display metadata), so the
  executable half (node `exec`, value serializers, React components, a persistent
  backend) is loaded only by a runner or on explicit, trust-gated demand.

  ## `@kiberon-labs/behave-graph`

  New `Manifest/` module (exported from the package root), all additive:

  - **Schema** (`ManifestJSON`): function-free `ValueTypeSpecJSON`, `NodeManifestEntry`
    (the existing `NodeSpecJSON` plus optional authoring extras), `ContributionSpec`
    / `ContributionKind` (control, specific, panel, socketGenerator, conversion,
    command, contextMenu, valueType), open-ended `categories` (`PackageCategory`
    constants are advisory), and `requirements` (`PackageRequirement`, discriminated
    by `kind` with known `backendService` / `config` kinds **plus an open escape
    hatch** so hosts tolerate kinds not yet modelled).
  - **Generation** (build time): `writeManifest` (reuses `writeNodeSpecsToJSON`, so
    node specs are identical to runtime), `writeValueTypesToJSON` (function-free
    display + `serialize(creator())` default), `defineManifestSource` /
    `runManifestSource`, and a `behave-graph-manifest` CLI bin.
  - **Validation**: `parseManifest`, a dependency-free well-formedness gate a host
    runs on an untrusted manifest before consuming it.
  - **Conventions**: `MANIFEST_FILE_NAME` (`behave-graph.manifest.json`  a plain
    `.json` file, the canonical name; a directory `--out` writes it there) and
    `MANIFEST_PACKAGE_FIELD` (`behaveGraph`, the `package.json` field pointing at
    the manifest).

  ## `@kiberon-labs/behave-graph-flow`

  New `manifest/` module for consuming a manifest in the editor:

  - `loadManifest` / `manifestPlugin`: always register node specs + value types from
    JSON with **zero code execution** (the palette renders from JSON alone); surface
    declared host requirements via `onRequirement`; and load code contributions
    **only under an explicit `trust` flag + a host-provided `resolve`r** (the host
    owns module resolution because a bundler must know the concrete module). A
    failing contribution is logged and skipped, never aborting the rest.
  - `passthroughValueType`: synthesises a working `ValueTypeMetadata` from a
    function-free spec (identity (de)serialize, cloned default) so existing UI call
    sites keep working until a trusted `valueType` contribution swaps in the real
    implementation.
  - `contributionRegistry`: maps each `ContributionKind` to its editor store.

  ## `@kiberon-labs/behave-graph-nodes-image` and `@kiberon-labs/behave-graph-scene`

  Both packages now generate a `behave-graph.manifest.json` at build time as
  reference implementations:

  - A side-effect-light `src/manifest.source.ts` (`defineManifestSource`) declares
    the registry builder, `runtime` entry, category and contributions; the package
    `build` runs `behave-graph-manifest`, and `package.json#behaveGraph.manifest`
    points at the output. Spec generation runs no node code (image needs no WASM
    init; scene is fed a `DummyScene` for `IScene`).
  - **image**: 13 nodes + the `image` value type, with control / specific / panel /
    valueType contributions. `ui.tsx` now re-exports `ImageControl`,
    `imagePreviewSpecific` and an extracted `imageOutputTab` loader so a host can
    resolve them from the manifest.
  - **scene**: ~191 nodes + 8 value types (`vec2`…`mat4`), the `vec3` control and a
    `valueType` contribution per scene type.

  Also (private packages, no version bump): the VS Code extension gains
  `discoverManifests`, which statically scans `node_modules` for
  `package.json#behaveGraph.manifest` and reads/validates the JSON without importing
  package code; and the documentation site gains a dedicated "Package Manifests"
  section.

- cf72d27: Make the Settings panel schema-driven so plugins can contribute their own
  settings, VS Code style.

  - **Schema registry** (`store/settingsSchema.ts`): the panel is auto-generated
    from `SettingDescriptor`s (`boolean` / `number` / `string` / `enum` / `custom`),
    grouped by section, with a search/filter box and a per-row reset-to-default +
    "modified" indicator. Built-in settings are seeded as descriptors, so the
    rendered panel is unchanged.
  - **Plugin API** on the editor `System`: `registerSetting(descriptor)` /
    `registerSettings([...])` auto-render in the panel; `getSetting` / `setSetting`
    read and write values. Plugin-contributed settings persist alongside the
    built-ins (the host storage adapter is unaffected). Typed access to built-in
    settings (`settings.edgeType`, `settings.setShowGrid`, …) is preserved.

  Descriptors are plain, JSON-serializable data, so a declarative manifest
  `contributes.configuration` section can feed the same registry as a follow-up.

### Patch Changes

- cf72d27: Fix the Local Graph Runner staying in a "Running" state after a graph finishes.

  The local runner's `executeGraph` defaulted `autoEnd` to `true` but gated run
  completion on `!autoEnd`, so the completion path  which marks the run finished,
  emits the `completed` message, disposes the engine, and clears the panel's
  running / active-runs state  never executed. A graph that ran out of fibers
  reached the `completed` phase yet the run stayed `running` and the panel kept
  showing "Running". Completion now fires when the run actually reaches the
  completed phase (and isn't paused), and the manual step-through path syncs the
  panel state on completion too.

  The local transport kept its own copy of the run lifecycle that had drifted from
  the shared `executeGraphLifecycle` used by the web-worker runner (with inverted
  `autoEnd` logic). Both runners now share that single lifecycle implementation 
  the runner-specific behaviour (pause-aware fiber stepping, tick timing, and the
  on-complete / on-error side effects) is injected via hooks  so the completion
  logic can't drift between them again.

- cf72d27: Make `@vscode-elements` controls follow the active theme, and fix a few panel UI
  inconsistencies.

  - **Themeable vscode-elements**: `css/vscode-elements.css` feeds the `--vscode-*`
    custom properties that `VscodeButton` / `VscodeTextfield` / `VscodeCheckbox` /
    `VscodeSingleSelect` / etc. read from the editor's `--ds-*` tokens, so they
    follow the active theme (e.g. Kiberon purple) instead of falling back to their
    built-in VS Code blue. Native checkbox / range / radio controls pick up the
    theme accent via `accent-color`. (Inert in the real extension, where VS Code's
    injected `--vscode-*` win.)
  - **Menu density**: tighter dropdown menu item padding.
  - **Panel overflow**: vscode-elements form fields cap to their container width,
    fixing horizontal overflow in narrow panels (e.g. Graph Properties).
  - **Checkbox consistency**: the Layers panel's "Visible" checkbox now uses
    `VscodeCheckbox`, matching Settings and the rest of the editor (it was a native
    browser checkbox).
  - **Logs toolbar cleanup**: the toolbar action icons (auto-scroll / timestamps /
    export / clear) are sized to fit their buttons, and the active toggles use a
    boxless accent (solid icon + accent color) instead of a filled outlined box 
    ghost icon buttons throughout.
  - **Local Graph Runner panel** now follows the shared panel conventions
    (`BasePanel` + `SectionTitle` + `VscodeDivider` + the design-system spacing/type
    scale) instead of its own card-style sections and bespoke headers, matching the
    Settings/Logs panels. Also added to the panel visual-regression suite.
  - **Dock tabs**: dropped the bright focus-color top-accent line on the active dock
    tab, which read as a stray-line artifact when repeated across panels. The active
    tab is still set off by its lighter, content-colored background (the VS Code
    look).

- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
  - @kiberon-labs/behave-graph@1.2.0
