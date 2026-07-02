import { Agent } from './agent.js';
import { Conversation } from './conversation.js';
import { ForkConversation } from './forkConversation.js';
import { GenerateImage } from './generateImage.js';
import { OnMessage } from './onMessage.js';
import { OnToolCall } from './onToolCall.js';
import { Provider } from './provider.js';
import { SendMessage } from './sendMessage.js';
import { SetupConversation } from './setupConversation.js';
import { Tool } from './tool.js';
import { ToolResult } from './toolResult.js';

export const nodes = {
  [Provider.typeName]: Provider,
  [Agent.typeName]: Agent,
  [Tool.typeName]: Tool,
  [GenerateImage.typeName]: GenerateImage,
  [Conversation.typeName]: Conversation,
  [ForkConversation.typeName]: ForkConversation,
  [SetupConversation.typeName]: SetupConversation,
  [SendMessage.typeName]: SendMessage,
  [OnMessage.typeName]: OnMessage,
  [OnToolCall.typeName]: OnToolCall,
  [ToolResult.typeName]: ToolResult
};
