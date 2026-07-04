import { v4 as uuidv4 } from 'uuid';
import type { Node } from 'reactflow';
import type { CommandContext } from '@/store/commands';
import type { GraphSession } from '@/system/graphSession';

/** Node type registered for notes created by this plugin. */
export const NOTE_NODE_TYPE = 'noteNode';

/**
 * Type string notes used while they lived in the core editor as "comment"
 * nodes. Registered as an alias so graphs saved before the move still render.
 */
export const LEGACY_COMMENT_NODE_TYPE = 'commentNode';

export const isNoteNode = (node: Node | undefined): node is Node =>
  node?.type === NOTE_NODE_TYPE || node?.type === LEGACY_COMMENT_NODE_TYPE;

export const noteAt = (ctx: CommandContext): Node | undefined => {
  const node = ctx.session.nodeStore
    .getState()
    .nodes.find((n) => n.id === ctx.nodeId);
  return isNoteNode(node) ? node : undefined;
};

export const duplicateNote = (session: GraphSession, note: Node): void => {
  const copy: Node = {
    ...note,
    id: uuidv4(),
    selected: false,
    position: { x: note.position.x + 24, y: note.position.y + 24 },
    data: { ...note.data }
  };
  session.undoManager.execute({
    name: 'Duplicate note',
    execute: () => {
      session.nodeStore.getState().addNode(copy);
    },
    undo: () => {
      session.nodeStore
        .getState()
        .setNodes((existing) => existing.filter((n) => n.id !== copy.id));
    }
  });
};

export const deleteNote = (session: GraphSession, note: Node): void => {
  const index = session.nodeStore
    .getState()
    .nodes.findIndex((n) => n.id === note.id);
  session.undoManager.execute({
    name: 'Delete note',
    execute: () => {
      session.nodeStore
        .getState()
        .setNodes((existing) => existing.filter((n) => n.id !== note.id));
    },
    undo: () => {
      session.nodeStore.getState().setNodes((existing) => {
        const next = [...existing];
        next.splice(Math.min(index, next.length), 0, note);
        return next;
      });
    }
  });
};

/**
 * Move a note within the nodes array: React Flow paints later nodes on top, so
 * array order is z-order.
 */
export const reorderNote = (
  session: GraphSession,
  note: Node,
  to: 'front' | 'back'
): void => {
  const from = session.nodeStore
    .getState()
    .nodes.findIndex((n) => n.id === note.id);
  if (from < 0) return;

  const move = (position: 'front' | 'back' | number) => {
    session.nodeStore.getState().setNodes((existing) => {
      const index = existing.findIndex((n) => n.id === note.id);
      if (index < 0) return existing;
      const next = [...existing];
      const [moved] = next.splice(index, 1);
      if (moved === undefined) return existing;
      if (position === 'front') next.push(moved);
      else if (position === 'back') next.unshift(moved);
      else next.splice(Math.min(position, next.length), 0, moved);
      return next;
    });
  };

  session.undoManager.execute({
    name: to === 'front' ? 'Bring note to front' : 'Send note to back',
    execute: () => move(to),
    undo: () => move(from)
  });
};
