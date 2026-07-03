import { describe, it, expect } from 'vitest';
import { registerCoreProfile } from '~/Profiles/Core/registerCoreProfile.js';
import { readGraphFromJSON } from '~/Graphs/IO/readGraphFromJSON.js';
import { Engine } from '~/engine/Engine.js';
import { runSubgraph } from '~/engine/runSubgraph.js';
import type { GraphJSON } from '~/Graphs/IO/GraphJSON.js';
import type { IRegistry, Dependencies } from '~/types/registry.js';

const makeRegistry = (): IRegistry =>
  registerCoreProfile({
    values: {},
    nodes: {},
    dependencies: {} as unknown as Dependencies
  });

// --- graph builders -------------------------------------------------------

/** Subgraph that passes input `inName` straight to output `outName`. */
const passthroughGraph = (inName = 'x', outName = 'y'): GraphJSON => ({
  nodes: [
    {
      id: 'in',
      type: 'graph/input',
      configuration: { parameters: [{ name: inName, valueTypeName: 'float' }] },
      flows: { flow: { nodeId: 'out', socket: 'flow' } }
    },
    {
      id: 'out',
      type: 'graph/output',
      configuration: {
        parameters: [{ name: outName, valueTypeName: 'float' }]
      },
      parameters: { [outName]: { link: { nodeId: 'in', socket: inName } } }
    }
  ]
});

/** Subgraph: in(x) -> callSubgraph(subgraphId)(x) -> out(y = call.y). */
const callerGraph = (subgraphId: string): GraphJSON => ({
  nodes: [
    {
      id: 'in',
      type: 'graph/input',
      configuration: { parameters: [{ name: 'x', valueTypeName: 'float' }] },
      flows: { flow: { nodeId: 'call', socket: 'flow' } }
    },
    {
      id: 'call',
      type: 'flow/callSubgraph',
      configuration: {
        subgraphId,
        inputs: [{ name: 'x', valueTypeName: 'float' }],
        outputs: [{ name: 'y', valueTypeName: 'float' }]
      },
      parameters: { x: { link: { nodeId: 'in', socket: 'x' } } },
      flows: { completed: { nodeId: 'out', socket: 'flow' } }
    },
    {
      id: 'out',
      type: 'graph/output',
      configuration: { parameters: [{ name: 'y', valueTypeName: 'float' }] },
      parameters: { y: { link: { nodeId: 'call', socket: 'y' } } }
    }
  ]
});

// --- regression -----------------------------------------------------------

describe('subgraph invocation (regression)', () => {
  it('runSubgraph seeds inputs and collects outputs', async () => {
    const outputs = await runSubgraph({
      graphJson: passthroughGraph(),
      registry: makeRegistry(),
      inputs: { x: 7 }
    });
    expect(outputs.y).toBe(7);
  });

  it('handles multiple inputs and outputs', async () => {
    const multi: GraphJSON = {
      nodes: [
        {
          id: 'in',
          type: 'graph/input',
          configuration: {
            parameters: [
              { name: 'x', valueTypeName: 'float' },
              { name: 'z', valueTypeName: 'float' }
            ]
          },
          flows: { flow: { nodeId: 'out', socket: 'flow' } }
        },
        {
          id: 'out',
          type: 'graph/output',
          configuration: {
            parameters: [
              { name: 'p', valueTypeName: 'float' },
              { name: 'q', valueTypeName: 'float' }
            ]
          },
          parameters: {
            p: { link: { nodeId: 'in', socket: 'x' } },
            q: { link: { nodeId: 'in', socket: 'z' } }
          }
        }
      ]
    };
    const outputs = await runSubgraph({
      graphJson: multi,
      registry: makeRegistry(),
      inputs: { x: 1, z: 2 }
    });
    expect(outputs).toEqual({ p: 1, q: 2 });
  });

  it('maps inputs/outputs by stable id, independent of display name', async () => {
    // params carry an explicit id distinct from the (renamable) name.
    const child: GraphJSON = {
      nodes: [
        {
          id: 'in',
          type: 'graph/input',
          configuration: {
            parameters: [{ id: 'i1', name: 'My Input', valueTypeName: 'float' }]
          },
          flows: { flow: { nodeId: 'out', socket: 'flow' } }
        },
        {
          id: 'out',
          type: 'graph/output',
          configuration: {
            parameters: [
              { id: 'o1', name: 'My Output', valueTypeName: 'float' }
            ]
          },
          parameters: { o1: { link: { nodeId: 'in', socket: 'i1' } } }
        }
      ]
    };

    const outputs = await runSubgraph({
      graphJson: child,
      registry: makeRegistry(),
      inputs: { i1: 42 }
    });

    expect(outputs).toEqual({ o1: 42 });
    expect(outputs['My Output']).toBeUndefined();
  });

  it('a Call Subgraph node runs the child and writes its outputs back', async () => {
    const baseRegistry = makeRegistry();
    const child = passthroughGraph();
    const registry: IRegistry = {
      ...baseRegistry,
      dependencies: {
        ...baseRegistry.dependencies,
        IGraphApi: {
          getGraph: (id: string) => (id === 'child' ? child : undefined),
          runGraph: (_id: string, inputs: Record<string, any>) =>
            runSubgraph({ graphJson: child, registry: baseRegistry, inputs })
        }
      }
    };

    const parent: GraphJSON = {
      nodes: [
        {
          id: 'call',
          type: 'flow/callSubgraph',
          configuration: {
            subgraphId: 'child',
            inputs: [{ name: 'x', valueTypeName: 'float' }],
            outputs: [{ name: 'y', valueTypeName: 'float' }]
          },
          parameters: { x: { value: 9 } }
        }
      ]
    };

    const instance = readGraphFromJSON({ graphJson: parent, registry });
    const engine = new Engine(instance, registry);
    const callNode = instance.nodes['call'];
    engine.trigger(callNode, 'flow');
    await engine.executeAllAsync();
    expect(callNode.outputs.find((s) => s.name === 'y')?.value).toBe(9);
    engine.dispose();
  });

  it('propagates values through nested subgraphs (A -> B -> C)', async () => {
    const graphs: Record<string, GraphJSON> = {
      topA: callerGraph('midB'),
      midB: callerGraph('leafC'),
      leafC: passthroughGraph()
    };
    const resolveGraph = (id: string) => graphs[id];

    const outputs = await runSubgraph({
      graphJson: graphs.topA,
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph,
      graphId: 'topA'
    });
    expect(outputs.y).toBe(5);
  });
});

