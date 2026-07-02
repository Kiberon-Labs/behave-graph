import { plugin, type System } from '@kiberon-labs/behave-graph-flow';
import {
  writeNodeSpecsToJSON,
  type Dependencies
} from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';
import { ConversationRuntime } from './runtime/ConversationRuntime.js';
import type { IAICredentials } from './abstractions/IAICredentials.js';
import { ConversationTreePanel } from './components/panels/conversationTree.js';

export { ConversationTreePanel } from './components/panels/conversationTree.js';

/**
 * Expose the conversation runtime on the editor system so panels can reach it.
 */
declare module '@kiberon-labs/behave-graph-flow' {
  interface System {
    conversation: ConversationRuntime;
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
 * types and wires the conversation runtime onto the system. The conversation
 * panel itself (the `conversation` tab, bound to `system.chatStore`) is provided
 * by the flow package , add it to your layout to see the chat.
 */
export const aiPlugin = plugin<AIPluginOptions | void>(
  async (sys: System, options) => {
    const nodeSpecs = writeNodeSpecsToJSON({
      nodes,
      values,
      dependencies: {} as Dependencies
    });

    const runtime =
      (options && options.runtime) ||
      new ConversationRuntime(sys, options?.credentials);
    sys.decorate('conversation', runtime);

    sys.registry.getState().updateRegistry({
      specs: nodeSpecs,
      values
    });

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
