import { Item } from 'rc-menu';
import React from 'react';

import styles from './menuItem.module.css';

export type IMenuItemElement = React.ComponentProps<typeof Item> & {
  icon?: React.ReactNode;
  /**
   * Needed to hack into the inner part of the menu item
   */
  inner?: (children: React.ReactNode) => React.ReactNode;
};

/**
 * You must provide a unique key for each item
 */
export const MenuItemElement = ({
  inner = (children: React.ReactNode) => children,
  children,
  ...rest
}: IMenuItemElement) => {
  return (
    // @ts-expect-error This is the correct attribute
    <Item selectable={'false'} {...rest}>
      {inner(
        <div className={styles.root}>
          <div className={styles.inner}>{children}</div>
        </div>
      )}
    </Item>
  );
};
