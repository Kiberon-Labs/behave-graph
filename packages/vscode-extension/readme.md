# kiberon-labs Behave Graphs for VScode

This is a proof of concept exploration of embedding the graph engine inside of VS Code for faster iteration of behave graph

## Features

- Provides a custom editor for the new file extension type `.kbgraph` which is a kiberon-labs specific format for the serialized behave graph.

- Custom icons for the `.kbgraph` format

- Provides a command to quick create new Graph files

- Built-in graph execution server with support for custom registries

## Custom frontend plugins

Frontend plugins can be loaded dynamically via the use of a `plugin.js` file adjacent to a graph.

## Examples

Ready-to-run example graphs live in [`examples/`](examples). Open an example's
`.kbgraph` in the editor and press **Run**; the adjacent `registry.ts` is loaded
automatically so its custom nodes are available. The set covers a headless
**workflow**, a Web-Audio-style **audio** chain (custom value type + node kind),
a **game** loop on `RealtimeEngine`, and an **embed** value type. See
[examples/README.md](examples/README.md).

## Custom Registry Support

The GraphRunnerServer loads custom registries to extend or replace the default
core profile nodes. When you open a `.kbgraph`, an adjacent `registry.ts` /
`registry.js` (or one named by a `.kbworkspace`) is dynamically loaded — TS is
transpiled on demand, so a `.ts` registry works without a build step.

### Usage

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

- **`executionHandlers`** — a map of custom node *kind* → handler, taught to the
  engine via `registerNodeExecutionHandler`. This lets you add brand-new node
  *kinds* (not just node types). See
  [examples/audio/registry.ts](examples/audio/registry.ts).
- **`createEngine`** — a factory `(graph, registry) => Engine` to run on a
  different engine, e.g. `RealtimeEngine`. See
  [examples/game/registry.ts](examples/game/registry.ts).

See [example/registry.ts](example/registry.ts) for the minimal template and
[examples/](examples) for complete, runnable registries.


## Requirements

No special requirements needed

## Extension Settings

No settings are currently exposed.

## Known Issues

Due to how serialization occurs for array buffers and typed arrays, you must use engine 1.57.0 and above of vscode to prevent huge data transfer inefficiencies

## Release Notes

Please see the changelog included in the project for more information
