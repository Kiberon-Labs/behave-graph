import { makeEventNodeDefinition, NodeCategory } from '@kiberon-labs/behave-graph';
import type { ToolCall } from '../abstractions/types.js';

type State = {
  unsubscribe?: () => void;
};

const initialState = (): State => ({});

/**
 * Fires when the model requests a tool call during a completion. This is how
 * graph-defined tools "connect onto the system": branch on `toolName`, compute a
 * result, then answer with an `ai/toolResult` node using the same `callId`.
 *
 * `arguments` is the tool's arguments as a JSON string.
 */
export const OnToolCall = makeEventNodeDefinition({
  typeName: 'ai/onToolCall',
  label: 'AI: On Tool Call',
  category: NodeCategory.Event,
  in: {},
  out: {
    flow: 'flow',
    callId: 'string',
    toolName: 'string',
    arguments: 'string'
  },
  initialState: initialState(),
  init: ({ write, commit, graph }) => {
    const conversation = graph.getDependency('IConversationService');

    const handler = (call: ToolCall) => {
      write('callId', call.id);
      write('toolName', call.name);
      write('arguments', JSON.stringify(call.arguments));
      commit('flow');
    };

    const unsubscribe = conversation?.onToolCall(handler);

    const state: State = { unsubscribe };
    return state;
  },
  dispose: ({ state }) => {
    state.unsubscribe?.();
    return {};
  }
});
