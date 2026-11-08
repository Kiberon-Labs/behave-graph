import { expect, it, vi, afterEach } from 'vitest';
import { makeGraphApi } from '@/Graphs/Graph.js';
import type { Dependencies } from '@/types/registry.js';
import type { Engine } from '@/engine/Engine.js';
import {
  makeAsyncNodeDefinition,
  makeEventNodeDefinition
} from '@/Nodes/NodeDefinitions.js';
import { isAsyncNode, isEventNode } from '@/Nodes/NodeInstance.js';
import { Delay } from '@/Profiles/Core/Time/Delay.js';

const graph = () =>
  makeGraphApi({ dependencies: {} as unknown as Dependencies, values: {} });
const engine = () => ({ commitToNewFiber: vi.fn() }) as unknown as Engine;
afterEach(() => vi.useRealTimers());

it('awaits asynchronous initialization and disposal of event factory nodes', async () => {
  let initialized = false;
  let disposed = false;
  let releaseInit: () => void = () => {};
  let releaseDispose: () => void = () => {};
  const initGate = new Promise<void>((resolve) => {
    releaseInit = resolve;
  });
  const disposeGate = new Promise<void>((resolve) => {
    releaseDispose = resolve;
  });
  const definition = makeEventNodeDefinition({
    typeName: 'test/asyncEvent',
    in: {},
    out: { flow: 'flow' },
    initialState: { initialized: false },
    init: async () => {
      await initGate;
      initialized = true;
      return { initialized: true };
    },
    dispose: async ({ state }) => {
      await disposeGate;
      disposed = true;
      return { initialized: state.initialized };
    }
  });
  const node = definition.nodeFactory(graph(), {}, 'event');
  if (!isEventNode(node)) throw new Error('Expected event node');
  const initialization = node.init(engine());
  await Promise.resolve();
  expect(initialized).toBe(false);
  releaseInit();
  await initialization;
  expect(initialized).toBe(true);
  const disposal = node.dispose(engine());
  await Promise.resolve();
  expect(disposed).toBe(false);
  releaseDispose();
  await disposal;
  expect(disposed).toBe(true);
});

it('awaits asynchronous disposal of async factory nodes', async () => {
  let disposed = false;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const definition = makeAsyncNodeDefinition({
    typeName: 'test/asyncCleanup',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: { disposed: false },
    triggered: ({ finished }) => {
      finished?.();
    },
    dispose: async () => {
      await gate;
      disposed = true;
      return { disposed: true };
    }
  });
  const node = definition.nodeFactory(graph(), {}, 'async');
  if (!isAsyncNode(node)) throw new Error('Expected async node');
  const disposal = node.dispose();
  await Promise.resolve();
  expect(disposed).toBe(false);
  release();
  await disposal;
  expect(disposed).toBe(true);
});

it('settles each Delay invocation while suppressing duplicate output', async () => {
  vi.useFakeTimers();
  const node = Delay.nodeFactory(graph(), {}, 'delay');
  if (!isAsyncNode(node)) throw new Error('Expected async node');
  const host = engine();
  const first = vi.fn();
  const second = vi.fn();
  await node.triggered(host, 'flow', first);
  await node.triggered(host, 'flow', second);
  expect(second).toHaveBeenCalledTimes(1);
  expect(first).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(first).toHaveBeenCalledTimes(1);
  expect(host.commitToNewFiber).toHaveBeenCalledTimes(1);
});

it('settles and clears a pending Delay during disposal without emitting', async () => {
  vi.useFakeTimers();
  const node = Delay.nodeFactory(graph(), {}, 'delay');
  if (!isAsyncNode(node)) throw new Error('Expected async node');
  const host = engine();
  const finished = vi.fn();
  await node.triggered(host, 'flow', finished);
  await node.dispose();
  await node.dispose();
  expect(finished).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  await vi.advanceTimersByTimeAsync(1000);
  expect(host.commitToNewFiber).not.toHaveBeenCalled();
});

it('keeps Delay timers isolated between node instances', async () => {
  vi.useFakeTimers();
  const first = Delay.nodeFactory(graph(), {}, 'first');
  const second = Delay.nodeFactory(graph(), {}, 'second');
  if (!isAsyncNode(first) || !isAsyncNode(second))
    throw new Error('Expected async nodes');
  const host = engine();
  const firstFinished = vi.fn();
  const secondFinished = vi.fn();
  await first.triggered(host, 'flow', firstFinished);
  await second.triggered(host, 'flow', secondFinished);
  await first.dispose();
  expect(firstFinished).toHaveBeenCalledTimes(1);
  expect(secondFinished).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(secondFinished).toHaveBeenCalledTimes(1);
  expect(host.commitToNewFiber).toHaveBeenCalledTimes(1);
});
