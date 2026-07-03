import {
  makeAsyncNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { SlackMessageSpec } from '../abstractions/types.js';

/**
 * **Action**: post a structured `slackMessage` (text + Block Kit blocks, built by
 * `slack/composeMessage`) to a channel via the host-injected `ISlackClient`. The
 * message's own `threadTs` is honored, so a composed reply lands in its thread.
 *
 * Async: downstream `flow` fires after Slack acknowledges; `ok`/`ts`/`error`
 * report the outcome.
 */
export const SendStructuredMessage = makeAsyncNodeDefinition({
  typeName: 'slack/sendStructuredMessage',
  label: 'Slack: Send Structured Message',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    channel: {
      valueType: 'string',
      defaultValue: '',
      label: 'channel'
    },
    message: 'slackMessage',
    workspace: {
      valueType: 'string',
      defaultValue: '',
      label: 'workspace'
    }
  },
  out: {
    flow: 'flow',
    ok: 'boolean',
    ts: 'string',
    error: 'string'
  },
  initialState: undefined,
  triggered: ({ read, write, commit, finished, graph }) => {
    const client = graph.getDependency('ISlackClient');
    const channel = read<string>('channel');
    const workspace = read<string>('workspace');
    const message = read<SlackMessageSpec>('message');

    const settle = (ok: boolean, ts: string, error: string) => {
      write('ok', ok);
      write('ts', ts);
      write('error', error);
      commit('flow');
      finished?.();
    };

    if (!client) {
      settle(false, '', 'No ISlackClient dependency registered');
      return;
    }

    void client
      .sendMessage({
        channel,
        workspace: workspace ? workspace : undefined,
        text: message.text,
        blocks: message.blocks,
        threadTs: message.threadTs
      })
      .then((result) => {
        settle(result.ok, result.ts ?? '', result.error ?? '');
      })
      .catch((err: unknown) => {
        settle(false, '', err instanceof Error ? err.message : String(err));
      });
  },
  dispose: () => {
    return {};
  }
});
