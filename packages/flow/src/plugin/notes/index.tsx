import { Notes } from 'iconoir-react';
import { v4 as uuidv4 } from 'uuid';
import { plugin } from '@/system/plugin';
import type { System } from '@/system/system';
import type { CommandContext } from '@/store/commands';
import type { INoteNode } from '@/types/nodes';
import { NoteNode } from './note';
import {
  NOTE_NODE_TYPE,
  LEGACY_COMMENT_NODE_TYPE,
  noteAt,
  duplicateNote,
  deleteNote,
  reorderNote
} from './nodeActions';

export { NoteNode } from './note';
export * from './nodeActions';

/**
 * Create a note node on the graph the command targets. Placed at the given
 * position (e.g. from a context menu) or, from surfaces without one (toolbar,
 * hotkey), at the centre of the current viewport. Undo-aware.
 */
const addNote = (ctx: CommandContext): void => {
  const reactflow = ctx.session.refStore.getState().getRef('reactflow');
  const position = ctx.position ??
    reactflow?.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2
    }) ?? { x: 0, y: 0 };

  const note: INoteNode = {
    id: uuidv4(),
    type: NOTE_NODE_TYPE,
    position,
    selected: true,
    // Only the header drags the node; the body is a text surface.
    dragHandle: '.notes-node__header',
    style: { width: 280, height: 180 },
    data: { text: '' }
  };

  ctx.session.undoManager.execute({
    name: 'Add note',
    execute: () => {
      ctx.session.nodeStore.getState().addNode(note);
    },
    undo: () => {
      ctx.session.nodeStore
        .getState()
        .setNodes((existing) => existing.filter((n) => n.id !== note.id));
    }
  });
};

/**
 * Adds markdown note nodes to the editor. Notes are purely presentational:
 * they never appear in the compiled behave graph (only behave nodes do), but
 * they persist with the UI graph JSON like any other canvas node.
 *
 * The note editor embeds tiptap/prosemirror, a heavy dependency most hosts do
 * not need, so notes live here rather than in the core editor — register this
 * plugin (directly or via the kitchen-sink plugin) to opt in.
 *
 * The plugin:
 * - registers the `noteNode` component on every graph session (plus the legacy
 *   `commentNode` alias for graphs saved before notes moved here);
 * - registers the `notes.addNote` command, an "Add Note" button on the
 *   floating toolbar, and a `Shift+N` hotkey that dispatch it;
 * - registers note-specific node commands + context-menu items
 *   (duplicate / delete / bring to front / send to back).
 */
export const notesPlugin = plugin(
  (system: System) => {
    system.registerSessionExtension((session) => {
      const { registerNodeType } = session.flowStore.getState();
      registerNodeType(NOTE_NODE_TYPE, NoteNode);
      registerNodeType(LEGACY_COMMENT_NODE_TYPE, NoteNode);
    });

    const commands = system.commandStore.getState();
    commands.register({
      id: 'notes.addNote',
      title: 'Add Note',
      run: addNote
    });
    commands.register({
      id: 'note.duplicate',
      title: 'Duplicate Note',
      run: (ctx) => {
        const note = noteAt(ctx);
        if (note) duplicateNote(ctx.session, note);
      }
    });
    commands.register({
      id: 'note.delete',
      title: 'Delete Note',
      run: (ctx) => {
        const note = noteAt(ctx);
        if (note) deleteNote(ctx.session, note);
      }
    });
    commands.register({
      id: 'note.bringToFront',
      title: 'Bring Note to Front',
      run: (ctx) => {
        const note = noteAt(ctx);
        if (note) reorderNote(ctx.session, note, 'front');
      }
    });
    commands.register({
      id: 'note.sendToBack',
      title: 'Send Note to Back',
      run: (ctx) => {
        const note = noteAt(ctx);
        if (note) reorderNote(ctx.session, note, 'back');
      }
    });

    // Notes get their own node context menu; the behave items (trace, pin,
    // ...) are guarded by `when` in the core defaults and stay hidden here.
    const menu = system.contextMenuStore.getState();
    const noteOnly = (ctx: CommandContext) => Boolean(noteAt(ctx));
    menu.register({
      id: 'note.duplicate',
      target: 'node',
      label: 'Duplicate',
      order: 10,
      group: 'note',
      when: noteOnly,
      commandId: 'note.duplicate'
    });
    menu.register({
      id: 'note.bringToFront',
      target: 'node',
      label: 'Bring to Front',
      order: 20,
      group: 'note-order',
      when: noteOnly,
      commandId: 'note.bringToFront'
    });
    menu.register({
      id: 'note.sendToBack',
      target: 'node',
      label: 'Send to Back',
      order: 21,
      group: 'note-order',
      when: noteOnly,
      commandId: 'note.sendToBack'
    });
    menu.register({
      id: 'note.delete',
      target: 'node',
      label: 'Delete',
      order: 30,
      group: 'note-danger',
      when: noteOnly,
      commandId: 'note.delete'
    });

    const dispatchAddNote = () => {
      const session = system.session;
      if (!session) return;
      void system.commandStore
        .getState()
        .run('notes.addNote', { editor: system, session });
    };

    system.toolbarStore.getState().addGroup({
      id: 'notes',
      label: 'Notes',
      buttons: [
        {
          id: 'notes.addNote',
          icon: <Notes />,
          label: 'Add Note',
          onClick: dispatchAddNote
        }
      ]
    });

    system.hotKeyStore.getState().register({
      action: 'ADD_NOTE',
      description: 'Add a markdown note to the graph',
      trigger: 'shift+n',
      handler: dispatchAddNote
    });
  },
  { name: 'notes' }
);
