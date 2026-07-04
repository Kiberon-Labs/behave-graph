# @kiberon-labs/behave-graph

## 1.2.0

### Minor Changes

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
    subgraph behaves like a function — it returns once at the first output, and
    recursion/cycles are guarded by a call-stack + depth limit.
  - `Engine.dispose()` now also clears pending async nodes so execution winds down
    after disposal.

- cf72d27: Static package-manifest system: let editors and tooling discover the nodes,
  value types, UI contributions and host requirements a package provides
  **without importing or executing the package's code**.

  Previously the only way to learn what a package offered was to call its
  `registerProfile`, which imports and runs every node implementation (closures,
  side effects, even WASM init) — a security and performance cost just to list
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
  - **Conventions**: `MANIFEST_FILE_NAME` (`behave-graph.manifest.json` — a plain
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
