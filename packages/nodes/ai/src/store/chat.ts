import { create } from 'zustand';

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
}

/**
 * A renderable attachment on a chat message. The producer supplies a ready-to-use
 * `url` (a data: or object URL), so the panel stays free of any image-decoding.
 */
export interface ChatAttachment {
  type: 'image';
  url: string;
  alt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Optional non-text attachments (e.g. images sent with a multimodal message). */
  attachments?: ChatAttachment[];
}

export type ChatStore = {
  messages: ChatMessage[];
  agent: AgentConfig | undefined;
  isStreaming: boolean;
  inputValue: string;

  setAgent: (agent: AgentConfig) => void;
  clearAgent: () => void;
  addMessage: (message: ChatMessage) => void;
  updateStreamingMessage: (id: string, content: string) => void;
  finalizeStreamingMessage: (id: string) => void;
  setIsStreaming: (streaming: boolean) => void;
  setInputValue: (value: string) => void;
  clearMessages: () => void;
};

let messageCounter = 0;

export function createMessageId(): string {
  messageCounter += 1;
  return `msg-${Date.now()}-${String(messageCounter)}`;
}

export const chatStoreFactory = () =>
  create<ChatStore>((set) => ({
    messages: [],
    agent: undefined,
    isStreaming: false,
    inputValue: '',

    setAgent: (agent: AgentConfig) => set({ agent }),
    clearAgent: () => set({ agent: undefined }),

    addMessage: (message: ChatMessage) =>
      set((state) => ({
        messages: [...state.messages, message]
      })),

    updateStreamingMessage: (id: string, content: string) =>
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, content } : msg
        )
      })),

    finalizeStreamingMessage: (id: string) =>
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === id ? { ...msg, isStreaming: false } : msg
        )
      })),

    setIsStreaming: (streaming: boolean) => set({ isStreaming: streaming }),

    setInputValue: (value: string) => set({ inputValue: value }),

    clearMessages: () => set({ messages: [] })
  }));
