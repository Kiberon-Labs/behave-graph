import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import { setupCallSubgraphSync } from '../src/generators/callSubgraphSync.js';

const buildSystem = () => {
  const registry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {} as any
  });
  const specs = writeNodeSpecsToJSON(registry);
  return new System({ values: registry.values, specs });
};

const outputBoundary = (
  id: string,
  params: Array<{ id?: string; name: string; valueTypeName: string }>
): Node => ({
  id,
  type: 'behaveNode',
  position: { x: 0, y: 0 },
  data: {
    type: 'graph/output',
    configuration: { parameters: params },
    ports: {}
  }
});

const callNode = (id: string, subgraphId: string): Node => ({
  id,
  type: 'behaveNode',
  position: { x: 0, y: 0 },
  data: { type: 'flow/callSubgraph', configuration: { subgraphId }, ports: {} }
});

const getNode = (session: { nodeStore: any }, id: string): Node =>
  session.nodeStore.getState().nodes.find((n: Node) => n.id === id);

describe('call subgraph contract sync', () => {
  it('updates a call node when the referenced subgraph contract changes after creation', () => {
    const system = buildSystem();
    const caller = system.createSession('caller');
    const dispose = setupCallSubgraphSync(system);

    // `sub` is created AFTER the sync is registered , exercises the session
    // extension applying to future graphs, not just existing ones.
    const sub = system.createSession('sub');

    // A call node referencing `sub`, created while `sub` has no outputs yet.
    caller.nodeStore.getState().setNodes(() => [callNode('call1', sub.id)]);
    expect(getNode(caller, 'call1').data.configuration.outputs ?? []).toEqual(
      []
    );

    // Now author the subgraph's output contract.
    sub.nodeStore
      .getState()
      .setNodes(() => [
        outputBoundary('out', [
          { id: 'o1', name: 'result', valueTypeName: 'float' }
        ])
      ]);

    // The call node should have picked up the new contract reactively , no
    // re-selection required.
    const synced = getNode(caller, 'call1');
    expect(synced.data.configuration.outputs).toEqual([
      { id: 'o1', name: 'result', valueTypeName: 'float' }
    ]);
    expect(synced.data.dynamicPorts.outputs).toEqual([
      { name: 'o1', key: 'o1', label: 'result', valueType: 'float' }
    ]);

    // Rename the param: the call node tracks the change (stable id, new label).
    sub.nodeStore
      .getState()
      .setNodes(() => [
        outputBoundary('out', [
          { id: 'o1', name: 'renamed', valueTypeName: 'float' }
        ])
      ]);
    expect(getNode(caller, 'call1').data.configuration.outputs).toEqual([
      { id: 'o1', name: 'renamed', valueTypeName: 'float' }
    ]);

    dispose();
  });

  it('does not rewrite call nodes on non-contract edits (e.g. dragging)', () => {
    const system = buildSystem();
    const caller = system.createSession('caller');
    const sub = system.createSession('sub');
    const dispose = setupCallSubgraphSync(system);

    sub.nodeStore
      .getState()
      .setNodes(() => [
        outputBoundary('out', [
          { id: 'o1', name: 'result', valueTypeName: 'float' }
        ])
      ]);
    caller.nodeStore.getState().setNodes(() => [callNode('call1', sub.id)]);

    const before = getNode(caller, 'call1');
    // A position-only change to the subgraph must not churn the call node.
    sub.nodeStore
      .getState()
      .setNodes((prev: Node[]) =>
        prev.map((n) =>
          n.id === 'out' ? { ...n, position: { x: 50, y: 50 } } : n
        )
      );
    const after = getNode(caller, 'call1');

    // Same object identity ⇒ the call node was not rewritten.
    expect(after).toBe(before);

    dispose();
  });

  it('stops syncing after dispose', () => {
    const system = buildSystem();
    const caller = system.createSession('caller');
    const sub = system.createSession('sub');
    const dispose = setupCallSubgraphSync(system);

    caller.nodeStore.getState().setNodes(() => [callNode('call1', sub.id)]);
    dispose();

    sub.nodeStore
      .getState()
      .setNodes(() => [
        outputBoundary('out', [
          { id: 'o1', name: 'result', valueTypeName: 'float' }
        ])
      ]);

    // No sync after dispose ⇒ contract not propagated.
    expect(getNode(caller, 'call1').data.configuration.outputs ?? []).toEqual(
      []
    );
  });
});
