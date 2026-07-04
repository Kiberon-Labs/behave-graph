import { plugin, type System } from '@kiberon-labs/behave-graph-flow';
import type { StoreApi } from 'zustand';
import {
  writeNodeSpecsToJSON,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import { ConversationRuntime } from './runtime/ConversationRuntime.js';
import type { IAICredentials } from './abstractions/IAICredentials.js';
import { ConversationTreePanel } from './components/panels/conversationTree.js';
import { ConversationPanel } from './components/panels/conversation/index.js';
import type { ChatStore } from './store/chat.js';

export { ConversationTreePanel } from './components/panels/conversationTree.js';
export { ConversationPanel } from './components/panels/conversation/index.js';
export * from './store/chat.js';

/**
 * The conversation system lives in this package (moved out of the flow core).
 * Augment the editor system with:
 * - `conversation`: the {@link ConversationRuntime} panels reach for the tree;
 * - `chatStore`: the chat state the {@link ConversationPanel} binds to;
 * and the editor pubsub with `chat:userMessage`, published by the panel input
 * and handled by the runtime.
 */
declare module '@kiberon-labs/behave-graph-flow' {
  interface System {
    conversation: ConversationRuntime;
    chatStore: StoreApi<ChatStore>;
  }
  interface EditorPubSys {
    'chat:userMessage': { content: string };
  }
}

export interface AIPluginOptions {
  /**
   * The conversation runtime to use. Pass the SAME instance you injected into
   * the execution registry's `dependencies.IConversationService` so the graph
   * nodes and the conversation panel share one conversation. If omitted, a new
   * runtime is created (fine when nothing drives the chat from the graph).
   */
  runtime?: ConversationRuntime;

  /**
   * API-key resolver, used only when this plugin creates the fallback runtime
   * (i.e. no `runtime` passed). When you supply your own `runtime`, give it the
   * credentials directly. Keys never live in the graph , see {@link IAICredentials}.
   */
  credentials?: IAICredentials;
}

/**
 * Editor plugin for the AI nodes package. Registers the node specs + value
 * types, provides the chat store + conversation panel (both owned by this
 * package), and wires the conversation runtime onto the system.
 */
export const aiPlugin = plugin<AIPluginOptions | void>(
  async (sys: System, options) => {
    const nodeSpecs = writeNodeSpecsToJSON({
      nodes,
      values,
      dependencies: {} as Dependencies
    });

    // The runtime owns the chat store (moved out of flow core) and ensures
    // `system.chatStore` exists on construction, so the ConversationPanel below
    // and the runtime share one store.
    const runtime =
      (options && options.runtime) ||
      new ConversationRuntime(sys, options?.credentials);
    sys.decorate('conversation', runtime);

    sys.registry.getState().updateRegistry({
      specs: nodeSpecs,
      values
    });

    // The chat panel, bound to system.chatStore.
    sys.tabLoader.register('conversation', () => ({
      id: 'conversation',
      title: 'Conversation',
      closable: true,
      cached: true,
      group: 'default',
      content: () => <ConversationPanel />
    }));

    // Exploration tree , one row per conversation branch, click to focus.
    sys.tabLoader.register('conversations', () => ({
      id: 'conversations',
      title: 'Conversations',
      closable: true,
      cached: true,
      group: 'default',
      content: () => <ConversationTreePanel />
    }));
  },
  { name: 'ai' }
);
