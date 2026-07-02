import { describe, expect, it } from 'vitest';
import {
  DefaultLogger,
  ManualLifecycleEventEmitter,
  readGraphFromJSON,
  registerCoreProfile,
  type Dependencies,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import { registerAIProfile } from '../src/index.js';
import type { ToolSpec } from '../src/abstractions/types.js';

const registry = registerAIProfile(
  registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
      ILogger: new DefaultLogger()
    } as Dependencies
  })
);

// Build an ai/agent node with an optional (serialized) tool param, execute it,
// and return the resulting agent's tools. An unconnected `tool` socket can yield
// an empty ToolSpec; sending that , or any tools , breaks models without tool
// support, so the agent must drop unnamed tools.
async function agentToolsFor(tool?: ToolSpec): Promise<ToolSpec[]> {
  const parameters: Record<string, { value: string }> = {
    provider: { value: JSON.stringify({ kind: 'openrouter' }) },
    model: { value: 'some-model' }
  };
  if (tool !== undefined) parameters.tool = { value: JSON.stringify(tool) };

  const graphJson: GraphJSON = {
    nodes: [{ id: 'agent', type: 'ai/agent', parameters }],
    variables: [],
    customEvents: []
  };
  const graph = readGraphFromJSON({ graphJson, registry });

  const node = graph.nodes['agent'] as unknown as {
    exec: (n: unknown) => Promise<unknown>;
    outputs: Array<{ name: string; value: { tools: ToolSpec[] } }>;
  };
  await node.exec(node);
  return node.outputs.find((s) => s.name === 'agent')!.value.tools;
}

const emptyTool: ToolSpec = {
  name: '',
  description: '',
  parameters: { type: 'object', properties: {} }
};
const namedTool: ToolSpec = {
  name: 'get_time',
  description: 'time',
  parameters: { type: 'object', properties: {} }
};

describe('ai/agent tool handling', () => {
  it('omits an unconnected or empty-name tool', async () => {
    expect(await agentToolsFor(undefined)).toEqual([]);
    expect(await agentToolsFor(emptyTool)).toEqual([]);
  });

  it('keeps a real, named tool', async () => {
    const tools = await agentToolsFor(namedTool);
    expect(tools.map((t) => t.name)).toEqual(['get_time']);
  });
});
