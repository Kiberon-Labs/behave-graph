# @kiberon-labs/behave-graph-nodes-image

## 2.0.0

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

- cf72d27: Greatly expand the image node set and fix latent WASM buffer / loader bugs.

  ## New nodes (13 → 39)

  Added 26 nodes built on `@imagemagick/magick-wasm`, organized by category:

  - **Geometry / transform**: `image/resize`, `image/crop`, `image/rotate`,
    `image/thumbnail`, `image/trim`, `image/extent` (canvas resize with
    background fill), `image/border`.
  - **Color / tone**: `image/brightnessContrast`, `image/modulate` (HSB),
    `image/level`, `image/gamma`, `image/normalize`, `image/autoLevel`,
    `image/autoGamma`, `image/sigmoidalContrast`, `image/threshold`,
    `image/blueShift`.
  - **Blur / sharpen / artistic effects**: `image/gaussianBlur`,
    `image/adaptiveBlur`, `image/motionBlur`, `image/sharpen`, `image/charcoal`,
    `image/wave`, `image/noise`.
  - **Format**: `image/convert` — re-encode to PNG / JPEG / WebP / GIF / BMP /
    TIFF with an optional quality setting.
  - **Inspection**: `image/properties` — reads width, height, format, total
    colors, colorspace, density, depth and alpha. (This was previously dead code
    that mistakenly declared `typeName: 'image/negate'` and was never registered.)

  ## Bug fixes

  - **Freed WASM-heap output buffers**: `image.write((data) => data)` returns a
    `Uint8Array` that views WASM heap memory freed once the image is disposed, so
    node outputs became garbage as soon as a later operation reused that memory
    (surfacing as `NoDecodeDelegateForThisImageFormat`). All image-producing nodes
    now copy the bytes out inside the write callback, centralized in a new
    `transformImage` helper in `src/utils.ts`.
  - **Broken Node WASM loader**: `src/wasm.ts` resolved
    `@imagemagick/magick-wasm/package.json`, which the package's `exports` map
    blocks — the Node-side runner could never initialize ImageMagick. It now
    resolves the wasm via the exported `./magick.wasm` subpath (and the resolved
    main entry's directory).
  - **`image/solidColor` blue channel**: the blue value was clamped to `[200, 255]`
    instead of `[0, 255]`, making non-blue solid colors impossible.

  ## Internal

  - Existing transform nodes (`blur`, `flip`, `grayscale`, `negate`, `sepia`,
    `solarize`, `vignette`, `canny`, `oilpaint`) were refactored through the shared
    `transformImage` helper; `compose` copies its composited output out of WASM
    memory.
  - Added `tests/nodes.runtime.test.ts`, which initializes real WASM and executes
    every image-output node end-to-end (the existing manifest test only projects
    node specs without running them).

- cf72d27: Add a setting to toggle the inline image previews on image nodes.

  The image plugin now contributes an `image.showPreview` setting (via the editor's
  `system.registerSetting` API), so it auto-appears in the Settings panel under an
  "Image" section, persists, and defaults on. When turned off, the inline preview
  on image-producing nodes is hidden and its watch/decode work is skipped; turning
  it back on restores the previews live.

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

### Patch Changes

- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
- Updated dependencies [cf72d27]
  - @kiberon-labs/behave-graph-flow@3.0.0
  - @kiberon-labs/behave-graph@1.2.0
