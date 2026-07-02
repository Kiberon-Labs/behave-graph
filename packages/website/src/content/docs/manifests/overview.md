---
title: Package Manifests
description: Statically describe the nodes, value types, UI contributions and host requirements a package provides — so editors and tools can discover it without importing or executing its code.
---

A **package manifest** is a static JSON file that describes everything a node
package provides — its nodes, value types, editor contributions, classification
and any host requirements — **without importing or executing the package's
code**. Tools read the manifest to build a node palette, validate a graph, or
decide whether a package is safe to load, while the package's executable code
(node `exec` functions, value serializers, WASM init, React components) is loaded
only by a runner, or on explicit, user-consented demand.

## Why manifests exist

Historically the only way to learn what a package provides was to call its
`registerProfile`, which **imports and runs** every node's implementation —
closures, side effects, even WASM initialisation. That is both a security
concern (enumerating a third-party package means executing it) and a performance
cost (heavy initialisation just to list nodes).

The editor, however, never needed that code to *draw* a graph. The Flow editor
already renders entirely from [`NodeSpecJSON`](../../core-concepts/registry/) plus
value display metadata. A manifest is simply the **persisted, on-disk form of
that static projection**, extended with the few extra things a host needs to
know.

This splits a package cleanly in two:

| Static (the manifest)                          | Executable (loaded on demand) |
| ---------------------------------------------- | ----------------------------- |
| Node specs (type, label, sockets, config)      | Node `exec` / `triggered`     |
| Value type display + JSON default              | Value `serialize` / `lerp` …  |
| Declarations of UI contributions               | The React components          |
| Categories & host requirements                 | A persistent backend process  |

The static half is safe to read anywhere. The executable half is gated.

## The manifest shape

A manifest is produced by the core helper `writeManifest` and validated by
`parseManifest`. Its shape (`ManifestJSON`):

```jsonc
{
  "manifestVersion": 1,
  "package": { "name": "@acme/nodes-image", "version": "1.0.1" },

  // Function-free value type metadata. `defaultJSON` is serialize(creator()).
  "values": [
    { "name": "image", "defaultJSON": null, "label": "Image", "color": "#8a5cf6" }
  ],

  // Exactly the NodeSpecJSON the editor already consumes, plus optional extras.
  "nodes": [
    {
      "type": "image/blur",
      "category": "Action",
      "label": "Image: Blur",
      "inputs":  [ { "name": "image", "valueType": "image" }, { "name": "radius", "valueType": "float", "defaultValue": 0 } ],
      "outputs": [ { "name": "image", "valueType": "image" } ],
      "configuration": []
    }
  ],

  // Declarative pointers to code contributions (see below). Loaded lazily.
  "contributions": [
    { "id": "image-control", "kind": "control",  "export": "./ui.js#ImageControl", "bind": { "controlName": "image" } },
    { "id": "image-output",  "kind": "panel",    "export": "./ui.js#ImageOutputPanel" }
  ],

  // The module a runner imports to obtain the executable registry — never the editor.
  "runtime": "./index.js",

  // Open-ended classification and host requirements (see below).
  "categories": ["integration"],
  "requirements": [],
  "metadata": {}
}
```

### Value types and the pass-through model

The editor calls value-type functions at author time — `creator()` to seed a new
variable, `serialize`/`deserialize` to round-trip a graph's stored values. A
manifest can only carry JSON, so value entries are **function-free** (`name`,
`defaultJSON`, optional `label`/`color`).

When a manifest loads, the editor synthesises a **pass-through value type** from
each entry: the value is already its own JSON form, so `serialize`/`deserialize`
are identity and `creator()` returns a clone of `defaultJSON`. Every existing UI
call site keeps working with **zero code execution**. If the package is later
trusted-loaded, a `valueType` contribution can replace the pass-through with the
real, function-bearing implementation.

### UI contributions