// --- recursion / cycle safety ("loop writing output") ---------------------

describe('subgraph recursion safety', () => {
  it('refuses an unresolvable subgraph and completes', async () => {
    const outputs = await runSubgraph({
      graphJson: callerGraph('missing'),
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph: () => undefined,
      graphId: 'caller'
    });
    // call produced nothing -> output keeps its default
    expect(outputs.y).toBe(0);
  });

  it('terminates when a subgraph calls itself (direct cycle)', async () => {
    const graphs: Record<string, GraphJSON> = { selfA: callerGraph('selfA') };
    const outputs = await runSubgraph({
      graphJson: graphs.selfA,
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph: (id) => graphs[id],
      graphId: 'selfA'
    });
    // recursive call refused -> default output, but the run terminates
    expect(outputs.y).toBe(0);
  });

  it('refuses immediately when the graph is already on the stack', async () => {
    const graphs: Record<string, GraphJSON> = { selfA: callerGraph('selfA') };
    const outputs = await runSubgraph({
      graphJson: graphs.selfA,
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph: (id) => graphs[id],
      graphId: 'selfA',
      stack: ['selfA']
    });
    expect(outputs.y).toBeUndefined();
  });

  it('terminates on a mutual cycle (A -> B -> A)', async () => {
    const graphs: Record<string, GraphJSON> = {
      mutA: callerGraph('mutB'),
      mutB: callerGraph('mutA')
    };
    const outputs = await runSubgraph({
      graphJson: graphs.mutA,
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph: (id) => graphs[id],
      graphId: 'mutA'
    });
    expect(outputs.y).toBe(0);
  });

  it('returns once at the first output even when a loop would write again', async () => {
    // in -> forLoop(0..1000) -> graph/output(y = index). A function should
    // return the FIRST iteration's value (0), not run the loop to completion
    // and return the last value (999).
    const looping: GraphJSON = {
      nodes: [
        {
          id: 'in',
          type: 'graph/input',
          configuration: { parameters: [] },
          flows: { flow: { nodeId: 'loop', socket: 'flow' } }
        },
        {
          id: 'loop',
          type: 'flow/forLoop',
          parameters: { startIndex: { value: 0 }, endIndex: { value: 1000 } },
          flows: { loopBody: { nodeId: 'out', socket: 'flow' } }
        },
        {
          id: 'out',
          type: 'graph/output',
          configuration: {
            parameters: [{ name: 'y', valueTypeName: 'integer' }]
          },
          parameters: { y: { link: { nodeId: 'loop', socket: 'index' } } }
        }
      ]
    };

    const outputs = await runSubgraph({
      graphJson: looping,
      registry: makeRegistry()
    });
    expect(Number(outputs.y)).toBe(0);
  });

  it('cuts off nesting deeper than maxDepth', async () => {
    // g0 -> g1 -> g2 -> g3 -> g4 -> leaf(passthrough)
    const graphs: Record<string, GraphJSON> = {
      g0: callerGraph('g1'),
      g1: callerGraph('g2'),
      g2: callerGraph('g3'),
      g3: callerGraph('g4'),
      g4: callerGraph('leaf'),
      leaf: passthroughGraph()
    };
    const outputs = await runSubgraph({
      graphJson: graphs.g0,
      registry: makeRegistry(),
      inputs: { x: 5 },
      resolveGraph: (id) => graphs[id],
      graphId: 'g0',
      maxDepth: 3
    });
    // the deep passthrough is never reached, so the value is truncated to the
    // default, and (critically) the run terminates rather than recursing.
    expect(outputs.y).toBe(0);
  });
});
