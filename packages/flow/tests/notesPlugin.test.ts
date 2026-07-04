import { describe, it, expect, beforeEach } from 'vitest';
import { System } from '../src/system/system.js';
import type { GraphSession } from '../src/system/graphSession.js';
import {
  notesPlugin,
  NOTE_NODE_TYPE,
  LEGACY_COMMENT_NODE_TYPE
} from '../src/plugin/notes/index.js';

describe('notes plugin', () => {
  let system: System;
  let session: GraphSession;

  const addNote = (position = { x: 10, y: 20 }) =>
    system.commandStore.getState().run('notes.addNote', {
      editor: system,
      session,
      position
    });

  const nodes = () => session.nodeStore.getState().nodes;

  beforeEach(async () => {
    system = new System();
    await system.registerPlugin(notesPlugin);
    session = system.createSession('graph');
  });

  it('does not register note node types without the plugin', () => {
    const bare = new System();
    const bareSession = bare.createSession('graph');
    expect(bareSession.flowStore.getState().nodeTypes[NOTE_NODE_TYPE]).toBe(
      undefined
    );
  });

  it('registers the note component (and legacy alias) on new sessions', () => {
    const { nodeTypes } = session.flowStore.getState();
    expect(nodeTypes[NOTE_NODE_TYPE]).toBeDefined();
    expect(nodeTypes[LEGACY_COMMENT_NODE_TYPE]).toBe(nodeTypes[NOTE_NODE_TYPE]);
  });

  it('adds a toolbar group with the Add Note button', () => {
    const group = system.toolbarStore
      .getState()
      .groups.find((g) => g.id === 'notes');
    expect(group).toBeDefined();
    expect(group?.buttons).toHaveLength(1);
  });

  it('notes.addNote creates a selected, header-draggable note (undoable)', () => {
    void addNote();

    expect(nodes()).toHaveLength(1);
    const note = nodes()[0];
    expect(note?.type).toBe(NOTE_NODE_TYPE);
    expect(note?.position).toEqual({ x: 10, y: 20 });
    expect(note?.selected).toBe(true);
    expect(note?.dragHandle).toBe('.notes-node__header');
    expect(note?.data).toEqual({ text: '' });

    session.undoManager.undo();
    expect(nodes()).toHaveLength(0);
    session.undoManager.redo();
    expect(nodes()).toHaveLength(1);
  });

  it('note nodes are ignored by the behave graph transform', () => {
    void addNote();
    const graph = session.flowStore.getState().getGraph();
    expect(graph.nodes ?? []).toHaveLength(0);
  });

  it('note.duplicate clones the note with an offset', () => {
    void addNote();
    const original = nodes()[0]!;

    void system.commandStore.getState().run('note.duplicate', {
      editor: system,
      session,
      nodeId: original.id
    });

    expect(nodes()).toHaveLength(2);
    const copy = nodes()[1]!;
    expect(copy.id).not.toBe(original.id);
    expect(copy.position).toEqual({
      x: original.position.x + 24,
      y: original.position.y + 24
    });

    session.undoManager.undo();
    expect(nodes()).toHaveLength(1);
  });

  it('note.delete removes the note and undo restores it', () => {
    void addNote();
    const note = nodes()[0]!;

    void system.commandStore.getState().run('note.delete', {
      editor: system,
      session,
      nodeId: note.id
    });
    expect(nodes()).toHaveLength(0);

    session.undoManager.undo();
    expect(nodes()).toHaveLength(1);
    expect(nodes()[0]?.id).toBe(note.id);
  });

  it('bring to front / send to back reorder within the nodes array', () => {
    void addNote({ x: 0, y: 0 });
    void addNote({ x: 5, y: 5 });
    const [first, second] = nodes();

    void system.commandStore.getState().run('note.bringToFront', {
      editor: system,
      session,
      nodeId: first!.id
    });
    expect(nodes().map((n) => n.id)).toEqual([second!.id, first!.id]);

    void system.commandStore.getState().run('note.sendToBack', {
      editor: system,
      session,
      nodeId: first!.id
    });
    expect(nodes().map((n) => n.id)).toEqual([first!.id, second!.id]);
  });

  it('behave-only context menu items are hidden on notes, note items shown', () => {
    void addNote();
    const note = nodes()[0]!;
    const ctx = { editor: system, session, nodeId: note.id };

    const visible = system.contextMenuStore
      .getState()
      .getItems('node')
      .filter((i) => !i.when || i.when(ctx))
      .map((i) => i.id);

    expect(visible).toContain('note.duplicate');
    expect(visible).toContain('note.delete');
    expect(visible).not.toContain('node.traceUpstream');
    expect(visible).not.toContain('node.togglePinned');
  });

  it('note commands no-op for behave nodes', () => {
    session.actionStore
      .getState()
      .actions.addBehaveNode('debug/log', { x: 0, y: 0 });
    const behave = nodes()[0]!;

    void system.commandStore.getState().run('note.delete', {
      editor: system,
      session,
      nodeId: behave.id
    });
    expect(nodes()).toHaveLength(1);
  });
});
