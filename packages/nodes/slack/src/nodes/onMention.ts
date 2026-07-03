import {
  makeEventNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type { SlackEvent } from '../abstractions/types.js';

type State = {
  unsubscribe?: () => void;
};

const initialState = (): State => ({});

/**
 * **Event**: fires when the app/bot is @-mentioned (Slack `app_mention`). This is
 * the usual trigger for "the bot was asked to do something". Optional `channel`
 * and `workspace` narrow where it listens.
 */
export const OnMention = makeEventNodeDefinition({
  typeName: 'slack/onMention',
  label: 'Slack: On Mention',
  category: NodeCategory.Event,
  in: {
    channel: {
      valueType: 'string',
      defaultValue: '',
      label: 'channel'
    },
    workspace: {
      valueType: 'string',
      defaultValue: '',
      label: 'workspace'
    }
  },
  out: {
    flow: 'flow',
    channel: 'string',
    user: 'string',
    text: 'string',
    ts: 'string',
    threadTs: 'string'
  },
  initialState: initialState(),
  init: ({ read, write, commit, graph }) => {
    const source = graph.getDependency('ISlackEventSource');
    const channel = read<string>('channel');
    const workspace = read<string>('workspace');

    const handler = (event: SlackEvent) => {
      write('channel', event.channel);
      write('user', event.user);
      write('text', event.text);
      write('ts', event.ts);
      write('threadTs', event.threadTs ?? '');
      commit('flow');
    };

    const unsubscribe = source?.subscribe(
      {
        type: 'app_mention',
        channel: channel ? channel : undefined,
        workspace: workspace ? workspace : undefined
      },
      handler
    );

    const state: State = { unsubscribe };
    return state;
  },
  dispose: ({ state }) => {
    state.unsubscribe?.();
    return {};
  }
});
