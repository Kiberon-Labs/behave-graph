import { expect, it, vi } from 'vitest';
import type { ExecutionLifecycleObservation } from '@/engine/ExecutionObserver.js';
import { RealtimeEngine } from '@/engine/RealtimeEngine.js';
import { Engine } from '@/engine/Engine.js';
import { Fiber } from '@/engine/Fiber.js';
import { Link } from '@/Nodes/Link.js';
import { makeGraphApi } from '@/Graphs/Graph.js';
import { registerCoreProfile } from '@/Profiles/Core/registerCoreProfile.js';
import { makeFunctionNodeDefinition } from '@/Nodes/FunctionNode.js';
import {
  makeFlowNodeDefinition,
  makeAsyncNodeDefinition,
  makeEventNodeDefinition
} from '@/Nodes/NodeDefinitions.js';
import { resolveSocketValue } from '@/engine/resolveSocketValue.js';
import { Socket } from '@/Sockets/Socket.js';
import { Debounce } from '@/Profiles/Core/Flow/Debounce.js';
import { Throttle } from '@/Profiles/Core/Flow/Throttle.js';
import type { INode } from '@/Nodes/NodeInstance.js';
import type {
  ExecutionObservation,
  InvocationContext
} from '@/engine/ExecutionObserver.js';

const registry = registerCoreProfile({
  nodes: {},
  values: {},
  dependencies: {}
});
const api = makeGraphApi(registry);
function host(
  nodes: INode[],
  observer: (event: ExecutionObservation) => void,
  captureValue?: (value: unknown) => unknown
) {
  return new Engine(
    {
      v: 1,
      name: 'test',
      metadata: {},
      nodes: Object.fromEntries(nodes.map((n) => [n.id, n])),
      variables: {},
      customEvents: {}
    },
    registry,
    { observer, captureValue, deferInitialization: true }
  );
}
function input(node: INode) {
  const socket = new Socket('float', 'input');
  socket.links.push(new Link(node.id, 'result'));
  return socket;
}

it.each(['first input', 'later input', 'execution'])(
  'stops async function resolution after disposal during %s',
  async (stage) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const source = (id: string, blocked: boolean) =>
      makeFunctionNodeDefinition({
        typeName: 'test/' + id,
        in: {},
        out: { result: 'float' },
        exec: async ({ write }) => {
          if (blocked) await gate;
          write('result', 42);
        }
      }).nodeFactory(api, {}, id);
    const first = source('first', stage === 'first input');
    const second = source('second', stage === 'later input');
    const execute = vi.fn(async () => {
      if (stage === 'execution') await gate;
    });
    const target = makeFunctionNodeDefinition({
      typeName: 'test/target',
      in: { first: 'float', second: 'float' },
      out: { result: 'float' },
      exec: execute
    }).nodeFactory(api, {}, 'target');
    target.inputs[0]!.links.push(new Link('first', 'result'));
    target.inputs[1]!.links.push(new Link('second', 'result'));
    const records: ExecutionObservation[] = [];
    const engine = host([first, second, target], (event) =>
      records.push(event)
    );
    const output = input(target);
    output.value = -1;
    const running = resolveSocketValue(engine, output);
    if (stage === 'later input') {
      await vi.waitFor(() =>
        expect(
          records.some(
            (event) =>
              event.kind === 'started' && event.context.nodeId === 'second'
          )
        ).toBe(true)
      );
    } else if (stage === 'execution') {
      await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce());
    }
    await engine.disposeAsync();
    const ends = vi.fn();
    engine.onNodeExecutionEnd.addListener(ends);
    const recordCount = records.length;
    release();
    await running;
    expect(execute).toHaveBeenCalledTimes(stage === 'execution' ? 1 : 0);
    expect(output.value).toBe(-1);
    expect(ends).not.toHaveBeenCalled();
    expect(records).toHaveLength(recordCount);
  }
);

