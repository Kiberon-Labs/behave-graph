import type { System } from '@kiberon-labs/behave-graph-flow';
import {
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type ImagePart,
  type LanguageModel,
  type ModelMessage,
  type TextPart,
  type ToolSet
} from 'ai';
import type { IConversationService } from '../abstractions/IConversationService.js';
import type { IAICredentials } from '../abstractions/IAICredentials.js';
import {
  DEFAULT_CONVERSATION_ID,
  type AgentSpec,
  type ChatMessage,
  type ChatRole,
  type ToolCall,
  type ToolSpec
} from '../abstractions/types.js';
import { create, type StoreApi } from 'zustand';
import { createModel, resolveApiKey } from '../providers/index.js';
import { imageBytesToDataUrl } from './imageDataUrl.js';
import { chatStoreFactory } from '../store/chat.js';

/** A node in the conversation tree, for the exploration panel. */
export interface ConversationNode {
  id: string;
  parentId?: string;
  messageCount: number;
  /** Short preview (first user message) for labeling the branch. */
  preview: string;
  /** The model this branch uses, if an agent is connected to it. */
  model?: string;
}

/** Observable snapshot of all conversations + which is focused. */
export interface ConversationsState {
  conversations: ConversationNode[];
  focusedId: string;
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

/**
 * Build a human-readable message from a provider/SDK error, preferring the
 * provider's own error body (e.g. OpenRouter's `{ error: { message } }`) and the
 * HTTP status over the SDK's generic wrapper.
 */
function describeError(error: unknown): string {
  if (!(error && typeof error === 'object')) return String(error);
  const e = error as {
    message?: string;
    statusCode?: number;
    responseBody?: string;
  };
  let providerMessage: string | undefined;
  if (typeof e.responseBody === 'string') {
    try {
      const body = JSON.parse(e.responseBody) as {
        error?: { message?: string };
        message?: string;
      };
      providerMessage = body.error?.message ?? body.message;
    } catch {
      // responseBody wasn't JSON , fall back to the SDK message.
    }
  }
  const message = providerMessage || e.message || 'request failed';
  return e.statusCode ? `HTTP ${String(e.statusCode)}: ${message}` : message;
}

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${String(idCounter)}-${String(Math.round(performance.now()))}`;
}

/** Cap on tool round-trips per user turn, to avoid a runaway tool loop. */
const MAX_TOOL_ROUNDS = 8;
/** How long to wait for the graph to answer a tool call before giving up. */
const TOOL_RESULT_TIMEOUT_MS = 30_000;

interface Conversation {
  id: string;
  parentId?: string;
  messages: ModelMessage[];
  /** Per-conversation agent , a fork can explore with a different model/prompt. */
  agent?: AgentSpec;
  model?: LanguageModel;
}

interface PendingToolResult {
  resolve: (result: string) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface MessageListener {
  conversationId?: string;
  fn: (message: ChatMessage) => void;
}

/** Build multimodal user content (text + image parts) for a vision message. */
function buildUserParts(
  text: string,
  images: Uint8Array[]
): Array<TextPart | ImagePart> {
  const parts: Array<TextPart | ImagePart> = [];
  if (text) parts.push({ type: 'text', text });
  for (const image of images) parts.push({ type: 'image', image });
  return parts;
}

/** Extract the plain text of a message's content (joins text parts). */
function partsToText(content: ModelMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((part): part is TextPart => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

/** Extract image bytes attached to a message's content. */
function partsToImages(content: ModelMessage['content']): Uint8Array[] {
  if (typeof content === 'string') return [];
  const images: Uint8Array[] = [];
  for (const part of content) {
    if (part.type === 'image' && part.image instanceof Uint8Array) {
      images.push(part.image);
    }
  }
  return images;
}

function imagesToAttachments(
  images: Uint8Array[]
): Array<{ type: 'image'; url: string }> {
  return images.map((bytes) => ({
    type: 'image',
    url: imageBytesToDataUrl(bytes)
  }));
}

/**
 * Editor-side implementation of {@link IConversationService}, backed by the
 * Vercel AI SDK.
 *
 * It manages a set of conversations (keyed by id), so the graph can fork and
 * explore branches. One is "focused": its history is mirrored into
 * `system.chatStore` and rendered by the flow `ConversationPanel`, and panel
 * input (`chat:userMessage`) goes to it. Non-focused branches still run , their
 * histories update and `onMessage` listeners fire , but they don't scribble on
 * the panel.
 *
 * The SDK handles provider differences, streaming and the multi-step tool loop;
 * graph-defined tools become SDK tools whose `execute` bridges to the
 * `ai/onToolCall` / `ai/toolResult` nodes.
 *
 * The SAME instance must be injected into the execution registry's
 * `dependencies` as `IConversationService` so graph nodes talk to the same
 * conversations the panel shows. See the package README for wiring.
 */
export class ConversationRuntime implements IConversationService {
  private readonly system: System;
  private readonly credentials?: IAICredentials;

  private readonly conversations = new Map<string, Conversation>();
  private focusedId = DEFAULT_CONVERSATION_ID;

  /** Observable conversation tree for the exploration panel. */
  public readonly store: StoreApi<ConversationsState>;

  private readonly messageListeners = new Set<MessageListener>();
  private readonly toolCallListeners = new Set<(call: ToolCall) => void>();
  private readonly pendingToolResults = new Map<string, PendingToolResult>();
  private userMessageToken: string | false = false;

  constructor(system: System, credentials?: IAICredentials) {
    this.system = system;
    this.credentials = credentials;
    // Own the chat store (moved out of flow core). Ensure it exists as early as
    // possible , the moment a runtime is constructed , so the panel and every
    // runtime method share one store regardless of plugin-registration order.
    if (!system.chatStore) {
      system.decorate('chatStore', chatStoreFactory());
    }
    this.store = create<ConversationsState>(() => ({
      conversations: [],
      focusedId: DEFAULT_CONVERSATION_ID
    }));
    this.getOrCreate(DEFAULT_CONVERSATION_ID);
    this.publishTree();
    this.userMessageToken = system.pubsub.subscribe(
      'chat:userMessage',
      (_topic, data: { content: string }) => {
        void this.handleUserMessage(data.content);
      }
    );
  }

  dispose(): void {
    if (typeof this.userMessageToken === 'string') {
      this.system.pubsub.unsubscribe(this.userMessageToken);
      this.userMessageToken = false;
    }
    for (const pending of this.pendingToolResults.values()) {
      clearTimeout(pending.timeout);
    }
    this.pendingToolResults.clear();
    this.messageListeners.clear();
    this.toolCallListeners.clear();
  }

  setAgent(agent: AgentSpec, conversationId?: string): void {
    const target = this.getOrCreate(conversationId ?? this.focusedId);
    target.agent = agent;
    target.model = createModel(agent.provider, agent.model, this.credentials);
    if (target.id === this.focusedId) this.syncFocusedAgentToPanel();
    this.publishTree();
  }

  clearAgent(conversationId?: string): void {
    const target = this.getOrCreate(conversationId ?? this.focusedId);
    target.agent = undefined;
    target.model = undefined;
    if (target.id === this.focusedId) this.syncFocusedAgentToPanel();
    this.publishTree();
  }

  /** Reflect the focused conversation's agent in the chat panel's agent gate. */
  private syncFocusedAgentToPanel(): void {
    const agent = this.conversations.get(this.focusedId)?.agent;
    const chat = this.system.chatStore.getState();
    if (agent) {
      chat.setAgent({ model: agent.model, systemPrompt: agent.systemPrompt });
    } else {
      chat.clearAgent();
    }
  }

  onMessage(
    listener: (message: ChatMessage) => void,
    conversationId?: string
  ): () => void {
    const entry: MessageListener = { conversationId, fn: listener };
    this.messageListeners.add(entry);
    return () => {
      this.messageListeners.delete(entry);
    };
  }

  onToolCall(listener: (call: ToolCall) => void): () => void {
    this.toolCallListeners.add(listener);
    return () => {
      this.toolCallListeners.delete(listener);
    };
  }

  provideToolResult(callId: string, result: string): void {
    const pending = this.pendingToolResults.get(callId);
    if (!pending) return;
    clearTimeout(pending.timeout);
    this.pendingToolResults.delete(callId);
    pending.resolve(result);
  }

  forkConversation(sourceId: string): string {
    const source = this.getOrCreate(sourceId);
    const fork: Conversation = {
      id: nextId('conv'),
      parentId: source.id,
      messages: source.messages.map((m) => ({ ...m })),
      // Inherit the parent's agent so a branch starts the same way , override it
      // (setupConversation on the fork) to explore with a different model/prompt.
      agent: source.agent,
      model: source.model
    };
    this.conversations.set(fork.id, fork);
    this.publishTree();
    return fork.id;
  }

  focusConversation(id: string): void {
    const conversation = this.getOrCreate(id);
    this.focusedId = id;
    this.syncFocusedAgentToPanel();

    // Re-render the panel from the focused conversation's history.
    const chat = this.system.chatStore.getState();
    chat.clearMessages();
    for (const message of conversation.messages) {
      if (message.role === 'tool') continue;
      const images = partsToImages(message.content);
      chat.addMessage({
        id: nextId('msg'),
        role: message.role,
        content: partsToText(message.content),
        timestamp: new Date(),
        attachments: images.length > 0 ? imagesToAttachments(images) : undefined
      });
    }
    // focusedId changed , update the tree so the panel highlights this branch.
    this.publishTree();
  }

  async sendMessage(
    message: { role: ChatRole; content: string; images?: Uint8Array[] },
    conversationId?: string
  ): Promise<string> {
    const targetId = conversationId ?? this.focusedId;
    this.appendMessage(targetId, message.role, message.content, message.images);
    if (message.role === 'user') {
      return this.runCompletion(targetId);
    }
    return '';
  }

  // --- internals -----------------------------------------------------------

  private getOrCreate(id: string): Conversation {
    let conversation = this.conversations.get(id);
    if (!conversation) {
      conversation = { id, messages: [] };
      this.conversations.set(id, conversation);
    }
    return conversation;
  }

  /** Push the current conversation tree to the observable store. */
  private publishTree(): void {
    const conversations: ConversationNode[] = [];
    for (const conversation of this.conversations.values()) {
      const firstUser = conversation.messages.find((m) => m.role === 'user');
      conversations.push({
        id: conversation.id,
        parentId: conversation.parentId,
        messageCount: conversation.messages.length,
        preview: firstUser ? truncate(partsToText(firstUser.content), 40) : '',
        model: conversation.agent?.model
      });
    }
    this.store.setState({ conversations, focusedId: this.focusedId });
  }

  private async handleUserMessage(content: string): Promise<void> {
    this.appendMessage(this.focusedId, 'user', content);
    await this.runCompletion(this.focusedId);
  }

  private notify(conversationId: string, message: ChatMessage): void {
    for (const listener of this.messageListeners) {
      if (
        listener.conversationId === undefined ||
        listener.conversationId === conversationId
      ) {
        listener.fn(message);
      }
    }
  }

  /** Record a message in a conversation, render it if focused, notify listeners. */
  private appendMessage(
    conversationId: string,
    role: ChatRole,
    content: string,
    images?: Uint8Array[]
  ): void {
    if (role === 'user' || role === 'assistant' || role === 'system') {
      const conversation = this.getOrCreate(conversationId);
      if (role === 'user' && images && images.length > 0) {
        conversation.messages.push({
          role: 'user',
          content: buildUserParts(content, images)
        });
      } else {
        conversation.messages.push({ role, content });
      }

      if (conversationId === this.focusedId) {
        this.system.chatStore.getState().addMessage({
          id: nextId('msg'),
          role,
          content,
          timestamp: new Date(),
          attachments:
            images && images.length > 0
              ? imagesToAttachments(images)
              : undefined
        });
      }
      this.publishTree();
    }
    this.notify(conversationId, { role, content });
  }

  /**
   * Build the SDK tool set from the agent's tools. Each tool's `execute`
   * dispatches to the graph (`ai/onToolCall`) and awaits the matching
   * `ai/toolResult`, so the SDK's multi-step loop drives graph-defined tools.
   */
  private buildTools(specs: ToolSpec[]): ToolSet | undefined {
    // Only emit named tools. An unconnected `tool` socket can yield an empty
    // ToolSpec (name ""), and sending that , or any `tools` at all , breaks
    // models that don't support tool calling. With no valid tools we return
    // undefined so no `tools` param is sent.
    const valid = specs.filter(
      (spec) => typeof spec?.name === 'string' && spec.name.trim().length > 0
    );
    if (valid.length === 0) return undefined;

    const toolSet: ToolSet = {};
    for (const spec of valid) {
      toolSet[spec.name] = tool({
        description: spec.description,
        inputSchema: jsonSchema(
          spec.parameters as Parameters<typeof jsonSchema>[0]
        ),
        execute: async (args, { toolCallId }) =>
          this.dispatchToolCall({
            id: toolCallId,
            name: spec.name,
            arguments: (args ?? {}) as Record<string, unknown>
          })
      });
    }
    return toolSet;
  }

  /**
   * Stream one reply for a conversation, letting the SDK run any tool steps.
   * Renders into the panel only when that conversation is focused. Returns the
   * final assistant text.
   */
  private async runCompletion(conversationId: string): Promise<string> {
    const conversation = this.getOrCreate(conversationId);
    const agent = conversation.agent;
    const model = conversation.model;
    if (!agent || !model) {
      return '';
    }

    const isFocused = conversationId === this.focusedId;

    // Fail fast with a clear message when no key resolves (vs a confusing 401).
    if (!resolveApiKey(agent.provider, this.credentials)) {
      this.emitMissingKeyNotice(agent, isFocused);
      return '';
    }

    const assistantId = this.beginAssistantMessage(isFocused);
    try {
      return await this.streamAssistantReply(
        conversationId,
        conversation,
        agent,
        model,
        assistantId
      );
    } catch (error) {
      this.renderStreamError(assistantId, describeError(error));
      return '';
    } finally {
      if (isFocused) {
        this.system.chatStore.getState().setIsStreaming(false);
      }
    }
  }

  /**
   * Render the "no API key" notice in the panel (focused conversations only).
   * Non-focused branches stay silent , they never scribble on the panel.
   */
  private emitMissingKeyNotice(agent: AgentSpec, isFocused: boolean): void {
    if (!isFocused) return;
    const ref = agent.provider.credentialRef || agent.provider.kind;
    this.system.chatStore.getState().addMessage({
      id: nextId('msg'),
      role: 'assistant',
      content: `⚠️ No API key configured for "${ref}". The host's credential resolver (IAICredentials) returned no key , e.g. set VITE_${ref.toUpperCase()}_API_KEY for the Storybook demo.`,
      timestamp: new Date()
    });
  }

  /**
   * Seed an empty streaming assistant bubble in the panel and flip the streaming
   * flag. Returns the bubble id to update as deltas arrive, or `undefined` when
   * the conversation isn't focused (so nothing renders).
   */
  private beginAssistantMessage(isFocused: boolean): string | undefined {
    if (!isFocused) return undefined;
    const assistantId = nextId('msg');
    const chat = this.system.chatStore.getState();
    chat.addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    });
    chat.setIsStreaming(true);
    return assistantId;
  }

  /**
   * Stream the SDK completion for one conversation, mirroring deltas into the
   * panel bubble (when focused), then record and return the final assistant text.
   */
  private async streamAssistantReply(
    conversationId: string,
    conversation: Conversation,
    agent: AgentSpec,
    model: LanguageModel,
    assistantId: string | undefined
  ): Promise<string> {
    // streamText routes request errors to onError rather than throwing; without
    // this, a failed call surfaces only as the SDK's generic "No output
    // generated" when `result.text` is read. Capture the real cause here.
    let streamError: unknown;
    const result = streamText({
      model,
      system: agent.systemPrompt,
      messages: conversation.messages,
      tools: this.buildTools(agent.tools),
      stopWhen: stepCountIs(MAX_TOOL_ROUNDS),
      temperature: agent.temperature,
      onError: ({ error }) => {
        streamError = error;
        console.error('AI completion failed:', error);
      }
    });

    let streamed = '';
    for await (const delta of result.textStream) {
      streamed += delta;
      if (assistantId) {
        this.system.chatStore
          .getState()
          .updateStreamingMessage(assistantId, streamed);
      }
    }

    // Surface the real provider error instead of the SDK's empty-output wrapper.
    if (streamError) throw streamError;

    const finalText = (await result.text) || streamed;
    if (assistantId) {
      const focusChat = this.system.chatStore.getState();
      focusChat.updateStreamingMessage(assistantId, finalText);
      focusChat.finalizeStreamingMessage(assistantId);
    }

    conversation.messages.push({ role: 'assistant', content: finalText });
    this.notify(conversationId, { role: 'assistant', content: finalText });
    this.publishTree();

    return finalText;
  }

  /** Replace the streaming bubble with an error notice (focused only). */
  private renderStreamError(
    assistantId: string | undefined,
    text: string
  ): void {
    if (!assistantId) return;
    const focusChat = this.system.chatStore.getState();
    focusChat.updateStreamingMessage(assistantId, `⚠️ ${text}`);
    focusChat.finalizeStreamingMessage(assistantId);
  }

  /**
   * Hand a tool call to the graph's `ai/onToolCall` listeners and wait for the
   * matching `ai/toolResult`. Falls back gracefully (so the loop never hangs)
   * when there is no handler or the graph doesn't answer in time.
   */
  private dispatchToolCall(call: ToolCall): Promise<string> {
    if (this.toolCallListeners.size === 0) {
      return Promise.resolve(
        `Error: no handler is registered for tool "${call.name}". Connect an ai/onToolCall node.`
      );
    }

    return new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        this.pendingToolResults.delete(call.id);
        resolve(`Error: tool "${call.name}" timed out without a result.`);
      }, TOOL_RESULT_TIMEOUT_MS);

      this.pendingToolResults.set(call.id, { resolve, timeout });

      for (const listener of this.toolCallListeners) {
        listener(call);
      }
    });
  }
}
