import {
  makeFlowNodeDefinition,
  NodeCategory
} from '@kiberon-labs/behave-graph';

/**
 * Answers a tool call requested by the model. Pair with `ai/onToolCall`: thread
 * its `callId` through to this node and supply the computed `result`. This
 * resolves the agentic loop's wait so the model can use the result.
 */
export const ToolResult = makeFlowNodeDefinition({
  typeName: 'ai/toolResult',
  label: 'AI: Tool Result',
  category: NodeCategory.Action,
  in: {
    flow: 'flow',
    callId: 'string',
    result: 'string'
  },
  out: {
    flow: 'flow'
  },
  initialState: undefined,
  triggered: ({ read, commit, graph }) => {
    const conversation = graph.getDependency('IConversationService');
    conversation?.provideToolResult(
      read<string>('callId'),
      read<string>('result')
    );
    commit('flow');
  }
});