it.each([Debounce, Throttle])(
  'preserves the timer invocation as the downstream parent for %s',
  async (Node) => {
    vi.useFakeTimers();
    const timer = Node.Description.nodeFactory(api, {}, 'timer');
    const downstream = makeFlowNodeDefinition({
      typeName: 'test/downstream',
      in: { flow: 'flow' },
      out: {},
      initialState: {},
      triggered: () => {}
    }).nodeFactory(api, {}, 'downstream');
    timer.outputs[0]!.links.push(new Link('downstream', 'flow'));
    const records: ExecutionObservation[] = [];
    const engine = host([timer, downstream], (event) => records.push(event));
    try {
      await new Fiber(engine, new Link('timer', 'flow')).executeStep();
      await new Fiber(engine, new Link('timer', 'flow')).executeStep();
      await vi.advanceTimersByTimeAsync(1000);
      await engine.executeAllSync();
      const starts = records.filter((event) => event.kind === 'started');
      const timerStarts = starts.filter(
        (event) => event.context.nodeId === 'timer'
      );
      const parent = timerStarts[Node === Debounce ? 1 : 0]!.context;
      expect(
        starts.find((event) => event.context.nodeId === 'downstream')
      ).toMatchObject({
        context: {
          parentInvocationId: parent.invocationId,
          parentExecutionId: parent.executionId
        }
      });
      expect(records.filter((event) => event.kind === 'commit')).toMatchObject([
        { context: { invocationId: parent.invocationId }, socket: 'flow' }
      ]);
    } finally {
      await engine.disposeAsync();
      vi.useRealTimers();
    }
  }
);

it('observes repeated calculations with distinct IDs, safe snapshots and manual events', async () => {
  const events: ExecutionObservation[] = [];
  const node = makeFunctionNodeDefinition({
    typeName: 'test/calculate',
    in: {},
    out: { result: 'float' },
    exec: ({ write, invocation }) => {
      invocation?.emit('calculated', { factor: 3 });
      write('result', 300);
    }
  }).nodeFactory(api, {}, 'calculate');
  const engine = host(
    [node],
    (e) => events.push(e),
    (value) => structuredClone(value)
  );
  await engine.initialize();
  expect(resolveSocketValue(engine, input(node))).toBe(1);
  expect(resolveSocketValue(engine, input(node))).toBe(1);
  const starts = events.filter((e) => e.kind === 'started');
  expect(new Set(starts.map((e) => e.context.invocationId)).size).toBe(2);
  const ends = events.filter((e) => e.kind === 'finished');
  expect(ends).toHaveLength(2);
  expect(ends[0]).toMatchObject({
    outcome: 'completed',
    sockets: [{ name: 'result', value: 300 }]
  });
  expect(events.filter((e) => e.kind === 'diagnostic')).toHaveLength(2);
});

it('attributes synchronous and asynchronous calculation errors to the calculation', async () => {
  for (const asyncFailure of [false, true]) {
    const events: ExecutionObservation[] = [];
    const node = makeFunctionNodeDefinition({
      typeName: 'test/fail',
      in: {},
      out: { result: 'float' },
      exec: () => {
        if (asyncFailure) return Promise.reject(new Error('broken'));
        throw new Error('broken');
      }
    }).nodeFactory(api, {}, 'failing');
    const engine = host([node], (e) => events.push(e));
    const errors: string[] = [];
    engine.onNodeExecutionError.addListener(({ node }) => errors.push(node.id));
    await expect(
      async () => await resolveSocketValue(engine, input(node))
    ).rejects.toThrow('broken');
    expect(events.filter((e) => e.kind === 'finished')).toMatchObject([
      { context: { nodeId: 'failing' }, outcome: 'failed' }
    ]);
    expect(errors).toEqual(['failing']);
  }
});

it('nests input calculations beneath the consuming flow invocation and records branch selection', () => {
  const events: ExecutionObservation[] = [];
  const calculation = makeFunctionNodeDefinition({
    typeName: 'test/value',
    in: {},
    out: { result: 'float' },
    exec: ({ write }) => write('result', 42)
  }).nodeFactory(api, {}, 'value');
  const flow = makeFlowNodeDefinition({
    typeName: 'test/flow',
    in: { flow: 'flow', amount: 'float' },
    out: { selected: 'flow' },
    initialState: {},
    triggered: ({ commit }) => commit('selected')
  }).nodeFactory(api, {}, 'flow');
  flow.inputs
    .find((s) => s.name === 'amount')!
    .links.push(new Link('value', 'result'));
  const engine = host([calculation, flow], (e) => events.push(e));
  const fiber = new Fiber(engine, new Link('flow', 'flow'));
  expect(fiber.executeStep()).toBeUndefined();
  const starts = events.filter((e) => e.kind === 'started');
  expect(starts[1]!.context.parentInvocationId).toBe(
    starts[0]!.context.invocationId
  );
  expect(events.filter((e) => e.kind === 'finished')).toHaveLength(2);
  expect(events.find((e) => e.kind === 'commit')).toMatchObject({
    socket: 'selected',
    targets: []
  });
});

