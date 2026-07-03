import type { AgentSpec, ChatMessage, ChatRole, ToolCall } from './types.js';

/**
 * The bridge between headless graph execution and the editor-side conversation
 * UI.
 *
 * AI nodes run inside the behave-graph {@link Engine}, which has no access to
 * the editor `System` or its chat store. Following the same pattern the scene
 * package uses for `IScene`, the editor injects a concrete implementation of
 * this interface into the execution registry's `dependencies`. Nodes then reach
 * it via `graph.getDependency('IConversationService')`.
 *
 * The editor-side implementation lives in
 * {@link ../runtime/ConversationRuntime.ConversationRuntime}, which manages a set
 * of conversations (so the graph can fork and explore branches), mirrors the
 * focused one into `system.chatStore` (so the existing flow `ConversationPanel`
 * renders it), and drives the provider request/response loop.
 *
 * Methods that act on a conversation take an optional `conversationId`; when
 * omitted they target the currently focused conversation.
 */
export interface IConversationService {
  /**
   * Connect an agent to a conversation (default: the focused one). This is what
   * the `ai/setupConversation` node calls, and what makes the conversation panel
   * become active. Each conversation has its own agent, so a fork can explore
   * with a different model/prompt; forks inherit their parent's agent.
   */
  setAgent(agent: AgentSpec, conversationId?: string): void;

  /** Detach a conversation's agent (default: the focused one). */
  clearAgent(conversationId?: string): void;

  /**
   * Push a message into a conversation as an *action* (e.g. from the
   * `ai/sendMessage` node, so another part of the graph can drive the chat).
   * When the message role is `user`, this triggers a model completion and
   * resolves with the assistant's reply text. Other roles are appended without
   * triggering a completion and resolve with an empty string.
   *
   * `images` (raw bytes of the `image` value type) attach to a `user` message as
   * multimodal content parts for vision-capable models, and render as thumbnails
   * in the chat panel.
   */
  sendMessage(
    message: { role: ChatRole; content: string; images?: Uint8Array[] },
    conversationId?: string
  ): Promise<string>;

  /**
   * Fork a conversation: clone its history into a new conversation and return
   * the new id. Used by the `ai/forkConversation` node to branch an exploration.
   */
  forkConversation(sourceId: string): string;

  /**
   * Make a conversation the focused one , its history is mirrored into the chat
   * panel and panel input is routed to it.
   */
  focusConversation(id: string): void;

  /**
   * Subscribe to messages added to a conversation (user, assistant, system or
   * tool). With a `conversationId`, only that conversation's messages fire;
   * otherwise all do. Returns an unsubscribe function. Used by the `ai/onMessage`
   * event node so the graph can react to the conversation.
   */
  onMessage(
    listener: (message: ChatMessage) => void,
    conversationId?: string
  ): () => void;

  /**
   * Subscribe to tool calls the model requests during a completion. The graph
   * (via the `ai/onToolCall` event node) handles the call and must answer it
   * with {@link provideToolResult} using the same `call.id`. Returns an
   * unsubscribe function.
   */
  onToolCall(listener: (call: ToolCall) => void): () => void;

  /**
   * Answer a pending tool call (from the `ai/toolResult` node). Resolves the
   * runtime's wait so the agentic loop can feed the result back to the model.
   * No-ops if the call id is unknown or already answered.
   */
  provideToolResult(callId: string, result: string): void;
}
