import type { SlackSendInput, SlackSendResult } from './types.js';

/**
 * Outbound Slack: the dependency the **action** nodes (`slack/sendMessage`,
 * `slack/sendStructuredMessage`) reach through
 * `graph.getDependency('ISlackClient')`.
 *
 * The graph never holds a bot token. The host owns credentials and supplies a
 * concrete `ISlackClient` in the execution registry's `dependencies` , exactly
 * the pattern the ai package uses for `IConversationService` and core uses for
 * `ILifecycleEventEmitter`. Locally that's {@link ../runtime/LocalSlackConnector},
 * which calls `chat.postMessage`; on the backend it's the server's own
 * token-managing client.
 */
export interface ISlackClient {
  /**
   * Post a message (plain `text` and/or Block Kit `blocks`) to a channel.
   * Resolves with the outcome rather than throwing, so nodes can branch on
   * `ok`/`error` instead of needing try/catch in the graph.
   */
  sendMessage(input: SlackSendInput): Promise<SlackSendResult>;
}
