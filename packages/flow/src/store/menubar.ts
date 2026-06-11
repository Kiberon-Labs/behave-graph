import { defaultMenuDataFactory } from '@/components/menubar';
import { createStore } from 'zustand';

export type IMenuItem = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (rest: { [key: string]: any }) => React.ReactNode;
};

export type ISubMenu = {
  title: string;
  name: string;
  items: (IMenuItem | Seperator)[];
};
export type IMenu = {
  items: ISubMenu[];
};

export class Seperator {}

export type MenuBarStore = {
  show: boolean;
  setShow: (show: boolean) => void;
  items: ISubMenu[];
  setItems: (items: ISubMenu[]) => void;
  setSubMenuItems: (menuName: string, items: (IMenuItem | Seperator)[]) => void;
};

export const menubarStoreFactory = () =>
  createStore<MenuBarStore>((set) => ({
    show: true,
    setShow: (show) => set({ show }),
    items: defaultMenuDataFactory().items,
    setItems: (items) => set({ items }),
    setSubMenuItems: (menuName, items) =>
      set((state) => ({
        items: state.items.map((subMenu) =>
          subMenu.name === menuName ? { ...subMenu, items } : subMenu
        )
      }))
  }));
