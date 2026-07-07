---
title: Graph Runners & Execution Models
description: The built-in graph runner plugins and their three execution models  local, web worker, and remote.
---

The editor doesn't execute graphs itself; it talks to a **graph runner** plugin.
Every runner speaks the same client protocol and reuses the same per-graph run
machinery (run controls, traces, logs). They differ in exactly one thing: their
**transport**, which decides *where and how* a graph actually runs. Choosing a
runner therefore means choosing an **execution model**.

Three runners ship with the editor, all importable from
`@kiberon-labs/behave-graph-flow`:

| | **Local** | **Web Worker** | **Remote** |
| --- | --- | --- | --- |
| Plugin | `localGraphRunnerPlugin` | `webWorkerGraphRunnerPlugin` | `graphRunnerClientPlugin` + `WebSocketTransport` |
| Runs on | main thread (in-browser) | a Web Worker (off the main thread) | a separate server process |
| Registry lives | in the **host** (passed in options) | **inside the worker file** | on the **server** |
| Blocks the UI | yes, for heavy graphs | no | no |
| Pause / resume / step | ✅ | ▶ / ⏹ only | ▶ / ⏹ only |
| Call Subgraph | ✅ (resolves other open graphs) | not bundled | not bundled |
| Best for | quick local iteration, debugging | responsive UI during long runs | shared/server-side execution |

> The registry row is the important one. The **registry** (what nodes exist) is a
> separate concern from plugins, and each execution model owns its registry in a
> different place. See [Registry vs. plugins](./customizing-the-editor#registry-vs-plugins).

## Shared behaviour

Whichever transport you choose, the runner plugin sets up the same things:

- **One shared connection** (a `GraphRunner`) for the editor, and **one run
  controller per open graph** (attached through a
  [session extension](./plugins#per-graph-state-session-extensions)). Multiple
  graphs run independently and concurrently; each graph's run state, traces and
  logs stay isolated to its own tab.
- **Run controls** in the floating toolbar (play / stop, plus pause / step where
  the transport supports it) and a `p` hotkey to play/stop the focused graph.
- **Traces, logs and variable changes** stream back into the relevant graph's
  panels as it runs.

## Local (in-browser)

`localGraphRunnerPlugin` executes graphs on the main thread using the engine
directly. The node **registry is passed in**, so it shares the host's modules,
and it's the only runner that supports **interactive control** (pause / resume /
step) and **Call Subgraph** (it resolves other graphs you have open by id).

```typescript
import { localGraphRunnerPlugin } from '@kiberon-labs/behave-graph-flow';

await system.registerPlugin(localGraphRunnerPlugin, {
  registry // your IRegistry of nodes/values/dependencies
});
```

Because it runs on the main thread, a long or tight-looping graph can make the UI
unresponsive; a custom `tickStrategy` (defaulting to `requestAnimationFrame`)
paces tick events to keep the browser refreshing.

## Web Worker (off the main thread)

`webWorkerGraphRunnerPlugin` runs graphs in a Web Worker you provide, so heavy
execution never blocks the editor. The crucial difference: the **registry is
defined inside the worker file**, not passed from the host, because the worker is
a separate module with its own bundle.

```typescript
import { webWorkerGraphRunnerPlugin } from '@kiberon-labs/behave-graph-flow';

const worker = new Worker(new URL('./my-graph-worker.ts', import.meta.url), {
  type: 'module'
});

await system.registerPlugin(webWorkerGraphRunnerPlugin, { worker });
```

The worker module builds its own registry (with `registerCoreProfile` plus any
custom nodes) and runs the shared execution core. Interactive pause/step is not
available across the worker boundary, so the controls expose play/stop; and
because the worker can't reach your other open graphs, Call Subgraph nodes are
not resolved here.

## Remote (WebSocket server)

For server-side execution, register the underlying client plugin with a
`WebSocketTransport` pointed at your server. The **registry lives on the server**,
and many clients can connect to it.

```typescript
import {
  GraphRunnerClient,
  WebSocketTransport,
  graphRunnerClientPlugin
} from '@kiberon-labs/behave-graph-flow';

const client = new GraphRunnerClient({
  transport: new WebSocketTransport({ url: 'wss://example.com/graphs' })
});

await system.registerPlugin(graphRunnerClientPlugin, { client });
```

`graphRunnerClientPlugin` is the common core that the local and web-worker plugins
build on; using it directly lets you supply any transport. Interactive control and
Call Subgraph bundling are not provided by the remote transport.

## Choosing a model

- **Local** for the fastest feedback loop and full debugging (pause/step,
  subgraphs) while iterating.
- **Web Worker** when graphs are long-running or compute-heavy and you need the UI
  to stay responsive.
- **Remote** when execution must happen on a server (shared state, server-only
  capabilities, or running far larger graphs than the browser should).

The [VS Code extension](../vscode/using-the-extension) uses the local model with
a built-in execution server, and loads its registry from the project's
`registry.ts` / `.kbworkspace`.

## See also

- [Plugin System](./plugins) , how these plugins are authored, and the session
  extension that attaches the per-graph run controller.
- [Subgraphs](./subgraphs) , which depend on the local runner's graph resolution.
- [Customizing the Editor](./customizing-the-editor) , the registry-vs-plugins
  split that explains where each model keeps its nodes.
