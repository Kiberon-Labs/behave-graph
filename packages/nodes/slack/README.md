# @kiberon-labs/behave-graph-nodes-slack

Slack connector nodes for behave-graph: post text or Block Kit messages to Slack
from a graph, and **trigger** graphs from inbound Slack events (messages,
mentions, reactions).

The graph never holds a Slack token and never talks to Slack directly. It speaks
to two injected dependencies, exactly like the ai package's `IConversationService`
and core's `ILifecycleEventEmitter`:

| Dependency           | Direction | Used by                                            |
| -------------------- | --------- | -------------------------------------------------- |
| `ISlackClient`       | outbound  | `slack/sendMessage`, `slack/sendStructuredMessage` |
| `ISlackEventSource`  | inbound   | `slack/onMessage`, `slack/onMention`, `slack/onReaction` |

## Pieces

- **Abstractions** (`src/abstractions`) — the runtime-agnostic contract:
  - `types.ts` — `SlackEvent`, `SlackMessageSpec`, `SlackSendInput/Result`, and
    the `SlackTriggerDescriptor` that event nodes register (plus `matchesTrigger`).
  - `ISlackClient` — `sendMessage(input)`.
  - `ISlackEventSource` — `subscribe(descriptor, handler)`.
  - `dependencies.ts` — augments core's `Dependencies` so `getDependency` is typed.
- **Values** (`src/values`) — the `slackMessage` socket value type.
- **Nodes** (`src/nodes`):
  - `slack/composeMessage` — **logic**: build a `slackMessage` (text + Block Kit
    JSON + optional thread ts).
  - `slack/sendMessage` — **action**: post plain text to a channel.
  - `slack/sendStructuredMessage` — **action**: post a composed `slackMessage`.
  - `slack/onMessage` / `slack/onMention` / `slack/onReaction` — **events**.
- **Runtime** (`src/runtime/LocalSlackConnector.ts`) — a dependency-light
  reference connector implementing **both** interfaces: `chat.postMessage` for
  sends, and in-memory subscriptions fed by `dispatch()` for events.
- **Profile** (`src/index.ts`) — `registerSlackProfile(registry)` merges the
  nodes + values into an execution registry.

## The local / backend split (the important part)

Event nodes are part of the saved, portable graph. The thing that actually
connects to Slack is **not** — it's host-provided. `ISlackEventSource` is the seam.

```
            saved graph (portable)              host-provided (not in the graph)
   ┌──────────────────────────────────┐      ┌─────────────────────────────────┐
   │ slack/onMention                  │      │      ISlackEventSource impl      │
   │   init():                        │      │                                  │
   │     subscribe(                   │ ───▶ │  • holds the live Slack link     │
   │       {type:'app_mention',       │      │  • normalizes raw → SlackEvent   │
   │        channel:'C123'}, handler) │      │  • routes events to handlers     │
   │   handler(): commit('flow') ─────┼──┐   │  • pumps engine.executeAllAsync  │
   └──────────────────────────────────┘  │   └─────────────────────────────────┘
                                          └──▶ fiber enqueued, runs on next pump
```

A node registers a **declarative `SlackTriggerDescriptor`** (the *what*), not a
socket. That descriptor is the routing key and is what makes the two
implementations possible from one graph:

- **Local / in-editor** — `LocalSlackConnector` keeps `(descriptor, handler)`
  pairs in memory. You hand it events via `dispatch(slackEvent)` /
  `dispatchRaw(rawPayload)`; it matches with `matchesTrigger` and calls the
  handlers. No live connection, no SDK dependency — enough to build and test.

- **Backend server (the real target)** — the behave-graph server loads its own
  connector **independently of any single run**, owns the Socket Mode / Events
  API connection + token management, and implements the same `ISlackEventSource`.
  Because it can enumerate the descriptors registered across every active run, it
  knows which Slack subscriptions/scopes to request and how to route an incoming
  event to the right run + node — **without inspecting graph internals**. Swapping
  local → backend changes only which object is injected; the graph is untouched.

### Run-loop contract

An event-driven Slack graph is **long-lived**, unlike a one-shot start/tick/end
run. After delivering events to handlers (whose `commit('flow')` enqueues fibers),
the host must pump the engine so those fibers execute:

```ts
slack.setPump(() => engine.executeAllAsync());
```

and keep the run + engine alive between events (don't `engine.dispose()` until the
run is torn down). A production backend wires the connector's event delivery to the
owning run's engine and manages that lifecycle per run.

## Wiring (local)

```ts
import {
  Engine,
  registerCoreProfile,
  ManualLifecycleEventEmitter,
  DefaultLogger,
  readGraphFromJSON
} from '@kiberon-labs/behave-graph';
import {
  registerSlackProfile,
  LocalSlackConnector
} from '@kiberon-labs/behave-graph-nodes-slack';

// One connector satisfies both Slack dependencies. The token lives here, not in
// the graph.
const slack = new LocalSlackConnector({ token: process.env.SLACK_BOT_TOKEN! });

const registry = registerSlackProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger(),
      ISlackClient: slack,
      ISlackEventSource: slack
    }
  })
);

const graphInstance = readGraphFromJSON({ graphJson, registry });
const engine = new Engine(graphInstance, registry);

// Drive the engine after each delivered event.
slack.setPump(() => void engine.executeAllAsync());

// Feed events in from whatever transport you have (or by hand, for tests):
slack.dispatchRaw({
  type: 'app_mention',
  channel: 'C0123ABCD',
  user: 'U0456',
  text: '<@U0BOT> deploy please',
  ts: '1700000000.000100'
});
```

