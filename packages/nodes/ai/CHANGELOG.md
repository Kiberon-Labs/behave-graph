# @kiberon-labs/behave-graph-nodes-ai

## 1.0.0

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
  - @kiberon-labs/behave-graph-flow@3.0.0
  - @kiberon-labs/behave-graph@1.2.0
