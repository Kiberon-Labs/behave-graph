import './dependencies.js';

export type { ISlackClient } from './ISlackClient.js';
export type {
  ISlackEventSource,
  SlackEventHandler
} from './ISlackEventSource.js';
export {
  matchesTrigger,
  type SlackChannelRef,
  type SlackEvent,
  type SlackEventType,
  type SlackMessageSpec,
  type SlackSendInput,
  type SlackSendResult,
  type SlackTriggerDescriptor
} from './types.js';
