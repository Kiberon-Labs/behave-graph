# @kiberon-labs/behave-graph-nodes-ai

AI nodes for behave-graph: define agents backed by a pluggable LLM provider,
drive a back-and-forth conversation, push messages into the chat from the graph,
and (next) attach tools the model can call.

Built on the [Vercel AI SDK](https://ai-sdk.dev) (`ai` + `@ai-sdk/openai` +
`@ai-sdk/anthropic`): the SDK handles provider differences, streaming and the
multi-step tool loop. This package wires it into the behave-graph editor and
exposes it as nodes.

## Pieces

- **Providers** (`src/providers`) — `createModel(config, modelId)` maps a
  serializable `ProviderConfig` onto a Vercel AI SDK `LanguageModel`
  (`createOpenAI` for openai/openrouter/custom OpenAI-compatible endpoints,
  `createAnthropic` for Anthropic).
- **Values** (`src/values`) — `aiProvider`, `aiAgent`, `aiTool`, `aiConversation`
  socket value types.
- **Nodes** (`src/nodes`):
  - `ai/provider` — build a provider config (kind + `credentialRef` + baseURL +
    model). **No API key** , `credentialRef` is a non-secret name resolved by the
    host (see Credentials).
  - `ai/agent` — define an agent (provider + model + system prompt + tools).
  - `ai/tool` — define a tool (name + description + JSON-schema parameters).
  - `ai/generateImage` — prompt → an `image` value (visualize it in the graph).
  - `ai/conversation` — produce a conversation handle to start from (empty `id` =
    the default/panel conversation).
  - `ai/forkConversation` — **action**: clone a conversation into a new branch
    and focus it (for explorations).
  - `ai/setupConversation` — connect an agent to a conversation (optional
    `conversation` input targets a branch; each branch has its own agent).
  - `ai/sendMessage` — **action**: push a message into a conversation (optional
    `conversation` input targets a branch; optional `image` input attaches a
    picture for vision; for a `user` message, get the `reply`).
  - `ai/onMessage` — **event**: fires when a message is added (optional
    `conversation` input scopes it to one branch).
  - `ai/onToolCall` — **event**: fires when the model requests a tool, with
    `callId`, `toolName` and `arguments` (JSON string).
  - `ai/toolResult` — **action**: answer a tool call (`callId` + `result`),
    resuming the agentic loop.
- **Runtime** (`src/runtime/ConversationRuntime.ts`) — the editor-side brain. It
  mirrors the conversation into `system.chatStore` (rendered by the flow
  `ConversationPanel`, the `conversation` tab), listens for user input on the
  `chat:userMessage` pubsub topic, and calls the AI SDK's `streamText` to produce
  replies.
- **Plugin** (`src/ui.tsx`) — `aiPlugin` registers the specs and wires the runtime
  onto `system.conversation`.

## How it fits together

Graph nodes run headless inside the engine and reach the editor-side
conversation through an injected dependency, exactly like the scene package's
`IScene`:

```
graph node ──getDependency('IConversationService')──▶ ConversationRuntime
                                                          │
                          chat:userMessage (pubsub) ◀─────┤──▶ system.chatStore ──▶ ConversationPanel
                                                          ▼
                                          streamText({ model, messages, tools })
```

The **same** `ConversationRuntime` instance must be both decorated on the system
(for the panel) and injected into the execution registry's dependencies (for the
nodes).

## Wiring (host / app)

```ts
import { System } from '@kiberon-labs/behave-graph-flow';
import { localGraphRunnerPlugin } from '@kiberon-labs/behave-graph-flow';
import {
  registerCoreProfile,
  ManualLifecycleEventEmitter,
  DefaultLogger
} from '@kiberon-labs/behave-graph';
import {
  aiPlugin,
  registerAIProfile,
  ConversationRuntime,
  type IAICredentials
} from '@kiberon-labs/behave-graph-nodes-ai';

const system = new System(nodeRegistry);
system.createSession('graph');

// Host-owned credentials , keys come from env / a secret store, NEVER the graph.
const credentials: IAICredentials = {
  getApiKey: (ref) => process.env[`${ref.toUpperCase()}_API_KEY`]
};

// One runtime, shared by the panel and the graph nodes.
const runtime = new ConversationRuntime(system, credentials);

const executionRegistry = registerAIProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger(),
      IConversationService: runtime,
      IAICredentials: credentials // for ai/generateImage (resolved in-engine)
    }
  })
);

system.registerPlugin(aiPlugin, { runtime });
system.registerPlugin(localGraphRunnerPlugin, { registry: executionRegistry });
```

Add the `conversation` tab to your dock layout to see the chat.

## Examples

Runnable example graphs live in [`stories/data`](stories/data/) and appear as
Storybook stories (`pnpm storybook` → the **AI** group):

- **`basicChat`** — `lifecycle/onStart → ai/setupConversation`, fed by
  `ai/provider → ai/agent`. Run it and the chat panel goes live.
- **`toolUse`** — an agent with a `get_current_time` tool; `ai/onToolCall →
  ai/toolResult` answers the model's tool calls inside the graph.
- **`exploration`** — `ai/conversation → ai/forkConversation → ai/sendMessage`
  branches the conversation and asks the fork a question; the **Conversations**
  panel shows the new branch.

The stories **auto-run** on load (the factory waits for the local runner to
connect, then calls `play()`), so `lifecycle/onStart → ai/setupConversation`
fires and the conversation is live immediately. Embedding the graphs yourself:
load one with `session.flowStore.getState().setGraph(graph)`, then run it (▶ /
`session.runController.play()`) , the agent connects only once the graph runs.
`tests/exampleGraphs.test.ts` loads each against the core + AI registry so they
stay valid.

