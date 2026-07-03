import { makePureInOutFunctionDesc, NodeCategory } from '@kiberon-labs/behave-graph';
import type { ToolParameterSchema, ToolSpec } from '../abstractions/types.js';

function parseParameters(raw: string): ToolParameterSchema {
  try {
    const parsed = JSON.parse(raw) as ToolParameterSchema;
    if (parsed && parsed.type === 'object' && parsed.properties) {
      return parsed;
    }
  } catch {
    // fall through to default
  }
  return { type: 'object', properties: {} };
}

/**
 * Defines a tool the model can call. The `parameters` input is a JSON-schema
 * string describing the tool's arguments.
 *
 * Connect the produced `tool` value to an `ai/agent`. The agentic dispatch loop
 * (an `ai/onToolCall` event node that fires when the model invokes the tool and
 * an `ai/toolResult` node to answer it) is the next step , see README.
 */
export const Tool = makePureInOutFunctionDesc({
  typeName: 'ai/tool',
  label: 'AI: Tool',
  category: NodeCategory.Logic,
  in: {
    name: {
      valueType: 'string',
      defaultValue: 'my_tool',
      label: 'name'
    },
    description: {
      valueType: 'string',
      defaultValue: '',
      label: 'description'
    },
    parameters: {
      valueType: 'string',
      defaultValue: '{"type":"object","properties":{}}',
      label: 'parameters'
    }
  },
  out: {
    tool: 'aiTool'
  },
  exec: ({ read, write }) => {
    const tool: ToolSpec = {
      name: read<string>('name'),
      description: read<string>('description'),
      parameters: parseParameters(read<string>('parameters'))
    };
    write('tool', tool);
  }
});
