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
 * **Event**: fires when a message is posted to Slack. Set `channel` (id or name)
 * to listen to one channel, or leave it empty to react to every message the
 * connector observes. `workspace` further narrows to a team id.
 *
 * Subscribes to the host-injected `ISlackEventSource` at engine startup and
 * unsubscribes on dispose , the same lifecycle as `lifecycle/onStart`. On the
 * backend the server's connector decides how this descriptor maps onto real
 * Slack subscriptions.
 */
export const OnMessage = makeEventNodeDefinition({
  typeName: 'slack/onMessage',
  label: 'Slack: On Message',
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
        type: 'message',
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
