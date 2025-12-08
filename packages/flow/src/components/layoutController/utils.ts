import type { BoxBase, LayoutBase, PanelBase, TabData } from 'rc-dock';

export function recurseFindGraphPanel(
  base: BoxBase | PanelBase
): PanelBase | null {
  if (base.id === 'graphs') {
    return base as PanelBase;
  }
  //Check if it has children
  if ((base as BoxBase).children) {
    for (const child of (base as BoxBase).children) {
      const found = recurseFindGraphPanel(child);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findGraphPanel(layout: LayoutBase): PanelBase | null {
  //We need to recursively search for the graph panel
  // It is most likely in the dockbox
  const dockbox = recurseFindGraphPanel(layout.dockbox);
  if (dockbox) {
    return dockbox;
  }
  if (layout.floatbox) {
    const floatBox = recurseFindGraphPanel(layout.floatbox);
    if (floatBox) {
      return floatBox;
    }
  } else if (layout.maxbox) {
    const tab = recurseFindGraphPanel(layout.maxbox);
    if (tab) {
      return tab;
    }
  } else if (layout.windowbox) {
    const tab = recurseFindGraphPanel(layout.windowbox);
    if (tab) {
      return tab;
    }
  }
  return null;
}

function recurseFindTab(
  base: BoxBase | PanelBase,
  tabId: string
): PanelBase | null {
  // Check if this is a panel with tabs
  if ((base as PanelBase).tabs) {
    const panel = base as PanelBase;
    const hasTab = panel.tabs?.some((tab) => tab.id === tabId);
    if (hasTab) {
      return panel;
    }
  }

  // Check if it has children
  if ((base as BoxBase).children) {
    for (const child of (base as BoxBase).children) {
      const found = recurseFindTab(child, tabId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findTabInLayout(
  layout: LayoutBase,
  tabId: string
): PanelBase | null {
  // Search in dockbox
  if (layout.dockbox) {
    const found = recurseFindTab(layout.dockbox, tabId);
    if (found) return found;
  }

  // Search in floatbox
  if (layout.floatbox) {
    const found = recurseFindTab(layout.floatbox, tabId);
    if (found) return found;
  }

  // Search in maxbox
  if (layout.maxbox) {
    const found = recurseFindTab(layout.maxbox, tabId);
    if (found) return found;
  }

  // Search in windowbox
  if (layout.windowbox) {
    const found = recurseFindTab(layout.windowbox, tabId);
    if (found) return found;
  }

  return null;
}

function removeTabFromPanel(panel: PanelBase, tabId: string): PanelBase {
  return {
    ...panel,
    tabs: panel.tabs?.filter((tab) => tab.id !== tabId)
  };
}

function recursiveRemoveTab(
  base: BoxBase | PanelBase,
  tabId: string
): BoxBase | PanelBase | null {
  // If this is a panel with tabs, remove the tab
  if ((base as PanelBase).tabs) {
    const panel = base as PanelBase;
    const hasTab = panel.tabs?.some((tab) => tab.id === tabId);
    if (hasTab) {
      const updatedPanel = removeTabFromPanel(panel, tabId);
      // If panel has no more tabs, return null to remove it
      if (!updatedPanel.tabs || updatedPanel.tabs.length === 0) {
        return null;
      }
      return updatedPanel;
    }
    return panel;
  }

  // If it has children, recursively update them
  if ((base as BoxBase).children) {
    const box = base as BoxBase;
    const updatedChildren = box.children
      .map((child) => recursiveRemoveTab(child, tabId))
      .filter((child) => child !== null) as (BoxBase | PanelBase)[];

    // If no children left, return null
    if (updatedChildren.length === 0) {
      return null;
    }

    return {
      ...box,
      children: updatedChildren
    };
  }

  return base;
}

export function removeTabFromLayout(
  layout: LayoutBase,
  tabId: string
): LayoutBase {
  const newLayout = { ...layout };

  if (newLayout.dockbox) {
    const updated = recursiveRemoveTab(newLayout.dockbox, tabId);
    if (updated) {
      newLayout.dockbox = updated as BoxBase;
    }
  }

  if (newLayout.floatbox) {
    const updated = recursiveRemoveTab(newLayout.floatbox, tabId);
    if (updated) {
      newLayout.floatbox = updated as BoxBase;
    } else {
      delete newLayout.floatbox;
    }
  }

  return newLayout;
}

export function addFloatingTab(
  layout: LayoutBase,
  tabData: TabData,
  position: { left: number; top: number; width: number; height: number }
): LayoutBase {
  const newLayout = { ...layout };

  // Create or update floatbox
  const newPanel: PanelBase = {
    x: position.left,
    y: position.top,
    w: position.width,
    h: position.height,
    tabs: [tabData],
    group: tabData.group || 'popout'
  };

  if (!newLayout.floatbox) {
    newLayout.floatbox = {
      mode: 'float',
      children: [newPanel]
    };
  } else {
    newLayout.floatbox = {
      ...newLayout.floatbox,
      children: [...(newLayout.floatbox.children || []), newPanel]
    };
  }

  return newLayout;
}
