import type { CSSProperties } from 'react';
import { useStore } from 'zustand';
import { VscodeContextMenu } from '@vscode-elements/react-elements';
import { useGraph } from '@/system';
import type { CommandContext } from '@/store/commands';
import type { ContextMenuTarget } from '@/store/contextMenu';

type MenuData =
  | { separator: true }
  | { label: string; value: string; keybinding?: string };

/**
 * Renders a context menu for a target from the editor's contextMenu registry,
 * dispatching selections through the command registry. The three concrete menus
 * (node/edge/selection) are thin wrappers that supply the target + context.
 */
export const DynamicContextMenu = ({
  target,
  context,
  style
}: {
  target: ContextMenuTarget;
  context: Omit<CommandContext, 'editor' | 'session'>;
  style?: CSSProperties;
}) => {
  const session = useGraph();
  const editor = session.editor;

  // Subscribe so the menu re-renders when items/commands change.
  useStore(editor.contextMenuStore, (s) => s.items);
  useStore(editor.commandStore, (s) => s.commands);

  const ctx: CommandContext = { editor, session, ...context };

  const items = editor.contextMenuStore
    .getState()
    .getItems(target)
    .filter((i) => !i.when || i.when(ctx));

  const data: MenuData[] = [];
  let lastGroup: unknown;
  for (const item of items) {
    if (data.length > 0 && item.group !== lastGroup) {
      data.push({ separator: true });
    }
    lastGroup = item.group;
    data.push({
      label: typeof item.label === 'function' ? item.label(ctx) : item.label,
      value: item.id,
      keybinding: item.keybinding
    });
  }

  if (data.length === 0) return null;

  const onSelect = (e: any) => {
    const id = e?.detail?.value as string | undefined;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.onSelect) {
      item.onSelect(ctx);
      return;
    }
    if (item.commandId) {
      void editor.commandStore.getState().run(item.commandId, ctx);
    }
  };

  return (
    <VscodeContextMenu
      show
      onVscContextMenuSelect={onSelect}
      style={{ zIndex: 2000, position: 'absolute', ...style }}
      data={data}
    />
  );
};