Editor extensions — custom input controls, node renderers, panels, socket
generators, conversions, commands, context-menu entries, and real value-type
behaviour — are code, so they cannot live in JSON. The manifest instead
*declares* them as `contributions`, each pointing at a module export:

```jsonc
{ "id": "image-control", "kind": "control", "export": "./ui.js#ImageControl", "bind": { "controlName": "image" } }
```

`kind` is one of `control`, `specific`, `panel`, `socketGenerator`,
`conversion`, `command`, `contextMenu`, or `valueType`. Each maps to the matching
editor [extension surface](../../flow/plugins/#extension-surfaces). Contributions are
imported and registered **only under the host's trust gate** (see
[Trust & security](#trust--security)).

## Package categories and host requirements

Beyond nodes, a manifest declares **what the package is** and **what its host
must provide**. These are authored, not derived from the registry, and are
designed to stay flexible.

- **`categories: string[]`** — open classification. The `PackageCategory`
  constants (`pure`, `io`, `integration`, `effect`) are advisory; any string is
  valid, so new classifications never force a schema change.

- **`requirements: PackageRequirement[]`** — capabilities the package needs from
  its host, discriminated by `kind`. Known kinds are typed, but an open escape
  hatch (`{ kind: string; … }`) means a host must tolerate kinds it does not yet
  understand — so the manifest can describe new situations without a version
  bump.

### Backend services

Some packages need a **persistent host process**, not just an in-process
registry. The canonical example is Slack: its trigger nodes rely on a standing
WebSocket connection and an out-of-band signal that can **wake up and start a
graph**. A `backendService` requirement captures that:

```jsonc
{
  "kind": "backendService",
  "reason": "Slack trigger nodes need a persistent WebSocket connection",
  "entry": "./server/index.js",   // module the host runs and keeps alive
  "persistent": true,             // stays up across and between graph runs
  "providesTriggers": true,       // can originate events that start a graph
  "dependentNodes": ["slack/onMessage"],
  "transport": "websocket"
}
```

This is distinct from `runtime` (the in-process executable registry a runner
imports to *evaluate* nodes). A `backendService` is a long-lived, out-of-band
component. A host that supports backends (the VS Code extension, or a server)
loads `entry` under the trust gate, keeps it alive, and owns the wake/start-graph
path; a pure browser editor simply surfaces the requirement and runs everything
else.

A `config` requirement declares the secrets/keys a package needs:

```jsonc
{ "kind": "config", "keys": [ { "name": "SLACK_BOT_TOKEN", "required": true, "secret": true } ] }
```

The editor can use `requirements` to badge a package as "needs a backend" or
"requires configuration", and to mark `dependentNodes` unavailable until the
backend is live.

## Generating a manifest

Manifests are generated at **build time**, by running the package's own
(trusted) registry once. Reusing the same `writeNodeSpecsToJSON` the editor uses
guarantees the node specs are identical to runtime.

A package adds a side-effect-light **manifest source** (`src/manifest.source.ts`)
that declares everything authored — the registry builder, contributions,
categories and requirements. Contributions are plain data here (no React
imports), so generation never pulls the UI bundle:

```typescript
import { defineManifestSource } from '@kiberon-labs/behave-graph';
import { buildImageRegistry } from './registry.js';
import pkg from '../package.json' with { type: 'json' };

export default defineManifestSource({
  package: { name: pkg.name, version: pkg.version },
  registry: () => buildImageRegistry(),        // the package's own registerProfile
  runtime: './index.js',
  categories: ['effect'],
  contributions: [
    { id: 'image-control', kind: 'control',   export: './ui.js#ImageControl', bind: { controlName: 'image' } },
    { id: 'image-output',  kind: 'panel',     export: './ui.js#ImageOutputPanel' },
    { id: 'image-value',   kind: 'valueType', export: './values/index.js#ImageValue', bind: { valueType: 'image' } }
  ]
});
```

Then run the bundled CLI as part of the package build:

```bash
behave-graph-manifest dist/manifest.source.js --out dist/behave-graph.manifest.json
```

The output is a plain `.json` file — `behave-graph.manifest.json` is the
canonical name (exported as `MANIFEST_FILE_NAME`), so any JSON loader reads it
directly. Passing a directory to `--out` writes that filename into it.

Reference the result from `package.json` so hosts can find it:

```jsonc
{
  "behaveGraph": { "manifest": "./dist/behave-graph.manifest.json" },
  "files": ["dist", "dist/behave-graph.manifest.json"]
}
```

The programmatic equivalents are `runManifestSource(source)` (await the registry,
build the manifest) and `writeManifest({ package, registry, contributions, … })`.

## Consuming a manifest in the editor

The Flow editor loads a manifest with `loadManifest` (or the `manifestPlugin`
wrapper). The static parts always load; code contributions load only under
trust.

```typescript
import { manifestPlugin } from '@kiberon-labs/behave-graph-flow';

await system.registerPlugin(manifestPlugin, {
  manifests: [imageManifest],

  // Without `trust`, only nodes + pass-through value types load — no package
  // code runs. The palette is fully populated from JSON alone.
  trust: isPackageTrusted('@acme/nodes-image'),

  // Required to load contributions. The host owns this because a bundler must
  // know the concrete module; it maps a contribution's `export` to a value.
  resolve: async (contribution) => {
    if (contribution.export === './ui.js#ImageControl') {
      return (await import('@acme/nodes-image/ui')).ImageControl;
    }
    // …
  },

  // Surface host requirements (no code executes here).
  onRequirement: (req, manifest) => {
    if (req.kind === 'backendService') showBackendBadge(manifest.package.name, req);
  }
});
```

`loadManifest` performs three steps:

1. **Always (no code execution).** Register the node specs and pass-through
   value types into the editor registry. The palette renders.
2. **Surface requirements.** Call `onRequirement` for each declared requirement.
3. **Contributions (gated).** Only when `trust` is true *and* a `resolve`r is
   provided, import each contribution's `export` and register it through the
   matching store. A failing contribution is logged and skipped; it never aborts
   the rest.

## Trust & security

The model has a single, clear boundary:

- **Reading a manifest never executes package code.** Enumerating nodes,
  rendering the palette, validating a graph and showing requirements are all
  safe, static operations. `parseManifest` validates an untrusted manifest's
  shape before anything consumes it.
- **Executing package code is always gated.** Loading a contribution, a
  `valueType` implementation, the `runtime` registry, or a `backendService`
  entry requires explicit trust — typically a per-package allowlist the host
  persists and surfaces in its UI.

This lets a host present a full, accurate editor for packages it has never run,
and only cross the execution boundary when the user opts in.

## Status

The manifest format, build-time generation (`writeManifest`, the
`behave-graph-manifest` CLI, `defineManifestSource`) and validation
(`parseManifest`) ship in `@kiberon-labs/behave-graph`. Editor consumption
(`loadManifest`, `manifestPlugin`, the pass-through value-type model and the
contribution dispatch) ships in `@kiberon-labs/behave-graph-flow`. The image and
scene node packages both generate manifests at build time as reference
implementations (image: 13 nodes + 1 value type; scene: ~191 nodes + 8 value
types with a control and per-type value contributions), and the
VS Code extension can statically discover manifests by scanning `node_modules`
for `package.json#behaveGraph.manifest` (reading JSON only, no imports). Wiring
discovered manifests into the VS Code webview — merging their specs into the
palette and resolving trusted code contributions — is the remaining integration
step.

## See also

- [Registry](../../core-concepts/registry/) — the runtime structure a manifest is the
  static projection of.
- [Profiles](../../core-concepts/profiles/) and [Nodes](../../core-concepts/nodes/)
  — how the executable nodes a manifest describes are defined.
- [Flow → Plugin System](../../flow/plugins/) — the imperative extension surfaces a
  manifest's contributions map onto.
