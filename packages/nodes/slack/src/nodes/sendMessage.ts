import {
  makeAsyncNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

/**
 * **Action**: post a plain-text message to a Slack channel via the host-injected
 * `ISlackClient`. Configure the `channel` (id like `C0123ABCD` or name like
 * `#general`) and, for a multi-workspace host, the `workspace` (team id). Reply
 * in a thread by setting `threadTs`.
 *
 * Async: downstream `flow` fires only after Slack acknowledges. `ok`/`ts`/`error`
 * report the outcome so the graph can branch on success.
 */
export const SendMessage = makeAsyncNodeDefinition({
  typeName: 'slack/sendMessage',
  label: 'Slack: Send Message',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    channel: {
      valueType: 'string',
      defaultValue: '',
      label: 'channel'
    },
    text: {
      valueType: 'string',
      defaultValue: '',
      label: 'text'
    },
    workspace: {
      valueType: 'string',
      defaultValue: '',
      label: 'workspace'
    },
    threadTs: {
      valueType: 'string',
      defaultValue: '',
      label: 'thread ts'
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
    const text = read<string>('text');
    const workspace = read<string>('workspace');
    const threadTs = read<string>('threadTs');

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
        text,
        workspace: workspace ? workspace : undefined,
        threadTs: threadTs ? threadTs : undefined
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
