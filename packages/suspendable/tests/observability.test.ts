import { expect, it } from 'vitest';
import {
  makeFlowNodeDefinition,
  type ExecutionObservation,
  type GraphJSON
} from '@kiberon-labs/behave-graph';
import { makeTestEngine } from './testUtils';
import { WaitForSignal } from './fixtures/testNodes';

it('preserves flow causality across serialized suspension and a fresh engine', async () => {
  const firstRecords: ExecutionObservation[] = [];
  const secondRecords: ExecutionObservation[] = [];
  const step = makeFlowNodeDefinition({
    typeName: 'test/step',
    in: { flow: 'flow' },
    out: { flow: 'flow' },
    initialState: {},
    triggered: ({ commit }) => commit('flow')
  });
  const graph: GraphJSON = {
    nodes: [
      {
        id: 'start',
        type: 'lifecycle/onStart',
        flows: { flow: { nodeId: 'first', socket: 'flow' } }
      },
      {
        id: 'first',
        type: 'test/step',
        flows: { flow: { nodeId: 'second', socket: 'flow' } }
      },
      { id: 'second', type: 'test/step' }
    ]
  };
  const first = makeTestEngine(
    graph,
    { [step.typeName]: step },
    {
      executionId: 'first-run',
      observer: (record) => firstRecords.push(record)
    }
  );
  await first.engine.initialize();
  first.start();
  await first.engine.executeAllSync(100, 1);
  const snapshot = JSON.parse(JSON.stringify(first.engine.suspend()));
  const firstInvocation = firstRecords.find(
    (record) => record.kind === 'started' && record.context.nodeId === 'first'
  );
  await first.engine.disposeAsync();
  const second = makeTestEngine(
    graph,
    { [step.typeName]: step },
    {
      executionId: 'second-run',
      observer: (record) => secondRecords.push(record)
    }
  );
  second.engine.unsuspend(snapshot, undefined);
  await second.engine.executeWithOutcome();
  const continuation = secondRecords.find(
    (record) => record.kind === 'started' && record.context.nodeId === 'second'
  );
  expect(continuation?.context).toMatchObject({
    executionId: 'second-run',
    parentExecutionId: 'first-run',
    parentInvocationId: firstInvocation?.context.invocationId
  });
});

it('records resumed async work as a continuation linked to its original invocation', async () => {
  const records: ExecutionObservation[] = [];
  const graph: GraphJSON = {
    nodes: [
      {
        id: 'start',
        type: 'lifecycle/onStart',
        flows: { flow: { nodeId: 'wait', socket: 'flow' } }
      },
      { id: 'wait', type: 'test/waitForSignal' }
    ]
  };
  const nodes = {
    [WaitForSignal.Description.typeName]: WaitForSignal.Description
  };
  const first = makeTestEngine(graph, nodes, {
    executionId: 'first-run',
    observer: (record) => records.push(record)
  });
  await first.engine.initialize();
  first.start();
  void first.engine.executeAllSync();
  await (first.graph.nodes.wait as WaitForSignal).parked;
  const parked = records.find(
    (record) => record.kind === 'started' && record.context.nodeId === 'wait'
  );
  const snapshot = JSON.parse(JSON.stringify(first.engine.suspend()));
  await first.engine.disposeAsync();
  const second = makeTestEngine(graph, nodes, {
    executionId: 'second-run',
    observer: (record) => records.push(record)
  });
  await second.engine.initialize();
  second.engine.unsuspend(snapshot, 42);
  await second.engine.executeWithOutcome();
  const resumed = records.find(
    (record) =>
      record.kind === 'started' &&
      record.context.nodeId === 'wait' &&
      record.context.executionId === 'second-run'
  );
  expect(resumed?.context).toMatchObject({
    phase: 'continuation',
    parentExecutionId: 'first-run',
    parentInvocationId: parked?.context.invocationId
  });
  expect(
    records.filter(
      (record) =>
        record.kind === 'finished' &&
        record.context.invocationId === resumed?.context.invocationId
    )
  ).toMatchObject([{ outcome: 'completed' }]);
});
