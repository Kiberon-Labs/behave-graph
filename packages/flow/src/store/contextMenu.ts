import { createStore, type StoreApi } from 'zustand';
import { hidden, pinned } from '@/annotations';
import { isBehaveNode } from '@/util/isBehaveNode';
import type { CommandContext } from './commands';

/** Which canvas target a context-menu item applies to. */
export type ContextMenuTarget = 'node' | 'edge' | 'selection' | 'pane';

/**
 * A registrable context-menu entry. Items dispatch either a registered command
 * (`commandId`) or an inline `onSelect`. `group` controls separator placement;
 * `order` controls position within a target. `when` hides the item dynamically.
 */
export type ContextMenuItem = {
  id: string;
  target: ContextMenuTarget;
  /** Static text, or a function for state-dependent labels (e.g. Pin/Unpin). */
  label: string | ((ctx: CommandContext) => string);
  keybinding?: string;
  /** Ascending sort within the target. */
  order?: number;
  /** Items with different adjacent groups get a separator between them. */
  group?: string | number;
  when?: (ctx: CommandContext) => boolean;
  /** Dispatch a registered command by id. */
  commandId?: string;
  /** Or run inline (takes precedence over commandId). */
  onSelect?: (ctx: CommandContext) => void;
};

export type ContextMenuStore = {
  items: ContextMenuItem[];
  /** Register (or replace by id) an item. Returns an unregister disposer. */
  register: (item: ContextMenuItem) => () => void;
  unregister: (id: string) => void;
  /** Items for a target, sorted by `order`. Filtering by `when` is the caller's. */
  getItems: (target: ContextMenuTarget) => ContextMenuItem[];
};

export const contextMenuStoreFactory = (): StoreApi<ContextMenuStore> =>
  createStore<ContextMenuStore>((set, get) => ({
    items: [],
    register: (item) => {
      set((s) => ({
        items: [...s.items.filter((i) => i.id !== item.id), item]
      }));
      return () => get().unregister(item.id);
    },
    unregister: (id) =>
      set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    getItems: (target) =>
      get()
        .items.filter((i) => i.target === target)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }));

// --- Default context menus ---------------------------------------------------

const nodeAt = (ctx: CommandContext) =>
  ctx.session.nodeStore.getState().nodes.find((n) => n.id === ctx.nodeId);

const nodeFlag = (ctx: CommandContext, key: string): boolean => {
  const node = nodeAt(ctx);
  return node && 'data' in node
    ? Boolean((node.data.annotations as Record<string, unknown>)?.[key])
    : false;
};

// The default node items only make sense on behave nodes; presentational node
// types (notes, groups, ...) register their own `when`-scoped items instead.
const isBehaveTarget = (ctx: CommandContext): boolean => {
  const node = nodeAt(ctx);
  return node !== undefined && isBehaveNode(node);
};

/**
 * Register the built-in context-menu items, dispatching the default commands.
 * Hosts can add/remove/replace items by id without forking the menu components.
 */
export const registerDefaultContextMenu = (
  store: StoreApi<ContextMenuStore>
): void => {
  const { register } = store.getState();

  // Node
  register({
    id: 'node.focus',
    target: 'node',
    label: 'Focus',
    order: 10,
    group: 'focus',
    when: isBehaveTarget,
    commandId: 'node.focus'
  });
  register({
    id: 'node.traceUpstream',
    target: 'node',
    label: 'Trace Upstream',
    order: 20,
    group: 'trace',
    when: isBehaveTarget,
    commandId: 'node.traceUpstream'
  });
  register({
    id: 'node.traceDownstream',
    target: 'node',
    label: 'Trace Downstream',
    order: 21,
    group: 'trace',
    when: isBehaveTarget,
    commandId: 'node.traceDownstream'
  });
  register({
    id: 'node.resetTrace',
    target: 'node',
    label: 'Reset Trace',
    order: 30,
    group: 'reset',
    when: isBehaveTarget,
    commandId: 'trace.reset'
  });
  register({
    id: 'node.togglePinned',
    target: 'node',
    label: (ctx) => (nodeFlag(ctx, pinned) ? 'Unpin' : 'Pin'),
    order: 40,
    group: 'visibility',
    when: isBehaveTarget,
    commandId: 'node.togglePinned'
  });
  register({
    id: 'node.toggleHidden',
    target: 'node',
    label: (ctx) => (nodeFlag(ctx, hidden) ? 'Show' : 'Hide'),
    order: 41,
    group: 'visibility',
    when: isBehaveTarget,
    commandId: 'node.toggleHidden'
  });

  // Edge
  register({
    id: 'edge.findSource',
    target: 'edge',
    label: 'Find Source',
    order: 10,
    group: 'find',
    commandId: 'edge.findSource'
  });
  register({
    id: 'edge.findTarget',
    target: 'edge',
    label: 'Find Target',
    order: 11,
    group: 'find',
    commandId: 'edge.findTarget'
  });
  register({
    id: 'edge.delete',
    target: 'edge',
    label: 'Delete',
    order: 20,
    group: 'delete',
    commandId: 'edge.delete'
  });

  // Selection
  register({
    id: 'selection.copy',
    target: 'selection',
    label: 'Copy',
    order: 10,
    group: 'clipboard',
    commandId: 'selection.copy'
  });
  register({
    id: 'selection.paste',
    target: 'selection',
    label: 'Paste',
    order: 11,
    group: 'clipboard',
    commandId: 'selection.paste'
  });
  register({
    id: 'selection.group',
    target: 'selection',
    label: 'Group',
    order: 20,
    group: 'group',
    commandId: 'selection.group'
  });
};
