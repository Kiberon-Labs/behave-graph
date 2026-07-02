---
"@kiberon-labs/behave-graph-nodes-slack": minor
"@kiberon-labs/behave-graph": minor
---

Slack connector node package and the backend-service manifest standard for
server-installed side effects.

## `@kiberon-labs/behave-graph-nodes-slack` (new package)

A connector package that lets a graph push messages to Slack and be triggered by
Slack events. Like the ai package, node definitions stay portable in the saved
graph while the thing that talks to Slack is a host-injected dependency.

### Nodes & values

- **Actions** (use the injected `ISlackClient`): `slack/sendMessage` (plain text),
  `slack/sendStructuredMessage` (Block Kit), and `slack/composeMessage` (builds a
  `slackMessage` value from text + blocks JSON).
- **Events** (subscribe to the injected `ISlackEventSource`): `slack/onMessage`,
  `slack/onMention`, `slack/onReaction`, each with a configurable channel /
  workspace filter.
- New `slackMessage` socket value type. The bot token lives in the host client,
  never in the saved graph.

### Local / backend split

- Two host dependencies, augmented onto core's `Dependencies`: `ISlackClient`
  (outbound) and `ISlackEventSource` (inbound). Event nodes register a
  declarative `SlackTriggerDescriptor` (`{ type, channel?, workspace? }`) at
  startup, so a host can route events without understanding graph internals
  (`matchesTrigger` is the reference matcher).
- `LocalSlackConnector` implements both interfaces: `chat.postMessage` sends plus
  in-memory subscriptions fed by `dispatch()` / `dispatchRaw()` (and a static
  `normalizeEvent`). `setPump` drives one engine; `addPump` fans one connector out
  to many concurrent run engines.

### Server install via the manifest

- Generates `behave-graph.manifest.json` declaring `categories: ['integration']`
  and `requirements`: a `backendService` (the persistent Socket Mode component)
  and `config` (the required tokens).
- `src/backend.ts` is the backend entry: on `start(context)` it opens a Socket
  Mode connection (the side effect), pipes inbound events into the connector, and
  returns `{ ISlackClient, ISlackEventSource }` + `stop()`. `@slack/socket-mode` /
  `@slack/web-api` are **optional** peer dependencies, dynamically imported only
  there, so the base package stays dependency-light;
  `createSlackBackendService({ socketFactory })` injects a custom client.
- `examples/server.mjs` is a runnable, offline end-to-end demo of the whole path
  (manifest → `loadBackendService` → inject deps → run a graph on a simulated
  mention).

## `@kiberon-labs/behave-graph`

- New backend-service execution contract in `Manifest/BackendService.ts`, the
  runtime counterpart to the manifest's `backendService` requirement:
  `BackendServiceEntry` / `BackendServiceInstance` / `BackendServiceContext`
  (`config` + optional `logger` / `startRun`), `defineBackendService`,
  `resolveBackendServiceEntry`, and the host helper `loadBackendService(requirement,
  { import, context })` — the standard way a host boots a package's persistent
  side effects and collects the engine dependencies they contribute. Additive;
  no existing API changes.
