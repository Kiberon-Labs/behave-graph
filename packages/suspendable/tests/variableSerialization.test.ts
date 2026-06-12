import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { describe, expect, it } from 'vitest';
import { makeTestEngine } from './testUtils';

/**
 * onStart -> variable/set writes 1000 into the `counter` variable
 * (initial value -1).
 */
const variableGraph: GraphJSON = {
  variables: [
    {
      valueTypeName: 'float',
      name: 'counter',
      id: 0,
      initialValue: -1
    }
  ],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'variable/set',
      id: '1',
      configuration: { variableId: 0 },
      parameters: { value: { value: 1000 } }
    }
  ]
} as unknown as GraphJSON;

describe('variable serialization across suspension', () => {
  it('serializes the updated variable value, not the initial value', async () => {
    const { engine, graph, start } = makeTestEngine(variableGraph);

    start();
    await engine.executeAllSync();
    expect(graph.variables['0']!.get()).toBe(1000);

    const suspension = engine.suspend();

    expect(suspension.variables['0']).toEqual({
      type: 'float',
      value: 1000
    });
  });

  it('serializes the latest value when a variable is updated multiple times', async () => {
    const { engine, graph, start } = makeTestEngine(variableGraph);

    start();
    await engine.executeAllSync();

    // a later runtime update (e.g. another node firing) must win
    graph.variables['0']!.set(7);

    const suspension = engine.suspend();
    expect(suspension.variables['0']).toEqual({ type: 'float', value: 7 });
  });

  it('restores the suspended variable value into a fresh engine', async () => {
    const first = makeTestEngine(variableGraph);
    first.start();
    await first.engine.executeAllSync();

    const suspension = first.engine.suspend();
    const persisted = JSON.parse(JSON.stringify(suspension));

    // fresh graph starts back at the initial value...
    const second = makeTestEngine(variableGraph);
    expect(second.graph.variables['0']!.get()).toBe(-1);

    // ...until the suspension is rehydrated
    second.engine.unsuspend(persisted, undefined);
    expect(second.graph.variables['0']!.get()).toBe(1000);
  });

  it('throws when the suspension references a variable missing from the graph', async () => {
    const first = makeTestEngine(variableGraph);
    first.start();
    await first.engine.executeAllSync();
    const suspension = first.engine.suspend();

    const graphWithoutVariables = {
      ...variableGraph,
      variables: []
    } as unknown as GraphJSON;
    const second = makeTestEngine(graphWithoutVariables);

    expect(() => second.engine.unsuspend(suspension, undefined)).toThrow(
      /missing variable/
    );
  });
});
