import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import {
  VscodeContextMenu,
  VscodeContextMenuItem,
  VscodeDivider
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system';

export interface ISelectionContextMenuProps extends CSSProperties {}

export const SelectionContextMenu = ({
  ...rest
}: ISelectionContextMenuProps) => {
  const sys = useSystem();

  const onCopy = useCallback(() => {
    sys.actionStore.getState().actions.copySelectionToClipboard();
  }, [sys]);

  const onPaste = useCallback(async () => {
    await sys.actionStore.getState().actions.pasteFromClipboard();
  }, [sys]);

  const onGroup = useCallback(() => {
    sys.actionStore.getState().actions.groupNodes();
  }, [sys]);

  const onSelect = useCallback(
    (e: any) => {
      switch (e.detail.value) {
        case 'copy':
          onCopy();
          break;
        case 'paste':
          void onPaste();
          break;
        case 'group':
          onGroup();
          break;
      }
    },
    [onCopy, onGroup, onPaste]
  );

  return (
    <VscodeContextMenu
      show
      onVscContextMenuSelect={onSelect}
      style={{ zIndex: 2000, position: 'absolute', ...rest }}
      data={[
        {
          label: 'Copy',
          keybinding: 'Ctrl+C',
          value: 'copy'
        },
        {
          label: 'Paste',
          keybinding: 'Ctrl+V',
          value: 'paste'
        },
        {
          separator: true
        },
        {
          label: 'Group',
          value: 'group'
        }
      ]}
    >
      <VscodeContextMenuItem onClick={onCopy}>Copy</VscodeContextMenuItem>
      <VscodeContextMenuItem onClick={onPaste}>Paste</VscodeContextMenuItem>
      <VscodeDivider />
      <VscodeContextMenuItem onClick={onGroup}>Group</VscodeContextMenuItem>
    </VscodeContextMenu>
  );
};
