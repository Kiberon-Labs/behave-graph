import { describe, expect, it } from 'vitest';
import type { System } from '@kiberon-labs/behave-graph-flow';
import { ConversationRuntime } from '../src/runtime/ConversationRuntime.js';
import { ConversationValue } from '../src/values/ConversationValue.js';
import type { AgentSpec } from '../src/abstractions/types.js';

describe('ConversationValue', () => {
  it('round-trips a handle through its bare id', () => {
    const handle = { id: 'conv-7' };
    const serialized = ConversationValue.serialize(handle);
    expect(serialized).toBe('conv-7');
    expect(ConversationValue.deserialize(serialized)).toEqual(handle);
  });

  it('compares by id and clones', () => {
    expect(ConversationValue.equals({ id: 'a' }, { id: 'a' })).toBe(true);
    expect(ConversationValue.equals({ id: 'a' }, { id: 'b' })).toBe(false);
    const original = { id: 'a' };
    const clone = ConversationValue.clone(original);
    expect(clone).toEqual(original);
    expect(clone).not.toBe(original);
  });
});

/**
 * The runtime only touches `system.pubsub` and `system.chatStore`, so a tiny
 * fake stands in for the full editor System , no DOM, no network.
 */
interface FakeMessage {
  id: string;
  role: string;
  content: string;
  attachments?: Array<{ type: 'image'; url: string }>;
}

function makeFakeSystem() {
  const messages: FakeMessage[] = [];
  const chatState = {
    messages,
    agent: undefined as { model?: string; systemPrompt?: string } | undefined,
    addMessage: (m: FakeMessage) => {
      messages.push(m);
    },
    updateStreamingMessage: (id: string, content: string) => {
      const m = messages.find((x) => x.id === id);
      if (m) m.content = content;
    },
    finalizeStreamingMessage: () => {},
    setIsStreaming: () => {},
    setAgent: (a: { model?: string; systemPrompt?: string }) => {
      chatState.agent = a;
    },
    clearAgent: () => {
      chatState.agent = undefined;
    },
    clearMessages: () => {
      messages.length = 0;
    }
  };
  const subs = new Map<string, (topic: string, data: unknown) => void>();
  const pubsub = {
    subscribe: (
      _topic: string,
      fn: (topic: string, data: unknown) => void
    ) => {
      const token = `t${String(subs.size)}`;
      subs.set(token, fn);
      return token;
    },
    unsubscribe: (token: string) => subs.delete(token)
  };

  const system = { chatStore: { getState: () => chatState }, pubsub };
  return { system: system as unknown as System, messages, chatState };
}

function agentSpec(model: string): AgentSpec {
  return {
    provider: { kind: 'openai' },
    model,
    tools: []
  };
}

const contentsOf = (messages: Array<{ content: string }>) =>
  messages.map((m) => m.content);

describe('ConversationRuntime forking', () => {
  it('forks history and isolates branches, mirroring only the focused one', async () => {
    const { system, messages } = makeFakeSystem();
    const runtime = new ConversationRuntime(system);

    // Seed the default (focused) conversation. role!=user => no completion.
    await runtime.sendMessage({ role: 'system', content: 'seed' });
    expect(contentsOf(messages)).toContain('seed');

    // Fork the default; the fork inherits the seed.
    const forkId = runtime.forkConversation('default');
    runtime.focusConversation(forkId);
    expect(contentsOf(messages)).toEqual(['seed']);

    // A message to the (now non-focused) default must not touch the panel...
    await runtime.sendMessage({ role: 'system', content: 'only-default' }, 'default');
    expect(contentsOf(messages)).not.toContain('only-default');

    // ...and must not leak into the fork's history.
    runtime.focusConversation(forkId);
    expect(contentsOf(messages)).toEqual(['seed']);

    // The default kept its own divergent history.
    runtime.focusConversation('default');
    expect(contentsOf(messages)).toEqual(['seed', 'only-default']);
  });

  it('attaches images as data-URL attachments and preserves them on focus', async () => {
    const { system, messages } = makeFakeSystem();
    const runtime = new ConversationRuntime(system);

    // A 1x1 PNG (first bytes are the PNG signature, enough for the MIME sniff).
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

    // No agent is set, so a user message renders + records but runCompletion
    // returns early , no model call, no network.
    await runtime.sendMessage({ role: 'user', content: 'look', images: [png] });

    const withImage = messages.find((m) => m.content === 'look');
    expect(withImage?.attachments?.[0]?.type).toBe('image');
    expect(withImage?.attachments?.[0]?.url.startsWith('data:image/png;base64,')).toBe(
      true
    );

    // The image survives a fork + focus rebuild.
    const forkId = runtime.forkConversation('default');
    runtime.focusConversation(forkId);
    const rebuilt = messages.find((m) => m.content === 'look');
    expect(rebuilt?.attachments?.[0]?.url.startsWith('data:image/png;base64,')).toBe(
      true
    );
  });
});

describe('ConversationRuntime per-conversation agents', () => {
  it('forks inherit the agent; branches override independently; panel follows focus', () => {
    const { system, chatState } = makeFakeSystem();
    const runtime = new ConversationRuntime(system);

    // Set agent A on the default (focused) conversation.
    runtime.setAgent(agentSpec('model-a'));
    expect(chatState.agent?.model).toBe('model-a');

    // Fork inherits A; focusing the fork keeps the panel on A.
    const forkId = runtime.forkConversation('default');
    runtime.focusConversation(forkId);
    expect(chatState.agent?.model).toBe('model-a');
    expect(
      runtime.store.getState().conversations.find((c) => c.id === forkId)?.model
    ).toBe('model-a');

    // Override the fork with agent B , the default is unaffected.
    runtime.setAgent(agentSpec('model-b'), forkId);
    expect(chatState.agent?.model).toBe('model-b'); // fork is focused
    runtime.focusConversation('default');
    expect(chatState.agent?.model).toBe('model-a'); // default kept A
  });
});

describe('ConversationRuntime tree store', () => {
  it('reflects branches, parent links and the focused id', async () => {
    const { system } = makeFakeSystem();
    const runtime = new ConversationRuntime(system);

    // Starts with just the default conversation, focused.
    let state = runtime.store.getState();
    expect(state.conversations.map((c) => c.id)).toEqual(['default']);
    expect(state.focusedId).toBe('default');

    // A message updates the focused branch's count + preview.
    await runtime.sendMessage({ role: 'system', content: 'hello there' });
    state = runtime.store.getState();
    const root = state.conversations.find((c) => c.id === 'default');
    expect(root?.messageCount).toBe(1);

    // Forking adds a child with a parent link; focusing updates focusedId.
    const forkId = runtime.forkConversation('default');
    runtime.focusConversation(forkId);
    state = runtime.store.getState();
    expect(state.conversations).toHaveLength(2);
    const fork = state.conversations.find((c) => c.id === forkId);
    expect(fork?.parentId).toBe('default');
    expect(state.focusedId).toBe(forkId);
  });
});
