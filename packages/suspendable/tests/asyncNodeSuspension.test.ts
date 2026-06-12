import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { describe, expect, it } from 'vitest';
import { makeRecorderDescription, WaitForSignal } from './fixtures/testNodes';
import { makeTestEngine } from './testUtils';

const COMPLETED = 999;

/**
 * onStart -> forLoop [0,1) -> waitForSignal (async, parks the fiber) ->
 * recorder reading the delivered signal value. The orphan time/delay node is
 * present only to assert async nodes are excluded from generic state capture.
 */
const waitGraph: GraphJSON = {
  variables: [],
  customEvents: [],
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: 'loop', socket: 'flow' } }
    },
    {
      type: 'flow/forLoop',
      id: 'loop',
      parameters: {
        startIndex: { value: 0 },
        endIndex: { value: 1 }
      },
      flows: {
        loopBody: { nodeId: 'wait', socket: 'flow' },
        completed: { nodeId: 'done', socket: 'flow' }
      }
    },
    {
      type: 'test/waitForSignal',
      id: 'wait',
      flows: { flow: { nodeId: 'rec', socket: 'flow' } }
    },
    {
      type: 'test/recorder',
      id: 'rec',
      parameters: { index: { link: { nodeId: 'wait', socket: 'value' } } }
    },
    {
      type: 'test/recorder',
      id: 'done',
      parameters: { index: { value: COMPLETED } }
    },
    {
      type: 'time/delay',
      id: 'orphanDelay'
    }
  ]
};

const makeWaitEngine = (record: (index: number) => void) =>
  makeTestEngine(waitGraph, {
    'test/recorder': makeRecorderDescription(record),
    [WaitForSignal.Description.typeName]: WaitForSignal.Description
  });

describe('async node suspension (vs flow nodes)', () => {
  it('parks the fiber at the async node and resumes via unsuspend with continuance data', async () => {
    const firstRun: number[] = [];
    const first = makeWaitEngine((i) => firstRun.push(i));

    first.start();
    // do not await: the async node parks execution on a pending promise
    void first.engine.executeAllSync();
    const waitNode = first.graph.nodes['wait'] as WaitForSignal;
    await waitNode.parked;

    // nothing downstream of the wait has run
    expect(firstRun).toEqual([]);

    const suspension = first.engine.suspend();
    first.engine.dispose();

    // ASYNC nodes are captured through ISuspendable.suspend()...
    expect(suspension.nodes['wait']).toEqual({ waiting: true });
    // ...and the fiber records the async node as its resume point, unlike
    // flow-node suspensions which carry no current link
    expect(suspension.fiberQueue[0]!.curr).toEqual({
      nodeId: 'wait',
      socketName: 'flow'
    });
    // the enclosing loop's continuation is preserved alongside it
    expect(suspension.fiberQueue[0]!.queue).toEqual(['loop']);

    const persisted = JSON.parse(JSON.stringify(suspension));

    // resume on a fresh engine, delivering the awaited data as continuance
    const secondRun: number[] = [];
    const second = makeWaitEngine((i) => secondRun.push(i));
    second.engine.unsuspend(persisted, 42);
    await second.engine.executeAllSync();

    // the delivered data flows downstream of the wait node, then the
    // enclosing loop finishes without restarting
    expect(secondRun).toEqual([42, COMPLETED]);
  });

  it('excludes async and event node state from generic capture', async () => {
    const firstRun: number[] = [];
    const first = makeWaitEngine((i) => firstRun.push(i));

    first.start();
    void first.engine.executeAllSync();
    await (first.graph.nodes['wait'] as WaitForSignal).parked;

    const suspension = first.engine.suspend();
    first.engine.dispose();

    // flow nodes are captured generically from node state
    expect(suspension.nodes['loop']).toEqual({ nextIndex: 1 });

    // event nodes hold live listeners — never serialized
    expect(suspension.nodes['0']).toBeUndefined();

    // async nodes can hold timers, so they are only captured when they opt in
    // via ISuspendable. time/delay has node state but no suspend() — excluded.
    expect(suspension.nodes['orphanDelay']).toBeUndefined();
  });
});
