import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { System } from '../src/system/system.js';
import type { GraphSession } from '../src/system/graphSession.js';
import {
  autosavePlugin,
  BackupStorage,
  AUTOSAVE_ENABLED,
  AUTOSAVE_INTERVAL_SECONDS,
  AUTOSAVE_MAX_COPIES
} from '../src/plugin/autosave/index.js';
import type { BackupController } from '../src/plugin/autosave/index.js';

/** In-memory get/set storage so backups never touch real localStorage. */
const makeStorage = () => {
  const backing: Record<string, string> = {};
  return {
    backing,
    adapter: {
      getItem: (k: string) => backing[k] ?? null,
      setItem: (k: string, v: string) => {
        backing[k] = v;
      }
    }
  };
};

const NODE = (id: string, x = 0, y = 0) => ({
  id,
  type: 'behaveNode',
  position: { x, y },
  data: {
    type: 'lifecycle/onStart',
    configuration: {},
    ports: {},
    annotations: {}
  }
});

describe('autosave plugin', () => {
  let system: System;
  let session: GraphSession;
  let controller: BackupController;
  let storage: ReturnType<typeof makeStorage>;

  beforeEach(async () => {
    vi.useFakeTimers();

    const coreRegistry = registerCoreProfile({
      nodes: {},
      values: {},
      dependencies: {}
    });
    const registry = {
      values: coreRegistry.values,
      specs: writeNodeSpecsToJSON(coreRegistry)
    };

    storage = makeStorage();
    system = new System(registry);
    await system.registerPlugin(autosavePlugin, {
      storage: storage.adapter,
      addMenuItem: false
    });
    controller = system.backups as BackupController;
    session = system.createSession('graph');
  });

  afterEach(() => {
    controller.dispose();
    vi.useRealTimers();
  });

  const dirty = (nodes = [NODE('a')], edges: any[] = []) => {
    session.nodeStore.getState().setNodes(nodes);
    session.edgeStore.getState().setEdges(edges);
  };

  it('registers the autosave settings and seeds defaults', () => {
    const keys = system.settingsSchema.getState().settings.map((s) => s.key);
    expect(keys).toContain(AUTOSAVE_ENABLED);
    expect(keys).toContain(AUTOSAVE_INTERVAL_SECONDS);
    expect(keys).toContain(AUTOSAVE_MAX_COPIES);
    expect(system.getSetting(AUTOSAVE_ENABLED)).toBe(false);
  });

  it('installs the controller on the system', () => {
    expect(system.backups).toBeInstanceOf(Object);
    expect(typeof controller.backupNow).toBe('function');
  });

  it('captures a forced snapshot of the focused graph', () => {
    dirty([NODE('a'), NODE('b')]);
    const snap = controller.backupNow();
    expect(snap).not.toBeNull();
    expect(snap?.nodeCount).toBe(2);
    expect(controller.store.getState().snapshots).toHaveLength(1);
    // Persisted to storage.
    expect(new BackupStorage(storage.adapter).listAll()).toHaveLength(1);
  });

  it('does not capture an empty graph', () => {
    expect(controller.backupNow()).toBeNull();
    expect(controller.store.getState().snapshots).toHaveLength(0);
  });

  it('does not capture an inconsistent graph (edge to missing node)', () => {
    dirty(
      [NODE('a')],
      [
        {
          id: 'e',
          source: 'a',
          target: 'ghost',
          sourceHandle: 'f',
          targetHandle: 'f'
        }
      ]
    );
    expect(controller.backupNow()).toBeNull();
    expect(controller.store.getState().snapshots).toHaveLength(0);
  });

  it('skips a forced capture that duplicates the previous one', () => {
    dirty([NODE('a')]);
    expect(controller.backupNow()).not.toBeNull();
    // No change since the last capture: identical, so skipped.
    expect(controller.backupNow()).toBeNull();
    expect(controller.store.getState().snapshots).toHaveLength(1);
  });

  it('does not capture while suspended', () => {
    dirty([NODE('a')]);
    controller.suspend();
    expect(controller.backupNow()).toBeNull();
    controller.resume();
    expect(controller.backupNow()).not.toBeNull();
  });

  it('runExclusive brackets a region with no capture', () => {
    dirty([NODE('a')]);
    const inside = controller.runExclusive(() => controller.backupNow());
    expect(inside).toBeNull();
    expect(controller.store.getState().snapshots).toHaveLength(0);
  });

  it('trims each graph to the max-copies ring', () => {
    system.setSetting(AUTOSAVE_MAX_COPIES, 3);
    for (let i = 0; i < 5; i++) {
      dirty([NODE('a', i, 0)]); // move node so each snapshot differs
      controller.backupNow();
    }
    expect(controller.store.getState().snapshots).toHaveLength(3);
  });

  it('restores a snapshot into a new tab without touching the source graph', () => {
    dirty([NODE('a'), NODE('b')]);
    const snap = controller.backupNow()!;
    const sessionsBefore = Object.keys(
      system.activeGraph.getState().sessions
    ).length;

    const restored = controller.restore(snap.id);
    expect(restored).toBeDefined();
    expect(restored!.id).not.toBe(session.id);
    expect(restored!.nodeStore.getState().nodes).toHaveLength(2);
    expect(Object.keys(system.activeGraph.getState().sessions).length).toBe(
      sessionsBefore + 1
    );
    // Source graph untouched.
    expect(session.nodeStore.getState().nodes).toHaveLength(2);
  });

  it('runs the timer only while enabled and captures dirty, settled graphs', () => {
    system.setSetting(AUTOSAVE_INTERVAL_SECONDS, 5);
    system.setSetting(AUTOSAVE_ENABLED, true);
    expect(controller.store.getState().running).toBe(true);

    dirty([NODE('a')]);
    // Advance past the interval AND the quiescence window.
    vi.advanceTimersByTime(6000);
    expect(controller.store.getState().snapshots).toHaveLength(1);

    system.setSetting(AUTOSAVE_ENABLED, false);
    expect(controller.store.getState().running).toBe(false);
  });

  it('deletes a single snapshot and clears all', () => {
    dirty([NODE('a')]);
    const snap = controller.backupNow()!;
    dirty([NODE('a'), NODE('b')]);
    controller.backupNow();
    expect(controller.store.getState().snapshots).toHaveLength(2);

    controller.deleteSnapshot(snap.id);
    expect(controller.store.getState().snapshots).toHaveLength(1);

    controller.clearAll();
    expect(controller.store.getState().snapshots).toHaveLength(0);
  });
});
