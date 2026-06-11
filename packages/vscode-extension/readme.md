# kiberon-labs Behave Graphs for VScode

This is a proof of concept exploration of embedding the graph engine inside of VS Code for faster iteration of behave graph

## Features

- Provides a custom editor for the new file extension type `.kbgraph` which is a kiberon-labs specific format for the serialized behave graph.

- Custom icons for the `.kbgraph` format

- Provides a command to quick create new Graph files

- Built-in graph execution server with support for custom registries

## Custom frontend plugins

Frontend plugins can be loaded dynamically via the use of a `plugin.js` file adjacent to a graph.

## Custom Registry Support

The GraphRunnerServer supports loading custom registries to extend or replace the default core profile nodes. When you load a `.kbgraph` if there is a `registry.js` file next to the file it will be dynamically loaded 

### Usage

Create a `registry.ts` or `registry.js` file that exports a configured Registry:

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

Then pass the path when creating the server:

```typescript
const server = await GraphRunnerServer.create(transport, {
  customRegistryPath: '/absolute/path/to/registry.ts'
});
```

See [example/custom-registry.ts](example/custom-registry.ts) for a complete example.


## Requirements

No special requirements needed

## Extension Settings

No settings are currently exposed.

## Known Issues

Due to how serialization occurs for array buffers and typed arrays, you must use engine 1.57.0 and above of vscode to prevent huge data transfer inefficiencies

## Release Notes

Please see the changelog included in the project for more information
