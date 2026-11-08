import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeGraphApi } from '@/Graphs/Graph.js';
import type { Engine } from '@/engine/Engine.js';
import type { Dependencies } from '@/types/registry.js';
import { Throttle } from '@/Profiles/Core/Flow/Throttle.js';

const makeThrottle = () => {
  const graph = makeGraphApi({
    dependencies: {} as unknown as Dependencies,
    values: {}
  });
  return new Throttle(Throttle.Description, graph, {}, 'throttle-1');
};

const makeEngineSpy = () => {
  const commitToNewFiber = vi.fn();
  return {
    engine: { commitToNewFiber } as unknown as Engine,
    commitToNewFiber
  };
};

describe('Throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('commits to flow once the duration has elapsed', () => {
    const node = makeThrottle();
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();

    node.triggered(engine, 'flow', finished);

    // nothing fires immediately
    expect(commitToNewFiber).not.toHaveBeenCalled();

    // default duration is 1 second
    vi.advanceTimersByTime(1000);

    expect(commitToNewFiber).toHaveBeenCalledTimes(1);
    expect(commitToNewFiber).toHaveBeenCalledWith(
      node,
      'flow',
      undefined,
      undefined
    );
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('ignores repeat triggers while a timeout is already pending', () => {
    const node = makeThrottle();
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();

    node.triggered(engine, 'flow', finished);
    node.triggered(engine, 'flow', finished);
    node.triggered(engine, 'flow', finished);

    vi.advanceTimersByTime(1000);

    // only the first trigger's timeout fires
    expect(commitToNewFiber).toHaveBeenCalledTimes(1);
    expect(finished).toHaveBeenCalledTimes(3);
  });

  it('does not commit when cancelled before the duration elapses', () => {
    const node = makeThrottle();
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();

    node.triggered(engine, 'flow', finished);
    node.triggered(engine, 'cancel', finished);
    expect(finished).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1000);

    expect(commitToNewFiber).not.toHaveBeenCalled();
  });

  it('settles a pending invocation during disposal and clears its timer', () => {
    const node = makeThrottle();
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();
    node.triggered(engine, 'flow', finished);
    node.dispose();
    expect(finished).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(commitToNewFiber).not.toHaveBeenCalled();
    expect(finished).toHaveBeenCalledTimes(1);
  });

  it('can throttle again after the previous timeout completed', () => {
    const node = makeThrottle();
    const { engine, commitToNewFiber } = makeEngineSpy();
    const finished = vi.fn();

    node.triggered(engine, 'flow', finished);
    vi.advanceTimersByTime(1000);
    expect(commitToNewFiber).toHaveBeenCalledTimes(1);

    node.triggered(engine, 'flow', finished);
    vi.advanceTimersByTime(1000);
    expect(commitToNewFiber).toHaveBeenCalledTimes(2);
  });
});
