import type { BoxBase, LayoutBase, PanelBase, TabData } from 'rc-dock';

/**
 * Tab-id convention for graph tabs. The default graph uses the bare id `graph`
 * (session id `graph`); every other graph uses `graph:<sessionId>`. These three
 * helpers are the single source of truth for the convention.
 */
const GRAPH_TAB_PREFIX = 'graph:';
export const DEFAULT_GRAPH_ID = 'graph';

export function isGraphTabId(id: string | undefined): id is string {
  return !!id && (id === DEFAULT_GRAPH_ID || id.startsWith(GRAPH_TAB_PREFIX));
}

export function sessionIdFromTabId(tabId: string): string {
  return tabId === DEFAULT_GRAPH_ID
    ? DEFAULT_GRAPH_ID
    : tabId.slice(GRAPH_TAB_PREFIX.length);
}

export function tabIdForSession(sessionId: string): string {
  return sessionId === DEFAULT_GRAPH_ID
    ? DEFAULT_GRAPH_ID
    : `${GRAPH_TAB_PREFIX}${sessionId}`;
}

/** Collect the session ids of every graph tab present in a layout. */
export function collectGraphSessionIds(layout: LayoutBase): Set<string> {
  const ids = new Set<string>();
  const visit = (base?: BoxBase | PanelBase) => {
    if (!base) return;
    const panel = base as PanelBase;
    if (panel.tabs) {
      for (const tab of panel.tabs) {
        if (isGraphTabId(tab.id)) ids.add(sessionIdFromTabId(tab.id!));
      }
    }
    const box = base as BoxBase;
    if (box.children) box.children.forEach(visit);
  };
  visit(layout.dockbox);
  visit(layout.floatbox);
  visit(layout.maxbox);
  visit(layout.windowbox);
  return ids;
}

function recurseFindGraphPanel(base: BoxBase | PanelBase): PanelBase | null {
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
  tabData: Partial<TabData>,
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
