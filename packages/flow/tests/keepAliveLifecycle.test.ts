import { describe, it, expect } from 'vitest';
import {
  Engine,
  ManualLifecycleEventEmitter,
  makeEventNodeDefinition,
  makeFlowNodeDefinition,
  readGraphFromJSON,
  registerCoreProfile,
  NodeCategory,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import {
  executeGraphLifecycle,
  type ActiveRun,
  type MessageContext
} from '../src/plugin/graphrunner-local/execution-utils.js';

/**
 * A minimal external event source standing in for the AI conversation runtime:
 * the event node subscribes on init, and `fire()` commits a flow the way
 * ai/onToolCall does when the model requests a tool.
 */
const makeExternalSource = () => {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    fire() {
      listeners.forEach((listener) => listener());
    },
    get listenerCount() {
      return listeners.size;
    }
  };
};

const buildRun = (handled: string[]) => {
  const source = makeExternalSource();

  const onExternal = makeEventNodeDefinition({
    typeName: 'test/onExternal',
    category: NodeCategory.Event,
    in: {},
    out: { flow: 'flow' },
    initialState: { unsubscribe: undefined as undefined | (() => void) },
    init: ({ commit }) => ({
      unsubscribe: source.subscribe(() => commit('flow'))
    }),
    dispose: ({ state }) => {
      state.unsubscribe?.();
      return { unsubscribe: undefined };
    }
  });

  const handle = makeFlowNodeDefinition({
    typeName: 'test/handle',
    category: NodeCategory.Action,
    in: { flow: 'flow' },
    out: {},
    initialState: undefined,
    triggered: () => {
      handled.push('handled');
    }
  });

  const registry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {
      ILifecycleEventEmitter: new ManualLifecycleEventEmitter()
    }
  });
  registry.nodes['test/onExternal'] = onExternal;
  registry.nodes['test/handle'] = handle;

  const graphJson: GraphJSON = {
    name: 'keep-alive test',
    nodes: [
      {
        id: 'listener',
        type: 'test/onExternal',
        flows: { flow: { nodeId: 'handler', socket: 'flow' } }
      },
      { id: 'handler', type: 'test/handle' }
    ],
    variables: [],
    customEvents: []
  };

  const graphInstance = readGraphFromJSON({ graphJson, registry });
  const engine = new Engine(graphInstance, registry);

  const run: ActiveRun = {
    runId: 'run-1',
    graphId: 'graph-1',
    engine,
    graphInstance,
    registry,
    status: 'running',
    startedAt: Date.now(),
    performance: { nodesExecuted: 0, eventsEmitted: 0, variableChanges: 0 },
    isPaused: false,
    executionPhase: 'start',
    currentTick: 0
  };

  return { run, source };
};

const collectMessages = () => {
  const messages: Array<{ type: string }> = [];
  const ctx: MessageContext = {
    sendMessage: (message) => messages.push(message),
    sendError: () => {}
  };
  return { messages, ctx };
};

describe('graph run lifecycle', () => {
  it('autoEnd: true finalizes when flows drain and unsubscribes event nodes', async () => {
    const handled: string[] = [];
    const { run, source } = buildRun(handled);
    const { messages, ctx } = collectMessages();

    // The engine constructor fires event-node init without awaiting it; let
    // its state (the unsubscribe handle) settle before the lifecycle disposes.
    await new Promise((resolve) => setTimeout(resolve, 0));

    await executeGraphLifecycle(run, 'graph-1', ctx, { autoEnd: true });

    expect(run.status).toBe('completed');
    expect(messages.some((m) => m.type === 'completed')).toBe(true);
    // Dispose tore the subscription down; a late event finds no listener.
    expect(source.listenerCount).toBe(0);
  });

  it('stays alive by default and services events fired after the flows drain', async () => {
    const handled: string[] = [];
    const { run, source } = buildRun(handled);
    const { messages, ctx } = collectMessages();

    const lifecycle = executeGraphLifecycle(run, 'graph-1', ctx, {
      tickInterval: 1
    });

    // Give the lifecycle time to drain the (empty) start flow. With autoEnd
    // it would have completed here.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(run.status).toBe('running');
    expect(source.listenerCount).toBe(1);

    // The out-of-band event (the "tool call") arrives after the start flow
    // ended; the idle loop must still drain the fiber it commits.
    source.fire();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handled).toEqual(['handled']);

    // Stopping ends the idle loop; no `completed` message is emitted.
    run.status = 'stopped';
    await lifecycle;
    expect(messages.some((m) => m.type === 'completed')).toBe(false);

    run.engine.dispose();
  });
});
