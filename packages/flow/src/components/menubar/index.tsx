import { defaultMenuDataFactory } from './defaults.js';
import Menu, { Divider, Item as MenuItem, SubMenu } from 'rc-menu';
import React, { useEffect, useMemo } from 'react';
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
  const { items, setItems } = useStore(system.menubarStore);

  useEffect(() => {
    setItems(defaultMenuDataFactory().items);
  }, [setItems]);

  const menuItems = useMemo(
    () =>
      items.map((submenu) => {
        return <SubMenuComponent submenu={submenu} key={submenu.name} />;
      }),
    [items]
  );

  return (
    <div>
      <Menu mode={'horizontal'}>{menuItems}</Menu>
    </div>
  );
};

export * from './defaults.js';
export * from './menuItem.js';
