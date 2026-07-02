import type { ValueType } from '@kiberon-labs/behave-graph';
import {
  DEFAULT_CONVERSATION_ID,
  type ConversationHandle
} from '../abstractions/types.js';

/**
 * `aiConversation` socket value , an opaque handle to a conversation in the
 * runtime. Serialized as its bare id string. Treated as a singleton value (no
 * interpolation).
 */
export const ConversationValue: ValueType<ConversationHandle> = {
  name: 'aiConversation',
  creator: () => ({ id: DEFAULT_CONVERSATION_ID }),
  deserialize: (value: string) => ({ id: value }),
  serialize: (value: ConversationHandle) => value.id,
  lerp: (start: ConversationHandle, end: ConversationHandle, t: number) =>
    t < 0.5 ? start : end,
  equals: (a: ConversationHandle, b: ConversationHandle) => a.id === b.id,
  clone: (value: ConversationHandle) => ({ ...value })
};
