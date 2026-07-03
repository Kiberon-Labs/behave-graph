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
 * **Event**: fires when a reaction (emoji) is added to a message (Slack
 * `reaction_added`). `reaction` is the emoji name (e.g. `thumbsup`); `ts` is the
 * reacted-to message. Optional `channel`/`workspace` narrow where it listens.
 */
export const OnReaction = makeEventNodeDefinition({
  typeName: 'slack/onReaction',
  label: 'Slack: On Reaction',
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
    reaction: 'string',
    ts: 'string'
  },
  initialState: initialState(),
  init: ({ read, write, commit, graph }) => {
    const source = graph.getDependency('ISlackEventSource');
    const channel = read<string>('channel');
    const workspace = read<string>('workspace');

    const handler = (event: SlackEvent) => {
      write('channel', event.channel);
      write('user', event.user);
      write('reaction', event.reaction ?? '');
      write('ts', event.ts);
      commit('flow');
    };

    const unsubscribe = source?.subscribe(
      {
        type: 'reaction_added',
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
