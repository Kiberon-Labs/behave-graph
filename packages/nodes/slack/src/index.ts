import './abstractions/dependencies.js';

import type { IRegistry } from '@kiberon-labs/behave-graph';
import { nodes } from './nodes/index.js';
import { values } from './values/index.js';

/**
 * Merge the Slack node factories + value types into an execution registry. The
 * host is still responsible for injecting the `ISlackClient` / `ISlackEventSource`
 * dependencies (see {@link LocalSlackConnector} and the README) , this only adds
 * the node/value definitions the engine needs to build slack graphs.
 */
export const registerSlackProfile = (registry: IRegistry): IRegistry => ({
  ...registry,
  nodes: {
    ...registry.nodes,
    ...nodes
  },
  values: {
    ...registry.values,
    ...values
  }
});

export { nodes } from './nodes/index.js';
export { values, SlackMessageValue } from './values/index.js';
export { LocalSlackConnector } from './runtime/LocalSlackConnector.js';
export type { LocalSlackConnectorOptions } from './runtime/LocalSlackConnector.js';
export {
  createSlackBackendService,
  default as slackBackendService,
  type SlackBackendOptions,
  type SlackSocketClient,
  type SlackSocketFactory
} from './backend.js';
export type { ISlackClient } from './abstractions/ISlackClient.js';
export type {
  ISlackEventSource,
  SlackEventHandler
} from './abstractions/ISlackEventSource.js';
export {
  matchesTrigger,
  type SlackChannelRef,
  type SlackEvent,
  type SlackEventType,
  type SlackMessageSpec,
  type SlackSendInput,
  type SlackSendResult,
  type SlackTriggerDescriptor
} from './abstractions/types.js';
