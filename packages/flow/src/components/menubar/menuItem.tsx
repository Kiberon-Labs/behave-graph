import { Item } from 'rc-menu';
import React from 'react';
import { useStore } from 'zustand';
import { useSystem } from '@/system';

import styles from './menuItem.module.css';

export type IMenuItemElement = React.ComponentProps<typeof Item> & {
  icon?: React.ReactNode;
  /**
   * Explicit shortcut hint (e.g. `'Ctrl+S'`). Overrides the auto-detected one.
   */
  keybinding?: string;
  /**
   * Command id this item runs. When provided, the shortcut hint is detected
   * automatically from the live keymap, so a menu item shows its shortcut just
   * by naming the command it dispatches.
   */
  commandId?: string;
  /**
   * Needed to hack into the inner part of the menu item
   */
  inner?: (children: React.ReactNode) => React.ReactNode;
};

/** Right-aligned shortcut hint resolved live from the command's keymap binding. */
const KeybindingHint = ({ commandId }: { commandId: string }) => {
  const sys = useSystem();
  const hint = useStore(sys.hotKeyStore, (s) =>
    s.getCommandKeybinding(commandId)
  );
  if (!hint) return null;
  return <span className={styles.keybinding}>{hint}</span>;
};

/**
 * You must provide a unique key for each item
 */
export const MenuItemElement = ({
  inner = (children: React.ReactNode) => children,
  children,
  keybinding,
  commandId,
  ...rest
}: IMenuItemElement) => {
  const hint = keybinding ? (
    <span className={styles.keybinding}>{keybinding}</span>
  ) : commandId ? (
    <KeybindingHint commandId={commandId} />
  ) : null;

  return (
    // @ts-expect-error This is the correct attribute
    <Item selectable={'false'} {...rest}>
      {inner(
        <div className={styles.root}>
          <div className={styles.inner}>
            <span className={styles.label}>{children}</span>
            {hint}
          </div>
        </div>
      )}
    </Item>
  );
};
