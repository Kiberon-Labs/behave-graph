import { describe, it, expect } from 'vitest';
import type { Node } from 'reactflow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import {
  commandStoreFactory,
  type CommandContext
} from '../src/store/commands.js';
import {
  contextMenuStoreFactory,
  type ContextMenuItem
} from '../src/store/contextMenu.js';

const buildSystem = () => {
  const reg = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {} as any
  });
  return new System({ values: reg.values, specs: writeNodeSpecsToJSON(reg) });
};

const node = (id: string): Node => ({
  id,
  type: 'behaveNode',
  position: { x: 0, y: 0 },
  data: { type: 'debug/log', configuration: {}, ports: {} } as any
});

// The command/context-menu registries are framework-free; a stub context is fine.
const ctx = {} as CommandContext;

describe('command registry', () => {
  it('registers, runs, and unregisters by id', () => {
    const store = commandStoreFactory().getState();
    let ran = 0;
    const off = store.register({ id: 'x.do', run: () => void ran++ });

    expect(store.get('x.do')?.id).toBe('x.do');
    store.run('x.do', ctx);
    expect(ran).toBe(1);

    off();
    expect(store.get('x.do')).toBeUndefined();
    store.run('x.do', ctx); // no-op, no throw
    expect(ran).toBe(1);
  });

  it('register replaces an existing id (idempotent override)', () => {
    const store = commandStoreFactory().getState();
    store.register({ id: 'x', run: () => {} });
    store.register({ id: 'x', title: 'Second', run: () => {} });
    expect(store.list()).toHaveLength(1);
    expect(store.get('x')?.title).toBe('Second');
  });

  it('skips a disabled command', () => {
    const store = commandStoreFactory().getState();
    let ran = false;
    store.register({
      id: 'x',
      isEnabled: () => false,
      run: () => {
        ran = true;
      }
    });
    store.run('x', ctx);
    expect(ran).toBe(false);
  });
});

describe('context-menu registry', () => {
  const item = (over: Partial<ContextMenuItem>): ContextMenuItem => ({
    id: 'i',
    target: 'node',
    label: 'L',
    ...over
  });

  it('returns items for a target sorted by order', () => {
    const store = contextMenuStoreFactory().getState();
    store.register(item({ id: 'b', order: 20 }));
    store.register(item({ id: 'a', order: 10 }));
    store.register(item({ id: 'e', target: 'edge', order: 5 }));

    const nodeIds = store.getItems('node').map((i) => i.id);
    expect(nodeIds).toEqual(['a', 'b']); // edge item excluded, sorted
  });

  it('register replaces by id; unregister removes', () => {
    const store = contextMenuStoreFactory().getState();
    store.register(item({ id: 'a', label: 'One' }));
    store.register(item({ id: 'a', label: 'Two' }));
    expect(store.getItems('node')).toHaveLength(1);
    expect(store.getItems('node')[0]!.label).toBe('Two');

    store.unregister('a');
    expect(store.getItems('node')).toHaveLength(0);
  });
});

describe('System.runCommand (hotkeys/menubar dispatch path)', () => {
  it('dispatches a default command against the focused session', () => {
    const system = buildSystem();
    const session = system.createSession('g'); // activates by default
    session.nodeStore.getState().setNodes(() => [node('n1'), node('n2')]);

    system.runCommand('selection.selectAll');

    expect(session.nodeStore.getState().nodes.every((n) => n.selected)).toBe(
      true
    );
  });

  it('no-ops when there is no focused graph', () => {
    const system = buildSystem();
    expect(() => system.runCommand('selection.selectAll')).not.toThrow();
  });

  it('threads target context (e.g. nodeId) into the command', () => {
    const system = buildSystem();
    system.createSession('g');
    let captured: string | undefined;
    system.commandStore.getState().register({
      id: 'probe',
      run: (ctx) => {
        captured = ctx.nodeId;
      }
    });

    system.runCommand('probe', { nodeId: 'abc' });
    expect(captured).toBe('abc');
  });
});
