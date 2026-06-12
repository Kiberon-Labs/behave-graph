import { describe, expect, it, vi } from 'vitest';
import { makeGraphApi } from '@/Graphs/Graph.js';
import type { Fiber } from '@/engine/Fiber.js';
import type { Dependencies } from '@/types/registry.js';
import { WaitAll } from '@/Profiles/Core/Flow/WaitAll.js';

const makeWaitAll = (numInputs = 3) => {
  const graph = makeGraphApi({
    dependencies: {} as unknown as Dependencies,
    values: {}
  });
  return new WaitAll(WaitAll.Description, graph, numInputs, {}, 'waitAll-1');
};

const makeFiberSpy = () => {
  const commit = vi.fn();
  return { fiber: { commit } as unknown as Fiber, commit };
};

describe('WaitAll', () => {
  it('commits to flow only once all inputs have been triggered', () => {
    const node = makeWaitAll(3);
    const { fiber, commit } = makeFiberSpy();

    node.triggered(fiber, '1');
    expect(commit).not.toHaveBeenCalled();

    node.triggered(fiber, '2');
    expect(commit).not.toHaveBeenCalled();

    node.triggered(fiber, '3');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(node, 'flow');
  });

  it('counts each distinct input only once', () => {
    const node = makeWaitAll(3);
    const { fiber, commit } = makeFiberSpy();

    node.triggered(fiber, '1');
    node.triggered(fiber, '1'); // duplicate, should be ignored
    node.triggered(fiber, '2');
    expect(commit).not.toHaveBeenCalled();

    node.triggered(fiber, '3');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire when an input is triggered after completion', () => {
    const node = makeWaitAll(2);
    const { fiber, commit } = makeFiberSpy();

    node.triggered(fiber, '1');
    node.triggered(fiber, '2');
    expect(commit).toHaveBeenCalledTimes(1);

    node.triggered(fiber, '1');
    node.triggered(fiber, '2');
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('starts over after a reset', () => {
    const node = makeWaitAll(2);
    const { fiber, commit } = makeFiberSpy();

    node.triggered(fiber, '1');
    node.triggered(fiber, 'reset');

    // after reset, a single input is no longer enough
    node.triggered(fiber, '2');
    expect(commit).not.toHaveBeenCalled();

    node.triggered(fiber, '1');
    expect(commit).toHaveBeenCalledTimes(1);
  });
});