## Installing into a server (the backend-service standard)

The local wiring above is fine for a one-off script, but it makes you hand-build
the connection. The real goal is a server where a user **installs node packages**
and the server boots whatever side effects each package needs — here, the Socket
Mode listener — **without the server knowing anything Slack-specific**. The
manifest system makes that a standard, not bespoke glue.

### What the manifest declares

`behave-graph.manifest.json` (generated at build into `dist/`) classifies the
package and declares its host requirements:

```jsonc
{
  "categories": ["integration"],
  "requirements": [
    {
      "kind": "backendService",        // needs a persistent host process
      "entry": "./backend.js",         // the module the host boots
      "persistent": true,
      "providesTriggers": true,        // can wake/start a graph
      "transport": "websocket",
      "dependentNodes": ["slack/onMessage", "slack/onMention", "slack/onReaction"]
    },
    {
      "kind": "config",                // secrets the host must provide
      "keys": [
        { "name": "SLACK_BOT_TOKEN", "required": true, "secret": true },
        { "name": "SLACK_APP_TOKEN", "required": true, "secret": true }
      ]
    }
  ]
}
```

A pure browser editor reads this (no code execution) and shows a "needs backend /
requires config" badge, marking the trigger nodes unavailable until a backend is
live. A backend-capable host acts on it.

### What the host does (generic, ~10 lines)

The `backendService.entry` module exports a `BackendServiceEntry` (`{ start(ctx)
}`). The host imports it under its trust gate and calls core's
`loadBackendService` — the single standard way to "call a package's side effects
into the system":

```ts
import { loadBackendService } from '@kiberon-labs/behave-graph';

// `manifest` came from scanning an installed package's package.json#behaveGraph.
const backendReq = manifest.requirements.find((r) => r.kind === 'backendService');

const service = await loadBackendService(backendReq, {
  import: (entry) => import(/* host-resolved */ entry), // trust gate
  context: {
    config: process.env,            // resolves SLACK_BOT_TOKEN / SLACK_APP_TOKEN
    logger,
    startRun: (req) => runtime.startGraph(req), // optional wake/start path
  },
});

// service.dependencies === { ISlackClient, ISlackEventSource } (live).
// Merge them into every execution registry; keep the service alive; call
// service.stop() on shutdown.
const registry = registerSlackProfile(
  registerCoreProfile({ nodes: {}, values: {}, dependencies: {
    ILifecycleEventEmitter, ILogger, ...service.dependencies,
  }})
);
```

Note the host code names nothing Slack-specific — it would boot a GitHub or
Discord package identically. That is the standard: the manifest's `categories` +
`requirements` tell the host *what kind of package this is and what it needs*, and
the `BackendServiceEntry`/`loadBackendService` contract tells it *how to start the
side effects and collect the dependencies*.

### What the Slack entry does (`src/backend.ts`)

On `start(context)` it reads the tokens, builds a `LocalSlackConnector`, opens a
Socket Mode connection (the side effect), pipes every inbound event through
`connector.dispatchRaw`, and returns `{ ISlackClient, ISlackEventSource }` + a
`stop()` that disconnects. `@slack/socket-mode` is an **optional** peer dependency,
dynamically imported only here — install it on the server, not in the editor. For
tests/alt transports, `createSlackBackendService({ socketFactory })` injects a
custom client.

A runnable, offline end-to-end demo of this whole path lives in
[`examples/server.mjs`](./examples/README.md) (`node examples/server.mjs` after a
build) — it reads the manifest, `loadBackendService`s the backend, and runs a
graph against a simulated mention.

For routing across many concurrent runs, the connector supports `addPump(pump)`
(register each run's `engine.executeAllAsync`, remove on teardown) so every live
engine drains the fibers an event enqueues.

## Scaffold status / TODO

Implemented: both dependency interfaces, the `slackMessage` value, compose + send
(text & structured) actions, message/mention/reaction events, the
`LocalSlackConnector` (fetch send + manual dispatch), the generated manifest with
`integration` category + `backendService`/`config` requirements, and the Socket
Mode backend entry behind the `loadBackendService` standard.

Intentional next steps:

- **More events** — `member_joined_channel`, `reaction_removed`, slash commands.
- **Channel-name resolution** — let the connector resolve `#general` → `C…` and
  cache it (today names are passed through; ids are most reliable).
- **Richer Block Kit authoring** — typed builder nodes instead of raw JSON.
- **Editor plugin** (`ui.tsx`) — a Slack panel / inline previews, like the ai and
  image packages.
```
