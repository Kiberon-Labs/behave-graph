import {
  makePureInOutFunctionDesc,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import {
  DEFAULT_CONVERSATION_ID,
  type ConversationHandle
} from '../abstractions/types.js';

/**
 * Produces a conversation handle to start from , the root of an exploration.
 * Leave `id` empty for the default conversation (the one the chat panel shows),
 * or name one to address a specific conversation. Feed the handle into
 * `ai/forkConversation`, `ai/sendMessage` or `ai/onMessage`.
 */
export const Conversation = makePureInOutFunctionDesc({
  typeName: 'ai/conversation',
  label: 'AI: Conversation',
  category: NodeCategory.Logic,
  in: {
    id: {
      valueType: 'string',
      defaultValue: '',
      label: 'id'
    }
  },
  out: {
    conversation: 'aiConversation'
  },
  exec: ({ read, write }) => {
    const id = read<string>('id');
    const handle: ConversationHandle = { id: id || DEFAULT_CONVERSATION_ID };
    write('conversation', handle);
  }
});
