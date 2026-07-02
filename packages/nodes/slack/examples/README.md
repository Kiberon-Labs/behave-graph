# Slack package examples

## `server.mjs` — install a package, run a workflow from a Slack event

A minimal host that does what a real behave-graph server does, end to end:

1. reads the package's generated `behave-graph.manifest.json`,
2. discovers the `backendService` + `config` requirements,
3. boots the backend via core's `loadBackendService` (the standard),
4. merges the returned `{ ISlackClient, ISlackEventSource }` into an execution
   registry, and
5. runs [`echo-mention.graph.json`](./echo-mention.graph.json) (a `slack/onMention`
   → `slack/sendMessage` echo) against a Slack event.

Build the package first, then run it offline — it simulates the Socket Mode
transport and captures the outbound `chat.postMessage`, so no Slack app or tokens
are needed:

```bash
pnpm --filter @kiberon-labs/behave-graph-nodes-slack build
node packages/nodes/slack/examples/server.mjs
```

Expected output ends with:

```
• graph posted 1 message(s):
•   → chat.postMessage channel=C0123DEMO text="hello from the example"
```

### Going real

```bash
pnpm --filter @kiberon-labs/behave-graph-nodes-slack add @slack/socket-mode @slack/web-api
SLACK_SIMULATE=false SLACK_BOT_TOKEN=xoxb-… SLACK_APP_TOKEN=xapp-… \
  node packages/nodes/slack/examples/server.mjs
```

This swaps the simulated transport for the package's default `./backend.js` entry,
which opens a live Socket Mode connection and keeps listening until Ctrl+C.
