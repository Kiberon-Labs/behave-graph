import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { describe, expect, it } from 'vitest';
import { makeRecorderDescription } from './fixtures/testNodes';
import { makeTestEngine } from './testUtils';

const COMPLETED = 999;

/**
 * onStart -> outer forLoop [0,3) -> inner forLoop [0,3) -> recorder.
 * The recorder receives outer*10 + inner via math nodes, so each recorded
 * value identifies exactly which (outer, inner) iteration ran.
 */
const nestedLoopGraph: GraphJSON = {
  variables: [],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: 'outer', socket: 'flow' } }
    },
    {
      type: 'flow/forLoop',
      id: 'outer',
      parameters: {
        startIndex: { value: 0 },
        endIndex: { value: 3 }
      },
      flows: {
        loopBody: { nodeId: 'inner', socket: 'flow' },
        completed: { nodeId: 'done', socket: 'flow' }
      }
    },
    {
      type: 'flow/forLoop',
      id: 'inner',
      parameters: {
        startIndex: { value: 0 },
        endIndex: { value: 3 }
      },
      flows: {
        loopBody: { nodeId: 'rec', socket: 'flow' }
      }
    },
    {
      type: 'math/multiply/integer',
      id: 'mul',
      parameters: {
        a: { link: { nodeId: 'outer', socket: 'index' } },
        b: { value: 10 }
      }
    },
    {
      type: 'math/add/integer',
      id: 'add',
      parameters: {
        a: { link: { nodeId: 'mul', socket: 'result' } },
        b: { link: { nodeId: 'inner', socket: 'index' } }
      }
    },
    {
      type: 'test/recorder',
      id: 'rec',
      parameters: { index: { link: { nodeId: 'add', socket: 'result' } } }
    },
    {
      type: 'test/recorder',
      id: 'done',
      parameters: { index: { value: COMPLETED } }
    }
  ]
};

const ALL_ITERATIONS = [0, 1, 2, 10, 11, 12, 20, 21, 22];

const makeNestedEngine = (record: (index: number) => void) =>
  makeTestEngine(nestedLoopGraph, {
    'test/recorder': makeRecorderDescription(record)
  });

describe('nested loops across suspension', () => {
  it('runs all inner iterations for every outer iteration when not suspended', async () => {
    const recorded: number[] = [];
    const { engine, start } = makeNestedEngine((i) => recorded.push(i));

    start();
    await engine.executeAllSync();

    expect(recorded).toEqual([...ALL_ITERATIONS, COMPLETED]);
  });

  it('resumes mid-inner-loop: finishes the inner loop, then the remaining outer iterations', async () => {
    const firstRun: number[] = [];
    const first = makeNestedEngine((i) => firstRun.push(i));

    first.start();
    // run until partway through the inner loop of outer iteration 1
    let steps = 0;
    while (firstRun.length < 5 && first.engine.hasPending() && steps < 100) {
      await first.engine.executeAllSync(100, 1);
      steps++;
    }
    expect(firstRun).toEqual([0, 1, 2, 10, 11]);

    const suspension = first.engine.suspend();

    // both cursors captured independently: outer is mid-iteration 1 (next: 2),
    // inner has fired 10 and 11 (next: 2)
    expect(suspension.nodes['outer']).toEqual({ nextIndex: 2 });
    expect(suspension.nodes['inner']).toEqual({ nextIndex: 2 });

    const persisted = JSON.parse(JSON.stringify(suspension));

    const secondRun: number[] = [];
    const second = makeNestedEngine((i) => secondRun.push(i));
    second.engine.unsuspend(persisted, undefined);
    await second.engine.executeAllSync();

    // the inner loop finishes its remaining iteration (12) BEFORE the outer
    // loop advances — and neither loop restarts
    expect(secondRun).toEqual([12, 20, 21, 22, COMPLETED]);

    expect([...firstRun, ...secondRun.slice(0, -1)]).toEqual(ALL_ITERATIONS);
  });
});