it('isolates observer and capture failures from execution and omits values by default', () => {
  const node = makeFunctionNodeDefinition({
    typeName: 'test/value',
    in: {},
    out: { result: 'float' },
    exec: ({ write }) => write('result', 42)
  }).nodeFactory(api, {}, 'value');
  const events: ExecutionObservation[] = [];
  expect(
    resolveSocketValue(
      host([node], (e) => events.push(e)),
      input(node)
    )
  ).toBe(1);
  expect(events.find((e) => e.kind === 'finished')).toMatchObject({
    sockets: [{ name: 'result' }]
  });
  const end = events.find((e) => e.kind === 'finished');
  if (end?.kind === 'finished')
    expect(end.sockets[0]).not.toHaveProperty('value');
  expect(
    resolveSocketValue(
      host(
        [node],
        () => {
          throw new Error('export');
        },
        () => {
          throw new Error('capture');
        }
      ),
      input(node)
    )
  ).toBe(1);
});

it('settles concurrent async invocations once, even with duplicate completion', async () => {
  const events: ExecutionObservation[] = [];
  const completions: (() => void)[] = [];
  const contexts: (InvocationContext | undefined)[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/pending',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ finished, invocation }) => {
      completions.push(finished!);
      contexts.push(invocation);
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], (e) => events.push(e));
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  expect(engine.asyncNodes).toHaveLength(2);
  completions[1]!();
  completions[1]!();
  expect(engine.asyncNodes).toHaveLength(1);
  engine.dispose();
  completions[0]!();
  expect(
    events
      .filter((e) => e.kind === 'finished')
      .map((e) => e.kind === 'finished' && e.outcome)
  ).toEqual(['completed', 'cancelled']);
  contexts[0]?.emit('late');
  expect(events.filter((e) => e.kind === 'diagnostic')).toHaveLength(0);
});

it('awaits deferred initialization and reports initialization failure', async () => {
  const events: ExecutionObservation[] = [];
  const node = makeEventNodeDefinition({
    typeName: 'test/event',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: async () => {
      throw new Error('init');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'event');
  const engine = host([node], (e) => events.push(e));
  expect(events).toHaveLength(0);
  await expect(engine.initialize()).rejects.toThrow('init');
  await expect(engine.executeAllAsync()).rejects.toThrow('init');
  expect(events.filter((e) => e.kind === 'finished')).toMatchObject([
    { outcome: 'failed' }
  ]);
});

it('preserves async calculation context and closes consumers when input resolution fails', async () => {
  for (const fail of [false, true]) {
    const events: ExecutionObservation[] = [];
    const source = makeFunctionNodeDefinition({
      typeName: 'test/source',
      in: {},
      out: { result: 'float' },
      exec: async ({ write }) => {
        if (fail) throw new Error('source');
        write('result', 3);
      }
    }).nodeFactory(api, {}, 'source');
    const target = makeFunctionNodeDefinition({
      typeName: 'test/target',
      in: { value: 'float' },
      out: { result: 'float' },
      exec: ({ read, write, invocation }) => {
        invocation?.emit('target');
        write('result', read('value'));
      }
    }).nodeFactory(api, {}, 'target');
    target.inputs[0]!.links.push(new Link('source', 'result'));
    const engine = host([source, target], (e) => events.push(e));
    if (fail)
      await expect(resolveSocketValue(engine, input(target))).rejects.toThrow(
        'source'
      );
    else expect(await resolveSocketValue(engine, input(target))).toBe(2);
    expect(events.filter((e) => e.kind === 'finished')).toHaveLength(2);
    const starts = events.filter((e) => e.kind === 'started');
    expect(starts[1]!.context.parentInvocationId).toBe(
      starts[0]!.context.invocationId
    );
    if (!fail)
      expect(events.find((e) => e.kind === 'diagnostic')).toMatchObject({
        context: { nodeId: 'target' }
      });
  }
});

it('cleans up rejected async invocations', async () => {
  const events: ExecutionObservation[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/reject',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: async () => {
      throw new Error('reject');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], (e) => events.push(e));
  await expect(
    new Fiber(engine, new Link('async', 'flow')).executeStep()
  ).rejects.toThrow('reject');
  expect(engine.asyncNodes).toHaveLength(0);
  expect(events.filter((e) => e.kind === 'finished')).toMatchObject([
    { outcome: 'failed' }
  ]);
});

it('reports budget exhaustion and closes pending spans', async () => {
  const events: ExecutionObservation[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/pending',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: () => {},
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], (e) => events.push(e));
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  expect(await engine.executeWithOutcome(0)).toMatchObject({
    outcome: 'timed_out',
    pendingAsyncNodes: 1
  });
  expect(events.filter((e) => e.kind === 'finished')).toMatchObject([
    { outcome: 'timed_out' }
  ]);
  expect(engine.hasPending()).toBe(false);
});

