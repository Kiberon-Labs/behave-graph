import {
  makePureInOutFunctionDesc,
  NodeCategory
} from '@kiberon-labs/behave-graph';
import type {
  AgentSpec,
  ProviderConfig,
  ToolSpec
} from '../abstractions/types.js';

/**
 * Defines an agent from a provider, a model and an optional system prompt.
 *
 * Tools attach to the agent via the `tool` input. The scaffold accepts a single
 * tool socket; supporting many tools (a `tool[]` list socket or a `ai/toolset`
 * combiner node) is a follow-up , see README.
 */
export const Agent = makePureInOutFunctionDesc({
  typeName: 'ai/agent',
  label: 'AI: Agent',
  category: NodeCategory.Logic,
  in: {
    provider: {
      valueType: 'aiProvider',
      defaultValue: undefined,
      label: 'provider'
    },
    model: {
      valueType: 'string',
      defaultValue: 'gpt-4o-mini',
      label: 'model'
    },
    systemPrompt: {
      valueType: 'string',
      defaultValue: '',
      label: 'systemPrompt'
    },
    temperature: {
      valueType: 'float',
      defaultValue: 0.7,
      label: 'temperature'
    },
    tool: {
      valueType: 'aiTool',
      defaultValue: undefined,
      label: 'tool'
    }
  },
  out: {
    agent: 'aiAgent'
  },
  exec: ({ read, write }) => {
    const provider = read<ProviderConfig | undefined>('provider');
    const model = read<string>('model');
    const systemPrompt = read<string>('systemPrompt');
    const tool = read<ToolSpec | undefined>('tool');

    // An unconnected `tool` socket can resolve to an empty ToolSpec (name "");
    // only attach a real, named tool so agents without tools send none.
    const hasTool = Boolean(tool && tool.name && tool.name.trim().length > 0);

    const agent: AgentSpec = {
      provider: provider ?? { kind: 'openai' },
      model: model || provider?.defaultModel || 'gpt-4o-mini',
      systemPrompt: systemPrompt ? systemPrompt : undefined,
      temperature: read<number>('temperature'),
      tools: hasTool && tool ? [tool] : []
    };
    write('agent', agent);
  }
});
