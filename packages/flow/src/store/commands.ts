import { createStore, type StoreApi } from 'zustand';
import type { EdgeChange, XYPosition } from 'reactflow';
import type { System } from '@/system/system';
import type { GraphSession } from '@/system/graphSession';

/**
 * Context handed to a command when it runs. Carries the editor + the graph it
 * acts on, plus optional targets so the same command works from a context menu,
 * a hotkey, or a toolbar button.
 */
export type CommandContext = {
  editor: System;
  session: GraphSession;
  nodeId?: string;
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  position?: XYPosition;
};

/**
 * A named, dispatchable action. Decouples *what* (id) from *how* (run), so UI
 * surfaces (context menus, hotkeys, menubar, toolbar) reference commands by id
 * instead of reaching into concrete stores.
 */
export type Command = {
  id: string;
  title?: string;
  /** When present and false, the command is treated as unavailable. */
  isEnabled?: (ctx: CommandContext) => boolean;
  run: (ctx: CommandContext) => void | Promise<void>;
};

export type CommandStore = {
  commands: Map<string, Command>;
  /** Register (or replace) a command. Returns an unregister disposer. */
  register: (command: Command) => () => void;
  unregister: (id: string) => void;
  get: (id: string) => Command | undefined;
  list: () => Command[];
  /** Run a command by id; no-ops (with a warning) if unknown or disabled. */
  run: (id: string, ctx: CommandContext) => void | Promise<void>;
};

export const commandStoreFactory = (): StoreApi<CommandStore> =>
  createStore<CommandStore>((set, get) => ({
    commands: new Map(),
    register: (command) => {
      set((s) => {
        const next = new Map(s.commands);
        next.set(command.id, command);
        return { commands: next };
      });
      return () => get().unregister(command.id);
    },
    unregister: (id) =>
      set((s) => {
        if (!s.commands.has(id)) return s;
        const next = new Map(s.commands);
        next.delete(id);
        return { commands: next };
      }),
    get: (id) => get().commands.get(id),
    list: () => Array.from(get().commands.values()),
    run: (id, ctx) => {
      const command = get().commands.get(id);
      if (!command) {
        console.warn(`[commands] unknown command: ${id}`);
        return;
      }
      if (command.isEnabled && !command.isEnabled(ctx)) return;
      return command.run(ctx);
    }
  }));

// --- Default graph commands --------------------------------------------------
// Transitional: these delegate to the per-session action store. As actions are
// decomposed (a later slice), the logic can move into the command handlers and
// the action store can shrink.

const actionsOf = (ctx: CommandContext) =>
  ctx.session.actionStore.getState().actions;

const centerOnNode = (session: GraphSession, nodeId: string): void => {
  const node = session.nodeStore.getState().nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const x = node.position.x + (node.width ?? 0) / 2;
  const y = node.position.y + (node.height ?? 0) / 2;
  session.refStore
    .getState()
    .getRef('reactflow')
    ?.setCenter(x, y, { duration: 200, zoom: 1 });
};

const reactFlowOf = (session: GraphSession) =>
  session.refStore.getState().getRef('reactflow');

/**
 * Register the built-in editor commands. Hosts may override any of them by
 * re-registering with the same id, or add their own.
 */
