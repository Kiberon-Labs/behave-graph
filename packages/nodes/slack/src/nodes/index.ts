import { ComposeMessage } from './composeMessage.js';
import { OnMention } from './onMention.js';
import { OnMessage } from './onMessage.js';
import { OnReaction } from './onReaction.js';
import { SendMessage } from './sendMessage.js';
import { SendStructuredMessage } from './sendStructuredMessage.js';

export const nodes = {
  [ComposeMessage.typeName]: ComposeMessage,
  [SendMessage.typeName]: SendMessage,
  [SendStructuredMessage.typeName]: SendStructuredMessage,
  [OnMessage.typeName]: OnMessage,
  [OnMention.typeName]: OnMention,
  [OnReaction.typeName]: OnReaction
};
