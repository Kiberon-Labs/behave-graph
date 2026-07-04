import {
  makeEventNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { ChatMessage, ConversationHandle } from '../abstractions/types.js';

type State = {
  unsubscribe?: () => void;
};

const initialState = (): State => ({});

/**
 * Fires whenever a message is added to a conversation (user, assistant, system
 * or tool). Lets the graph react to the chat , e.g. run logic when the user says
 * something, or branch on the assistant's reply.
 *
 * The optional `conversation` input scopes it to a specific branch; leave it
 * unconnected to listen to every conversation.
 */
export const OnMessage = makeEventNodeDefinition({
  typeName: 'ai/onMessage',
  label: 'AI: On Message',
  category: NodeCategory.Event,
  in: {
    conversation: {
      valueType: 'aiConversation',
      defaultValue: undefined,
      label: 'conversation'
    }
  },
  out: {
    flow: 'flow',
    role: 'string',
    content: 'string'
  },
  initialState: initialState(),
  init: ({ read, write, commit, graph }) => {
    const conversation = graph.getDependency('IConversationService');
    const handle = read<ConversationHandle | undefined>('conversation');

    const handler = (message: ChatMessage) => {
      write('role', message.role);
      write('content', message.content);
      commit('flow');
    };

    const unsubscribe = conversation?.onMessage(handler, handle?.id);

    const state: State = { unsubscribe };
    return state;
  },
  dispose: ({ state }) => {
    state.unsubscribe?.();
    return {};
  }
});