it('observes event activations after initialization ends', async () => {
  const events: ExecutionObservation[] = [];
  let fire = () => {};
  const event = makeEventNodeDefinition({
    typeName: 'test/event',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: ({ commit }) => {
      fire = () => commit('flow');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'event');
  const engine = host([event], (e) => events.push(e));
  await engine.initialize();
  fire();
  fire();
  expect(
    events.filter((e) => e.kind === 'started').map((e) => e.context.phase)
  ).toEqual(['initialization', 'event', 'event']);
  expect(events.filter((e) => e.kind === 'commit')).toHaveLength(2);
  expect(events.filter((e) => e.kind === 'finished')).toHaveLength(3);
});

it('propagates detached async failures through the run outcome', async () => {
  const events: ExecutionObservation[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/detached',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ finished }) => {
      queueMicrotask(() => finished?.(new Error('detached')));
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], (e) => events.push(e));
  engine.trigger(node, 'flow');
  expect(await engine.executeWithOutcome()).toMatchObject({
    outcome: 'failed',
    error: new Error('detached')
  });
  expect(events.filter((e) => e.kind === 'finished')).toMatchObject([
    { outcome: 'failed' }
  ]);
  expect(engine.hasPending()).toBe(false);
});

it('gives continuation callbacks their own invocation context', () => {
  const events: ExecutionObservation[] = [];
  const node = makeFlowNodeDefinition({
    typeName: 'test/continuation',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ commit }) =>
      commit('flow', (_resolve, invocation) => {
        invocation?.emit('continued');
      })
  }).nodeFactory(api, {}, 'flow');
  const engine = host([node], (e) => events.push(e));
  const fiber = new Fiber(engine, new Link('flow', 'flow'));
  fiber.executeStep();
  fiber.executeStep();
  expect(
    events.filter((e) => e.kind === 'started').map((e) => e.context.phase)
  ).toEqual(['execution', 'continuation']);
  expect(events.find((e) => e.kind === 'diagnostic')).toMatchObject({
    context: { phase: 'continuation' }
  });
  expect(events.filter((e) => e.kind === 'finished')).toHaveLength(2);
});

it('distinguishes step limits from completion and failures', async () => {
  const events: ExecutionObservation[] = [];
  const start = makeEventNodeDefinition({
    typeName: 'test/start',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: ({ commit }) => {
      commit('flow');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'start');
  const loop = makeFlowNodeDefinition({
    typeName: 'test/loop',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ commit }) => commit('flow')
  }).nodeFactory(api, {}, 'loop');
  start.outputs[0]!.links.push(new Link('loop', 'flow'));
  loop.outputs[0]!.links.push(new Link('loop', 'flow'));
  const engine = host([start, loop], (e) => events.push(e));
  expect(await engine.executeWithOutcome(30, 2)).toMatchObject({
    outcome: 'step_limit',
    executionSteps: 2,
    pendingFibers: 1
  });
  expect(engine.hasPending()).toBe(false);
  expect(await host([], () => {}).executeWithOutcome()).toMatchObject({
    outcome: 'completed'
  });
});

it('emits one root lifecycle with the host run ID and isolated callbacks', async () => {
  const roots: ExecutionLifecycleObservation[] = [];
  const engine = new Engine(
    {
      v: 1,
      name: 'empty',
      metadata: {},
      nodes: {},
      variables: {},
      customEvents: {}
    },
    registry,
    {
      executionId: 'host-run',
      parent: { executionId: 'parent-run', invocationId: 'parent-step' },
      deferInitialization: true,
      onExecution: (event) => {
        roots.push(event);
        throw new Error('export');
      }
    }
  );
  expect(await engine.executeWithOutcome()).toMatchObject({
    outcome: 'completed'
  });
  await engine.disposeAsync();
  expect(roots.map((event) => event.kind)).toEqual([
    'execution_started',
    'execution_finished'
  ]);
  expect(roots[1]).toMatchObject({
    executionId: 'host-run',
    parent: { executionId: 'parent-run', invocationId: 'parent-step' },
    outcome: 'completed'
  });
  expect(roots[1]!.sequence).toBeGreaterThan(roots[0]!.sequence);
});

