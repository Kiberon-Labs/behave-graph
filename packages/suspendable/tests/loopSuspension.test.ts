import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { describe, expect, it } from 'vitest';
import {
  makeRecorderDescription,
  SuspendableForLoop
} from './fixtures/testNodes';
import { makeTestEngine } from './testUtils';

/** Marker the completion recorder reports when the loop's `completed` fires. */
const COMPLETED = 999;

/**
 * onStart -> suspendable for-loop [0, 5).
 * Loop body reports each index via `test/recorder`; the `completed` output
 * reports the COMPLETED marker.
 */
const loopGraph: GraphJSON = {
  variables: [],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'flow/suspendableForLoop',
      id: '1',
      parameters: {
        startIndex: { value: 0 },
        endIndex: { value: 5 }
      },
      flows: {
        loopBody: { nodeId: '2', socket: 'flow' },
        completed: { nodeId: '3', socket: 'flow' }
      }
    },
    {
      type: 'test/recorder',
      id: '2',
      parameters: {
        index: { link: { nodeId: '1', socket: 'index' } }
      }
    },
    {
      type: 'test/recorder',
      id: '3',
      parameters: {
        index: { value: COMPLETED }
      }
    }
  ]
};

const makeLoopEngine = (record: (index: number) => void) =>
  makeTestEngine(loopGraph, {
    [SuspendableForLoop.Description.typeName]: SuspendableForLoop.Description,
    'test/recorder': makeRecorderDescription(record)
  });

describe('suspending mid-loop', () => {
  it('runs the loop to completion when never suspended', async () => {
    const recorded: number[] = [];
    const { engine, start } = makeLoopEngine((i) => recorded.push(i));

    start();
    await engine.executeAllSync();

    expect(recorded).toEqual([0, 1, 2, 3, 4, COMPLETED]);
  });

  it('completes only the remaining iterations after unsuspending, instead of restarting', async () => {
    // --- first engine: run the loop partway, then suspend -----------------
    const firstRun: number[] = [];
    const { engine, start } = makeLoopEngine((i) => firstRun.push(i));

    start();
    // Step budget chosen to stop execution mid-loop: the loop trigger plus the
    // first three body executions consume the budget, leaving iterations 3 and
    // 4 (and the completion) outstanding on the fiber.
    await engine.executeAllSync(100, 4);
    expect(firstRun).toEqual([0, 1, 2]);
    expect(engine.hasPending()).toBe(true);

    const suspension = engine.suspend();

    // the loop's cursor must be captured in the suspension...
    expect(suspension.nodes['1']).toEqual({ nextIndex: 3 });
    // ...along with the pending fiber pointing back at the loop node
    expect(suspension.fiberQueue).toHaveLength(1);
    expect(suspension.fiberQueue[0]!.queue).toEqual(['1']);

    // serialization must survive a stringify round-trip (e.g. disk persistence)
    const persisted = JSON.parse(JSON.stringify(suspension));

    // --- second engine: rehydrate on a fresh graph and finish -------------
    const secondRun: number[] = [];
    const { engine: resumed } = makeLoopEngine((i) => secondRun.push(i));

    resumed.unsuspend(persisted, undefined);
    await resumed.executeAllSync();

    // only the remaining iterations execute , the loop does not restart at 0
    expect(secondRun).toEqual([3, 4, COMPLETED]);

    // and across both runs every iteration executed exactly once
    expect([...firstRun, ...secondRun.slice(0, -1)]).toEqual([0, 1, 2, 3, 4]);
  });

  it('can immediately re-suspend after resuming', async () => {
    const firstRun: number[] = [];
    const first = makeLoopEngine((i) => firstRun.push(i));
    first.start();
    await first.engine.executeAllSync(100, 2);
    expect(firstRun).toEqual([0]);

    const suspension = first.engine.suspend();
    expect(suspension.nodes['1']).toEqual({ nextIndex: 1 });

    // resume, run one more iteration, suspend again
    const secondRun: number[] = [];
    const second = makeLoopEngine((i) => secondRun.push(i));
    second.engine.unsuspend(suspension, undefined);
    await second.engine.executeAllSync(100, 2);
    expect(secondRun).toEqual([1]);

    const secondSuspension = second.engine.suspend();
    expect(secondSuspension.nodes['1']).toEqual({ nextIndex: 2 });

    // final resume runs the loop to the end
    const thirdRun: number[] = [];
    const third = makeLoopEngine((i) => thirdRun.push(i));
    third.engine.unsuspend(secondSuspension, undefined);
    await third.engine.executeAllSync();
    expect(thirdRun).toEqual([2, 3, 4, COMPLETED]);
  });
});
