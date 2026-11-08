import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGraphApi } from '@/Graphs/Graph.js';
import type { Engine } from '@/engine/Engine.js';
import type { Dependencies } from '@/types/registry.js';
import { Debounce } from '@/Profiles/Core/Flow/Debounce.js';

const makeDebounce = () => {
  const graph = makeGraphApi({
    dependencies: {} as unknown as Dependencies,
    values: {}
  });
  return new Debounce(Debounce.Description, graph, {}, 'debounce-1');
};

const makeEngineSpy = () => {
  const commitToNewFiber = vi.fn();
  return {
    engine: { commitToNewFiber } as unknown as Engine,
    commitToNewFiber
  };
};

describe('Debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not throw and does not commit when triggered with cancel', async () => {
    const node = makeDebounce();
    const { engine, commitToNewFiber } = makeEngineSpy();

    await node.triggered(engine, 'cancel', vi.fn());
    await vi.advanceTimersByTimeAsync(2000);

    expect(commitToNewFiber).not.toHaveBeenCalled();
  });

  it('commits once and settles after the quiet period', async () => {
    const node = makeDebounce();
    node.inputs.find((socket) => socket.name === 'waitDuration')!.value = 0.01;
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();
    await node.triggered(engine, 'flow', finished);
    await vi.advanceTimersByTimeAsync(10);
    expect(commitToNewFiber).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('settles simultaneous invocations and only emits the latest', async () => {
    const node = makeDebounce();
    node.inputs.find((socket) => socket.name === 'waitDuration')!.value = 0.01;
    const { engine, commitToNewFiber } = makeEngineSpy();
    const first = vi.fn();
    const second = vi.fn();
    await Promise.all([
      node.triggered(engine, 'flow', first),
      node.triggered(engine, 'flow', second)
    ]);
    await vi.advanceTimersByTimeAsync(10);
    expect(commitToNewFiber).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('settles pending and cancel invocations without emitting', async () => {
    const node = makeDebounce();
    node.inputs.find((socket) => socket.name === 'waitDuration')!.value = 1;
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();
    await node.triggered(engine, 'flow', finished);
    await node.triggered(engine, 'cancel', finished);
    expect(finished).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(commitToNewFiber).not.toHaveBeenCalled();
  });

  it('settles all pending invocations during disposal', async () => {
    const node = makeDebounce();
    node.inputs.find((socket) => socket.name === 'waitDuration')!.value = 1;
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();
    await node.triggered(engine, 'flow', finished);
    await node.dispose();
    expect(finished).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(commitToNewFiber).not.toHaveBeenCalled();
  });
});
