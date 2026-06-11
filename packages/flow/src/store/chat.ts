import { create } from 'zustand';

export interface AgentConfig {
  model?: string;
  systemPrompt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
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
