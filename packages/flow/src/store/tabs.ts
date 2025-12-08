import type { LayoutBase } from 'rc-dock';
import { create } from 'zustand';

const defaultLayout: LayoutBase = {
  dockbox: {
    mode: 'vertical',
    children: [
      {
        mode: 'horizontal',
        children: [
          {
            size: 2,
            mode: 'vertical',
            children: [
              {
                mode: 'horizontal',
                children: [
                  {
                    size: 3,
                    mode: 'vertical',
                    children: [
                      {
                        tabs: [
                          {
                            id: 'events'
                          }
                        ]
                      }
                    ]
                  },
                  {
                    size: 17,
                    mode: 'vertical',
                    children: [
                      {
                        id: 'graphs',
                        size: 700,
                        group: 'graph',
                        tabs: [
                          {
                            id: 'graph'
                          }
                        ]
                      }
                    ]
                  },
                  {
                    size: 4,
                    mode: 'vertical',
                    children: [
                      {
                        size: 12,
                        tabs: [
                          {
                            id: 'nodeInputs'
                          },
                          {
                            id: 'system:settings'
                          }
                        ]
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

export type TabStore = {
  currentPanel?: string;
  layout: LayoutBase;
  setLayout: (layout: LayoutBase) => void;
  setCurrentPanel: (currentPanel: string) => void;
};

export const tabStoreFactory = () =>
  create<TabStore>((set) => ({
    currentPanel: 'string',
    layout: defaultLayout,
    setLayout: (layout: LayoutBase) => set(() => ({ layout })),
    setCurrentPanel: (currentPanel: string) => set(() => ({ currentPanel }))
  }));