## Credentials (no keys in the graph)

API keys never live in node params or saved graph JSON. The `ai/provider` node
carries only a non-secret `credentialRef`; the host resolves it to a real key at
the API-call boundary via an injected `IAICredentials`:

```ts
interface IAICredentials {
  getApiKey(ref: string): string | undefined;
}
```

`ref` is the provider node's `credentialRef`, or the provider `kind` when blank.
So leaving `credentialRef` empty resolves by kind (`openai` → your OpenAI key);
set it to address a named secret (e.g. two OpenAI accounts). The resolver runs in
two places, both fed the same host-owned credentials:

- the **runtime** (chat models) , passed to `new ConversationRuntime(system, credentials)`;
- the **`ai/generateImage` node** (image models) , read in-engine via
  `graph.getDependency('IAICredentials')`.

Resolved keys live only in memory (the built model); they are never written back
into any value that gets serialized.

### Testing with OpenRouter (free models)

The Storybook demo and example graphs are wired to a **free** OpenRouter model
(`openai/gpt-oss-120b`, `kind: "openrouter"`) so you can verify
the whole UI without spending anything. Provide your key (resolved by `kind`):

- **Storybook**: set `VITE_OPENROUTER_API_KEY` in the env, run `pnpm storybook`,
  open an **AI** story, and chat. (Without a key the panel still connects; sending
  shows a graceful auth error.)
- **Headless check**: a live test exercises the exact `createModel → AI SDK` path:

  ```sh
  OPENROUTER_API_KEY=sk-or-... pnpm --filter @kiberon-labs/behave-graph-nodes-ai test
  ```

  It's skipped when the key is absent (so CI never calls out). The provider
  wiring (auth header, base URL, model routing) is verified against OpenRouter
  independently.

## The agentic tool loop

Streaming and the multi-step tool loop are the AI SDK's job (`streamText` with
`stopWhen: stepCountIs(8)`). Graph-defined tools become SDK tools whose `execute`
bridges into the graph:

1. The runtime builds one SDK `tool()` per `ToolSpec` on the agent, with an
   `execute` that fires `ai/onToolCall` in the graph and awaits the matching
   `ai/toolResult` (`provideToolResult`).
2. `streamText` runs the loop , model → tool `execute` → model → … , and the
   panel renders `result.textStream` live.

The `execute` wait never hangs: with no `ai/onToolCall` handler, or if the graph
doesn't answer within 30s, it resolves to an error result and the model
continues. Tool dispatch requires the graph to be **running** (the local runner's
event loop drives the `ai/onToolCall` event node).

## Conversations & exploration

A conversation is a graph value (`aiConversation`, an opaque handle); the runtime
manages many of them keyed by id. One is **focused** , its history is mirrored
into the chat panel and panel input routes to it. Non-focused branches still run
(histories update, `onMessage` fires) but don't touch the panel.

To explore: start from `ai/conversation`, `ai/forkConversation` to branch (clones
history + focuses the new branch), then `ai/sendMessage` with a different prompt
on the fork. The graph topology becomes the exploration tree. Forks are
independent , a later message to one branch doesn't leak into another.

Each conversation has **its own agent** , a fork inherits the parent's agent, and
you can point `ai/setupConversation` at a branch to give it a different
model/prompt/tools. So you can ask the same question down two branches with two
different models, side by side. The focused branch's agent drives the chat panel.

The **Conversations** panel (the `conversations` tab, registered by `aiPlugin`)
visualizes the tree: one row per branch, indented by fork depth, focused branch
highlighted, showing the branch's model and a message-count badge. Click a branch
to focus it , its history loads into the chat panel. It's driven by
`system.conversation.store` (an observable zustand store of the tree).

## Multimodal

### Image in (vision)

Connect any `image` value into `ai/sendMessage`'s `image` input. The runtime
attaches it to the `user` message as a multimodal content part (the AI SDK
formats it per provider for vision-capable models), and renders it as a thumbnail
in the chat panel. (Panel + store carry an `attachments` list of ready-to-render
data URLs; the AI package does the bytes → data-URL conversion, so the flow
package stays free of image decoding.)

### Image out

`ai/generateImage` (AI SDK `generateImage`, OpenAI image API) emits an **`image`
value** , the exact `Uint8Array` value type the image package defines. So its
output flows straight into the image package's inline node preview and Image
Output panel via the realtime runner:

- Connect `ai/generateImage.image` → an `output/image` node to see it in the
  **Image Output** panel.
- The node also previews **inline**: the image package's preview now matches any
  node with an `image` output (value-type coupling), not just `image/*` types.

This is **name-coupled** , it only needs the image profile's `image` value type
registered alongside the AI profile (load both in your execution registry). No
hard dependency between the packages.

Image generation costs money + hits the network, so a failed/blank generation is
cached (logged, not retried) until you change an input , the preview runner won't
re-fire the same prompt every tick.

## Status / TODO

Implemented: the AI SDK integration (`createModel` + `streamText`) with streaming
and tool calls across OpenAI/OpenRouter/custom and Anthropic; the graph tool
bridge; multi-conversation runtime with fork/focus + **per-conversation agents**
(conversation-as-value); the exploration tree panel; image in/out; agent/
provider/tool builders; the conversation runtime + panel bridge; and the
conversation/fork/setup/send/generateImage/onMessage/onToolCall/toolResult nodes.

Not yet implemented (intentional next steps):

- **Multiple images per message** — `ai/sendMessage` takes a single `image`
  today; a list socket would allow several.
- **Multiple tools per agent** — a `tool[]` list socket or an `ai/toolset` combiner
  (the `ai/agent` node currently takes a single `tool`).
