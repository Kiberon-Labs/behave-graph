/**
 * Shared, runtime-agnostic AI types.
 *
 * These describe the *data* that flows between nodes and the conversation
 * runtime. The wire-level request/response shapes are owned by the Vercel AI SDK
 * (`ai` package); these stay provider-neutral.
 */

/** Conversation roles. `tool` carries the result of a tool/function call. */
export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** The id of the default conversation , the one the chat panel is bound to. */
export const DEFAULT_CONVERSATION_ID = 'default';

/**
 * An opaque handle to a conversation. Flows through sockets (the `aiConversation`
 * value type); the actual message history lives in the runtime, keyed by `id`.
 * A handle is runtime-minted (e.g. by a fork), so a handle persisted in a saved
 * graph is ephemeral , the runtime lazily creates an empty conversation for an
 * unknown id.
 */
export interface ConversationHandle {
  id: string;
}

/**
 * Which backend a provider talks to. `openai` and `openrouter` use the OpenAI
 * provider; `custom` points the OpenAI provider at any OpenAI-compatible
 * endpoint via `baseURL`.
 */
export type ProviderKind = 'openai' | 'anthropic' | 'openrouter' | 'custom';

/**
 * Serializable provider configuration produced by the `ai/provider` node.
 *
 * Deliberately holds NO secret: the API key is resolved at call time from the
 * host-injected {@link IAICredentials}, by `credentialRef` (or the provider
 * `kind` when blank). This is what keeps API keys out of the saved graph.
 */
export interface ProviderConfig {
  kind: ProviderKind;
  /**
   * Non-secret reference to the credential the host should use (e.g. a provider
   * name or a named secret). Blank → resolve by `kind`. The key itself never
   * lives here or in the graph.
   */
  credentialRef?: string;
  /** Override the default API base URL (required for `custom`). */
  baseURL?: string;
  /** Default model to use when an agent doesn't specify one. */
  defaultModel?: string;
  /** Extra headers merged into every request (e.g. OpenRouter attribution). */
  headers?: Record<string, string>;
}

/** JSON-schema description of a tool's arguments. */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

/** A tool/function the model may call, produced by the `ai/tool` node. */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

/** A fully-defined agent, produced by the `ai/agent` node. */
export interface AgentSpec {
  provider: ProviderConfig;
  model: string;
  systemPrompt?: string;
  temperature?: number;
  tools: ToolSpec[];
}

/** A single tool/function invocation requested by the model. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
