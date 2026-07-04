import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { AgentSpec, ConversationHandle } from '../abstractions/types.js';

/**
 * Connects an agent to a conversation. Trigger this (e.g. from a lifecycle
 * `start` event) to make the conversation panel active and ready to chat.
 *
 * The optional `conversation` input sets the agent on a specific branch (e.g. a
 * fork , so it can explore with a different model/prompt); leave it unconnected
 * to set the agent on the focused conversation.
 *
 * This is the graph-side equivalent of the "Setup UI" step the flow
 * `ConversationPanel` refers to when no agent is connected.
 */
export const SetupConversation = makeFlowNodeDefinition({
  typeName: 'ai/setupConversation',
  label: 'AI: Setup Conversation',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    agent: 'aiAgent',
    conversation: {
      valueType: 'aiConversation',
      defaultValue: undefined,
      label: 'conversation'
    }
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ read, commit, graph }) => {
    const conversation = graph.getDependency('IConversationService');
    const agent = read<AgentSpec | undefined>('agent');
    const handle = read<ConversationHandle | undefined>('conversation');
    if (conversation && agent) {
      conversation.setAgent(agent, handle?.id);
    }
    commit('flow');
  }
});