it('counts detached completions and prevents late completion from altering a cancelled run', async () => {
  let finish = (_error?: unknown) => {};
  const events: ExecutionObservation[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/detachedCount',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ finished }) => {
      finish = finished!;
      setTimeout(finish, 1);
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], (event) => events.push(event));
  engine.trigger(node, 'flow');
  expect(await engine.executeWithOutcome()).toMatchObject({
    outcome: 'completed',
    executionSteps: 1
  });
  expect(engine.executionSteps).toBe(1);
  finish();
  expect(engine.executionSteps).toBe(1);
  expect(events.filter((event) => event.kind === 'finished')).toHaveLength(1);
});

it('retains successful step counts when a later node fails', async () => {
  const start = makeEventNodeDefinition({
    typeName: 'test/start',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: ({ commit }) => {
      commit('flow');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'start');
  const good = makeFlowNodeDefinition({
    typeName: 'test/good',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ commit }) => commit('flow')
  }).nodeFactory(api, {}, 'good');
  const bad = makeFlowNodeDefinition({
    typeName: 'test/bad',
    in: { flow: 'flow' },
    out: {},
    initialState: {},
    triggered: () => {
      throw new Error('bad');
    }
  }).nodeFactory(api, {}, 'bad');
  start.outputs[0]!.links.push(new Link('good', 'flow'));
  good.outputs[0]!.links.push(new Link('bad', 'flow'));
  expect(
    await host([start, good, bad], () => {}).executeWithOutcome()
  ).toMatchObject({ outcome: 'failed', executionSteps: 1 });
});

it('tracks exact overlapping async operations in reverse completion order', async () => {
  const completions: (() => void)[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/overlap',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ finished }) => {
      completions.push(finished!);
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], () => {});
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  const operations = engine.pendingAsyncInvocations;
  expect(new Set(operations.map((op) => op.operationId)).size).toBe(2);
  completions[1]!();
  expect(engine.pendingAsyncInvocations).toEqual([operations[0]]);
  await engine.disposeAsync();
  const steps = engine.executionSteps;
  completions[0]!();
  expect(engine.executionSteps).toBe(steps);
  expect(engine.pendingAsyncInvocations).toEqual([]);
});

it('awaits cleanup of completed async nodes before finishing the root span', async () => {
  const roots: ExecutionLifecycleObservation[] = [];
  let release = () => {};
  let disposed = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const node = makeAsyncNodeDefinition({
    typeName: 'test/cleanup',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ finished }) => finished?.(),
    dispose: async () => {
      await gate;
      disposed = true;
    }
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], () => {});
  engine.observationOptions.onExecution = (event) => roots.push(event);
  engine.trigger(node, 'flow');
  const execution = engine.executeWithOutcome();
  await vi.waitFor(() => expect(engine.asyncNodes).toHaveLength(0));
  expect(disposed).toBe(false);
  expect(
    roots.filter((event) => event.kind === 'execution_finished')
  ).toHaveLength(0);
  release();
  expect(await execution).toMatchObject({ outcome: 'completed' });
  expect(disposed).toBe(true);
  expect(
    roots.filter((event) => event.kind === 'execution_finished')
  ).toMatchObject([{ outcome: 'completed' }]);
});

it('attempts all cleanup hooks and reports aggregate cleanup failures', async () => {
  const cleaned: string[] = [];
  const make = (id: string, fail: boolean) =>
    makeAsyncNodeDefinition({
      typeName: 'test/' + id,
      in: { flow: 'flow' },
      out: { flow: 'flow' },
      initialState: {},
      triggered: ({ finished }) => finished?.(),
      dispose: () => {
        cleaned.push(id);
        if (fail) throw new Error(id);
      }
    }).nodeFactory(api, {}, id);
  const engine = host([make('first', true), make('second', false)], () => {});
  const roots: ExecutionLifecycleObservation[] = [];
  engine.observationOptions.onExecution = (event) => roots.push(event);
  expect(await engine.executeWithOutcome()).toMatchObject({
    outcome: 'failed',
    error: expect.any(AggregateError)
  });
  expect(cleaned).toEqual(['first', 'second']);
  expect(
    roots.filter((event) => event.kind === 'execution_finished')
  ).toMatchObject([{ outcome: 'failed' }]);
});

