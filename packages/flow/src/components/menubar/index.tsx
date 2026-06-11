import Menu, { Divider, Item as MenuItem, SubMenu } from 'rc-menu';
import React, { useMemo } from 'react';
import { Seperator, type ISubMenu } from '../../store/menubar.js';
import { useSystem } from '@/system/provider';
import { useStore } from 'zustand';

export type IItem = React.ComponentProps<typeof MenuItem> & {
  icon?: React.ReactNode;
};

const SubMenuComponent = ({ submenu }: { submenu: ISubMenu }) => {
  //Note that eventKey should not be used per the docs
  //https://github.com/react-component/menu/blob/master/src/SubMenu/index.tsx
  //However just populating the key seems to be broken
  return (
    <SubMenu
      title={submenu.title}
      eventKey={'xx' + submenu.name}
      key={submenu.name}
    >
      {submenu.items
        .map((item, i) => {
          if (item instanceof Seperator) {
            return <Divider key={i} />;
          }
          return item.render({ key: item.name });
        })
        .flat()}
    </SubMenu>
  );
};

export const MenuBar = () => {
  const system = useSystem();
  const { show, items } = useStore(system.menubarStore);

  const menuItems = useMemo(
    () =>
      items.map((submenu) => {
        return <SubMenuComponent submenu={submenu} key={submenu.name} />;
      }),
    [items]
  );

  return show ? <Menu mode={'horizontal'}>{menuItems}</Menu> : null;
};

export * from './defaults.js';
export * from './menuItem.js';
