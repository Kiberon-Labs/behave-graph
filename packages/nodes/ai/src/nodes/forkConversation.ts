import { makeFlowNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';
import {
  DEFAULT_CONVERSATION_ID,
  type ConversationHandle
} from '../abstractions/types.js';

/**
 * Forks a conversation: clones the source's history into a new branch and emits
 * its handle on `forked`. Use it to explore an existing conversation a different
 * way , wire `forked` into an `ai/sendMessage` with a different prompt.
 *
 * This is a flow/action node (not a pure value node) on purpose: forking mints
 * runtime state, so it must run at a deterministic point in the flow rather than
 * be re-evaluated by preview pulls. The new branch is also focused, so the chat
 * panel switches to it immediately.
 */
export const ForkConversation = makeFlowNodeDefinition({
  typeName: 'ai/forkConversation',
  label: 'AI: Fork Conversation',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    conversation: {
      valueType: 'aiConversation',
      defaultValue: undefined,
      label: 'conversation'
    }
  },
  out: {
    flow: 'flow',
    forked: 'aiConversation'
  },
  initialState: undefined,
  triggered: ({ read, write, commit, graph }) => {
    const conversation = graph.getDependency('IConversationService');
    const source = read<ConversationHandle | undefined>('conversation');
    const sourceId = source?.id ?? DEFAULT_CONVERSATION_ID;

    const forkedId = conversation
      ? conversation.forkConversation(sourceId)
      : sourceId;
    conversation?.focusConversation(forkedId);

    write<ConversationHandle>('forked', { id: forkedId });
    commit('flow');
  }
});