export const registerDefaultCommands = (
  store: StoreApi<CommandStore>
): void => {
  const { register } = store.getState();

  register({
    id: 'node.focus',
    title: 'Focus',
    run: (ctx) => {
      if (ctx.nodeId) actionsOf(ctx).focusNode(ctx.nodeId);
    }
  });
  register({
    id: 'node.traceUpstream',
    title: 'Trace Upstream',
    run: (ctx) => {
      if (ctx.nodeId) actionsOf(ctx).traceUpstream(ctx.nodeId);
    }
  });
  register({
    id: 'node.traceDownstream',
    title: 'Trace Downstream',
    run: (ctx) => {
      if (ctx.nodeId) actionsOf(ctx).traceDownstream(ctx.nodeId);
    }
  });
  register({
    id: 'trace.reset',
    title: 'Reset Trace',
    run: (ctx) => actionsOf(ctx).resetTrace()
  });
  register({
    id: 'node.togglePinned',
    title: 'Pin / Unpin',
    run: (ctx) => {
      if (ctx.nodeId) actionsOf(ctx).toggleNodePinned(ctx.nodeId);
    }
  });
  register({
    id: 'node.toggleHidden',
    title: 'Hide / Show',
    run: (ctx) => {
      if (ctx.nodeId) actionsOf(ctx).toggleNodeHidden(ctx.nodeId);
    }
  });

  register({
    id: 'edge.findSource',
    title: 'Find Source',
    run: (ctx) => {
      if (ctx.sourceId) centerOnNode(ctx.session, ctx.sourceId);
    }
  });
  register({
    id: 'edge.findTarget',
    title: 'Find Target',
    run: (ctx) => {
      if (ctx.targetId) centerOnNode(ctx.session, ctx.targetId);
    }
  });
  register({
    id: 'edge.delete',
    title: 'Delete',
    run: (ctx) => {
      if (!ctx.edgeId) return;
      const change: EdgeChange = { id: ctx.edgeId, type: 'remove' };
      ctx.session.edgeStore.getState().applyEdgeChanges([change]);
    }
  });

  register({
    id: 'selection.copy',
    title: 'Copy',
    run: (ctx) => actionsOf(ctx).copySelectionToClipboard()
  });
  register({
    id: 'selection.paste',
    title: 'Paste',
    run: (ctx) => actionsOf(ctx).pasteFromClipboard()
  });
  register({
    id: 'selection.group',
    title: 'Group',
    run: (ctx) => actionsOf(ctx).groupNodes()
  });
  register({
    id: 'selection.selectAll',
    title: 'Select All',
    run: (ctx) =>
      ctx.session.nodeStore
        .getState()
        .setNodes((nodes) => nodes.map((n) => ({ ...n, selected: true })))
  });

  // Editor-level
  register({
    id: 'editor.save',
    title: 'Save Graph',
    run: (ctx) => {
      void actionsOf(ctx).save();
    }
  });
  register({
    id: 'editor.undo',
    title: 'Undo',
    run: (ctx) => ctx.session.undoManager.undo()
  });
  register({
    id: 'editor.redo',
    title: 'Redo',
    run: (ctx) => ctx.session.undoManager.redo()
  });
  register({
    id: 'editor.find',
    title: 'Find',
    run: (ctx) => ctx.editor.tabStore.getState().openTab('find')
  });
  // `editor.autoLayout` is contributed by the optional layout plugin
  // (`@/plugin/layout`), which owns the heavy elkjs/dagre dependencies. When
  // that plugin is not registered the command is simply unavailable and the
  // bound hotkey no-ops.

  // View
  register({
    id: 'view.fit',
    title: 'Fit View',
    run: (ctx) => {
      reactFlowOf(ctx.session)?.fitView({
        padding: 0.2,
        includeHiddenNodes: true
      });
    }
  });
  register({
    id: 'view.zoomIn',
    title: 'Zoom In',
    run: (ctx) => reactFlowOf(ctx.session)?.zoomIn({ duration: 300 })
  });
  register({
    id: 'view.zoomOut',
    title: 'Zoom Out',
    run: (ctx) => reactFlowOf(ctx.session)?.zoomOut({ duration: 300 })
  });
  register({
    id: 'view.zoomReset',
    title: 'Reset Zoom',
    run: (ctx) => {
      const rf = reactFlowOf(ctx.session);
      if (!rf) return;
      rf.setViewport({ ...rf.getViewport(), zoom: 1 });
    }
  });
  register({
    id: 'view.toggleGrid',
    title: 'Toggle Grid',
    run: (ctx) => {
      const s = ctx.editor.systemSettings.getState();
      s.setShowGrid(!s.showGrid);
    }
  });
  register({
    id: 'view.toggleMinimap',
    title: 'Toggle Minimap',
    run: (ctx) => {
      const s = ctx.editor.systemSettings.getState();
      s.setShowMinimap(!s.showMinimap);
    }
  });
  register({
    id: 'view.toggleSnapGrid',
    title: 'Toggle Snap to Grid',
    run: (ctx) => {
      const s = ctx.editor.systemSettings.getState();
      s.setSnapGrid(!s.snapGrid);
    }
  });
};