it('waits for dynamic realtime event initialization and cancels all removed-node invocations', async () => {
  const events: ExecutionObservation[] = [];
  const engine = new RealtimeEngine(
    {
      v: 1,
      name: 'live',
      metadata: {},
      nodes: {},
      variables: {},
      customEvents: {}
    },
    registry,
    { deferInitialization: true, observer: (event) => events.push(event) }
  );
  const event = makeEventNodeDefinition({
    typeName: 'test/dynamic',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: async ({ invocation }) => {
      await Promise.resolve();
      invocation?.emit('ready');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'event');
  engine.addNode(event);
  await engine.executeAllSync();
  expect(events.find((record) => record.kind === 'diagnostic')).toMatchObject({
    name: 'ready'
  });
  const node = makeAsyncNodeDefinition({
    typeName: 'test/removed',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: () => {},
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  engine.addNode(node);
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  await new Fiber(engine, new Link('async', 'flow')).executeStep();
  engine.removeNode('async');
  expect(engine.pendingAsyncInvocations).toEqual([]);
  expect(
    events.filter(
      (record) =>
        record.kind === 'finished' && record.context.nodeId === 'async'
    )
  ).toMatchObject([{ outcome: 'cancelled' }, { outcome: 'cancelled' }]);
  await engine.disposeAsync();
});

it('does not reinitialize a realtime event when the engine first executes', async () => {
  let initialized = 0;
  const node = makeEventNodeDefinition({
    typeName: 'test/once',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: () => {
      initialized++;
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'event');
  const engine = new RealtimeEngine(
    {
      v: 1,
      name: 'live',
      metadata: {},
      nodes: {},
      variables: {},
      customEvents: {}
    },
    registry,
    { deferInitialization: true }
  );
  engine.addNode(node);
  await engine.executeAllSync();
  expect(initialized).toBe(1);
  await engine.disposeAsync();
});

it('waits for initialization before cleaning up an event cancelled during startup', async () => {
  let release = () => {};
  let disposed = false;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const node = makeEventNodeDefinition({
    typeName: 'test/startup',
    in: {},
    out: { flow: 'flow' },
    initialState: {},
    init: async () => {
      await gate;
    },
    dispose: () => {
      disposed = true;
    }
  }).nodeFactory(api, {}, 'event');
  const engine = host([node], () => {});
  const initialization = engine.initialize();
  const cleanup = engine.disposeAsync();
  expect(disposed).toBe(false);
  release();
  await initialization;
  await cleanup;
  expect(disposed).toBe(true);
});

it('suppresses successful completion events after a flow is cancelled', async () => {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const node = makeFlowNodeDefinition({
    typeName: 'test/slow',
    in: { flow: 'flow' },
    out: {},
    initialState: {},
    triggered: async () => {
      await gate;
    }
  }).nodeFactory(api, {}, 'flow');
  const records: ExecutionObservation[] = [];
  const engine = host([node], (record) => records.push(record));
  const ends = vi.fn();
  engine.onNodeExecutionEnd.addListener(ends);
  const running = new Fiber(engine, new Link('flow', 'flow')).executeStep();
  await engine.disposeAsync();
  release();
  await running;
  expect(records.filter((record) => record.kind === 'finished')).toMatchObject([
    { outcome: 'cancelled' }
  ]);
  expect(ends).not.toHaveBeenCalled();
  expect(engine.executionSteps).toBe(0);
});

it('preserves a failure outcome for legacy execution followed by disposal', async () => {
  const roots: ExecutionLifecycleObservation[] = [];
  const node = makeAsyncNodeDefinition({
    typeName: 'test/failure',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: async () => {
      throw new Error('failed');
    },
    dispose: () => {}
  }).nodeFactory(api, {}, 'async');
  const engine = host([node], () => {});
  engine.observationOptions.onExecution = (event) => roots.push(event);
  engine.trigger(node, 'flow');
  await expect(engine.executeAllAsync()).rejects.toThrow('failed');
  await engine.disposeAsync();
  expect(
    roots.filter((event) => event.kind === 'execution_finished')
  ).toMatchObject([{ outcome: 'failed' }]);
});

it('isolates rejected promises returned accidentally by observer callbacks', async () => {
  const node = makeFunctionNodeDefinition({
    typeName: 'test/value',
    in: {},
    out: { result: 'float' },
    exec: ({ write }) => write('result', 1)
  }).nodeFactory(api, {}, 'value');
  const engine = host([node], async () => {
    throw new Error('export');
  });
  engine.observationOptions.onExecution = async () => {
    throw new Error('root export');
  };
  expect(resolveSocketValue(engine, input(node))).toBe(1);
  await engine.disposeAsync();
  await new Promise((resolve) => setTimeout(resolve, 0));
});
