import {
  makeAsyncNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { ChatRole, ConversationHandle } from '../abstractions/types.js';

/**
 * Sends a message into a conversation as an action , this is how another part of
 * the graph "pushes onto" the chat. With role `user`, it triggers a model
 * completion and the `reply` output carries the assistant's response once it
 * arrives. Other roles are appended without triggering a completion.
 *
 * The optional `conversation` input targets a specific branch (e.g. a fork);
 * leave it unconnected to target the focused conversation. The optional `image`
 * input attaches a picture to a `user` message for vision-capable models (and
 * shows it in the chat panel).
 *
 * Async: downstream `flow` fires only after the send (and any completion) has
 * resolved.
 */
export const SendMessage = makeAsyncNodeDefinition({
  typeName: 'ai/sendMessage',
  label: 'AI: Send Message',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    role: {
      valueType: 'string',
      defaultValue: 'user',
      choices: ['user', 'assistant', 'system'],
      label: 'role'
    },
    content: {
      valueType: 'string',
      defaultValue: '',
      label: 'content'
    },
    conversation: {
      valueType: 'aiConversation',
      defaultValue: undefined,
      label: 'conversation'
    },
    image: {
      valueType: 'image',
      defaultValue: undefined,
      label: 'image'
    }
  },
  out: {
    flow: 'flow',
    reply: 'string'
  },
  initialState: undefined,
  triggered: ({ read, write, commit, finished, graph }) => {
    const conversation = graph.getDependency('IConversationService');
    const role = read<ChatRole>('role');
    const content = read<string>('content');
    const handle = read<ConversationHandle | undefined>('conversation');
    const image = read<Uint8Array | undefined>('image');

    if (!conversation) {
      write('reply', '');
      commit('flow');
      finished?.();
      return;
    }

    void conversation
      .sendMessage(
        { role, content, images: image ? [image] : undefined },
        handle?.id
      )
      .then((reply) => {
        write('reply', reply);
      })
      .catch(() => {
        write('reply', '');
      })
      .finally(() => {
        commit('flow');
        finished?.();
      });
  },
  dispose: () => {
    return {};
  }
});
