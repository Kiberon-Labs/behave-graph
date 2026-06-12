import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { describe, expect, it } from 'vitest';
import { makeRecorderDescription } from './fixtures/testNodes';
import { makeTestEngine } from './testUtils';

/**
 * Core flow nodes keep their cursors in node state (not closures), so the
 * engine can capture them generically — no ISuspendable implementation needed.
 * These tests run the unmodified core `flow/forLoop` and `flow/sequence`
 * through a mid-execution suspension round-trip.
 */

const COMPLETED = 999;

const forLoopGraph: GraphJSON = {
  variables: [],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'flow/forLoop',
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
      parameters: { index: { link: { nodeId: '1', socket: 'index' } } }
    },
    {
      type: 'test/recorder',
      id: '3',
      parameters: { index: { value: COMPLETED } }
    }
  ]
};

/** flow/sequence with three outputs, each reporting a distinct marker. */
const sequenceGraph: GraphJSON = {
  variables: [],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'flow/sequence',
      id: '1',
      configuration: { numOutputs: 3 },
      flows: {
        1: { nodeId: '2', socket: 'flow' },
        2: { nodeId: '3', socket: 'flow' },
        3: { nodeId: '4', socket: 'flow' }
      }
    },
    {
      type: 'test/recorder',
      id: '2',
      parameters: { index: { value: 1 } }
    },
    {
      type: 'test/recorder',
      id: '3',
      parameters: { index: { value: 2 } }
    },
    {
      type: 'test/recorder',
      id: '4',
      parameters: { index: { value: 3 } }
    }
  ]
};

const makeEngineWithRecorder = (
  graph: GraphJSON,
  record: (index: number) => void
) =>
  makeTestEngine(graph, { 'test/recorder': makeRecorderDescription(record) });

describe('core flow/forLoop across suspension', () => {
  it('resumes the remaining iterations instead of restarting', async () => {
    const firstRun: number[] = [];
    const first = makeEngineWithRecorder(forLoopGraph, (i) => firstRun.push(i));

    first.start();
    await first.engine.executeAllSync(100, 4);
    expect(firstRun).toEqual([0, 1, 2]);

    const suspension = first.engine.suspend();
    // the loop cursor is captured from node state, generically
    expect(suspension.nodes['1']).toEqual({ nextIndex: 3 });

    const persisted = JSON.parse(JSON.stringify(suspension));

    const secondRun: number[] = [];
    const second = makeEngineWithRecorder(forLoopGraph, (i) =>
      secondRun.push(i)
    );
    second.engine.unsuspend(persisted, undefined);
    await second.engine.executeAllSync();

    expect(secondRun).toEqual([3, 4, COMPLETED]);
  });
});

describe('core flow/sequence across suspension', () => {
  it('fires only the remaining outputs instead of restarting', async () => {
    const firstRun: number[] = [];
    const first = makeEngineWithRecorder(sequenceGraph, (i) =>
      firstRun.push(i)
    );

    first.start();
    // budget: sequence trigger + first output's recorder
    await first.engine.executeAllSync(100, 2);
    expect(firstRun).toEqual([1]);

    const suspension = first.engine.suspend();
    expect(suspension.nodes['1']).toEqual({ nextIndex: 1 });

    const secondRun: number[] = [];
    const second = makeEngineWithRecorder(sequenceGraph, (i) =>
      secondRun.push(i)
    );
    second.engine.unsuspend(JSON.parse(JSON.stringify(suspension)), undefined);
    await second.engine.executeAllSync();

    expect(secondRun).toEqual([2, 3]);
  });
});
