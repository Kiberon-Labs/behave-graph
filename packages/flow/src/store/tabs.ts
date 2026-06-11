import type { BoxBase, LayoutBase, PanelBase, TabBase } from 'rc-dock';
import { create } from 'zustand';

function isPanelBase(value: BoxBase | PanelBase): value is PanelBase {
  return Array.isArray((value as PanelBase).tabs);
}

function hasChildren(value: BoxBase | PanelBase): value is BoxBase {
  return Array.isArray((value as BoxBase).children);
}

function upsertTabInPanel(panel: PanelBase, tabId: string): PanelBase {
  const tabs = panel.tabs ?? [];
  const exists = tabs.some((t) => t.id === tabId);
  const nextTabs: TabBase[] = exists ? tabs : [...tabs, { id: tabId }];
  return {
    ...panel,
    tabs: nextTabs,
    activeId: tabId
  };
}

function recurseFocusTab(
  base: BoxBase | PanelBase,
  tabId: string
): { updated: BoxBase | PanelBase; found: boolean } {
  if (isPanelBase(base)) {
    const hasTab = base.tabs?.some((t) => t.id === tabId);
    if (!hasTab) {
      return { updated: base, found: false };
    }
    return {
      updated: {
        ...base,
        activeId: tabId
      },
      found: true
    };
  }

  if (hasChildren(base)) {
    let found = false;
    const updatedChildren = base.children.map((child) => {
      if (found) return child;
      const res = recurseFocusTab(child, tabId);
      found = res.found;
      return res.updated;
    });
    return { updated: { ...base, children: updatedChildren }, found };
  }

  return { updated: base, found: false };
}

function recurseUpsertTabInPanelId(
  base: BoxBase | PanelBase,
  panelId: string,
  tabId: string
): { updated: BoxBase | PanelBase; done: boolean } {
  if (isPanelBase(base)) {
    if (base.id !== panelId) {
      return { updated: base, done: false };
    }
    return { updated: upsertTabInPanel(base, tabId), done: true };
  }

  if (hasChildren(base)) {
    let done = false;
    const updatedChildren = base.children.map((child) => {
      if (done) return child;
      const res = recurseUpsertTabInPanelId(child, panelId, tabId);
      done = res.done;
      return res.updated;
    });
    return { updated: { ...base, children: updatedChildren }, done };
  }

  return { updated: base, done: false };
}

function recurseUpsertTabInFirstPanel(
  base: BoxBase | PanelBase,
  tabId: string
): { updated: BoxBase | PanelBase; done: boolean } {
  if (isPanelBase(base)) {
    return { updated: upsertTabInPanel(base, tabId), done: true };
  }

  if (hasChildren(base)) {
    let done = false;
    const updatedChildren = base.children.map((child) => {
      if (done) return child;
      const res = recurseUpsertTabInFirstPanel(child, tabId);
      done = res.done;
      return res.updated;
    });
    return { updated: { ...base, children: updatedChildren }, done };
  }

  return { updated: base, done: false };
}

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
                            id: 'variables'
                          },
                          {
                            id: 'layers'
                          },
                          {
                            id: 'events'
                          },
                          {
                            id: 'traces'
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
  openTab: (tabId: string, options?: { panelId?: string }) => void;
};

export const tabStoreFactory = () =>
  create<TabStore>((set) => ({
    currentPanel: 'string',
    layout: defaultLayout,
    setLayout: (layout: LayoutBase) => set(() => ({ layout })),
    setCurrentPanel: (currentPanel: string) => set(() => ({ currentPanel })),
    openTab: (tabId: string, options?: { panelId?: string }) =>
      set((state) => {
        // 1) If the tab already exists anywhere, just focus it.
        let found = false;
        let updatedLayout: LayoutBase = state.layout;

        const focusIn = (box?: BoxBase) => {
          if (!box || found) return box;
          const res = recurseFocusTab(box, tabId);
          found = res.found;
          return res.updated as BoxBase;
        };

        updatedLayout = {
          ...updatedLayout,
          dockbox: focusIn(updatedLayout.dockbox) ?? updatedLayout.dockbox,
          floatbox: updatedLayout.floatbox
            ? (focusIn(updatedLayout.floatbox) as BoxBase)
            : updatedLayout.floatbox,
          maxbox: updatedLayout.maxbox
            ? (focusIn(updatedLayout.maxbox) as BoxBase)
            : updatedLayout.maxbox,
          windowbox: updatedLayout.windowbox
            ? (focusIn(updatedLayout.windowbox) as BoxBase)
            : updatedLayout.windowbox
        };

        if (found) {
          return { layout: updatedLayout };
        }

        // 2) Otherwise, insert it into a target panel (prefer explicit panelId).
        const targetPanelId =
          options?.panelId ?? (tabId === 'graph' ? 'graphs' : undefined);

        if (targetPanelId) {
          const res = recurseUpsertTabInPanelId(
            updatedLayout.dockbox,
            targetPanelId,
            tabId
          );
          if (res.done) {
            return {
              layout: { ...updatedLayout, dockbox: res.updated as BoxBase }
            };
          }
        }

        // 3) Fallback: add to the first docked panel with tabs.
        const fallback = recurseUpsertTabInFirstPanel(
          updatedLayout.dockbox,
          tabId
        );
        if (fallback.done) {
          return {
            layout: { ...updatedLayout, dockbox: fallback.updated as BoxBase }
          };
        }

        // 4) Last resort: create a floating panel.
        const floatPanel: PanelBase = {
          x: 120,
          y: 120,
          w: 420,
          h: 320,
          tabs: [{ id: tabId }],
          activeId: tabId,
          group: 'popout'
        };

        const floatbox: BoxBase = updatedLayout.floatbox
          ? {
              ...updatedLayout.floatbox,
              children: [...(updatedLayout.floatbox.children ?? []), floatPanel]
            }
          : {
              mode: 'float',
              children: [floatPanel]
            };

        return { layout: { ...updatedLayout, floatbox } };
      })
  }));
