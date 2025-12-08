import { Item } from 'rc-menu';
import React from 'react';

export type IMenuItemElement = React.ComponentProps<typeof Item> & {
  icon?: React.ReactNode;
  /**
   * Needed to hack into the inner part of the menu item
   */
  inner?: (children) => React.ReactNode;
};

/**
 * You must provide a unique key for each item
 */
export const MenuItemElement = ({
  inner = (children) => children,
  children,
  ...rest
}: IMenuItemElement) => {
  return (
    // @ts-expect-error This is the correct attribute
    <Item selectable={'false'} {...rest}>
      {inner(
        <div className="flex gap-1 align-center rounded w-full">
          <div className="pl-2 pr-2 inner-menu-item p-1 rounded w-full min-width-300px">
            {children}
          </div>
        </div>
      )}
    </Item>
  );
};
