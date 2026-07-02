import type { LayoutBase, TabBase, TabData, TabGroup } from 'rc-dock';
import { DockLayout } from 'rc-dock';
import React, { useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { Reduce, Maximize, Xmark } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { MenuBar } from '../menubar';
import { useStore } from 'zustand';
import {
  findGraphPanel,
  collectGraphSessionIds,
  isGraphTabId,
  sessionIdFromTabId
} from './utils';

import styles from './index.module.css';
import { NotificationProvider } from '../notifications';

const groups: Record<string, TabGroup> = {
  default: {
    animated: false,
    floatable: true
  },
  headless: {
    floatable: true,
    maximizable: true,
    disableDock: true,
    panelExtra: () => <></>
  },
  popout: {
    animated: false,
    floatable: true,

    panelExtra: (panelData, context) => {
      const buttons: React.ReactElement[] = [];
      buttons.push(
        <VscodeButton
          secondary
          iconOnly
          key="close"
          title="Close"
          onClick={() => context.dockMove(panelData, null, 'remove')}
        >
          <Xmark />
        </VscodeButton>
      );
      return <div className={styles.panelExtra}>{buttons}</div>;
    }
  },
  /**
   * Note that the graph has a huge issue when ran in a popout window, as such we disable it for now
   */
  graph: {
    animated: false,
    floatable: true,
    panelExtra: (panelData, context) => {
      const buttons: React.ReactElement[] = [];
      if (panelData?.parent?.mode !== 'window') {
        const maxxed = panelData?.parent?.mode === 'maximize';
        buttons.push(
          <VscodeButton
            key="maximize"
            secondary
            title={
              panelData?.parent?.mode === 'maximize' ? 'Restore' : 'Maximize'
            }
            iconOnly
            onClick={() => context.dockMove(panelData, null, 'maximize')}
          >
            {maxxed ? <Reduce /> : <Maximize />}
          </VscodeButton>
        );
      }

      return <div className={styles.panelExtra}>{buttons}</div>;
    }
  }
};

export const LayoutController = (props: {}) => {
  const system = useSystem();
  const showMenu = useStore(system.systemSettings, (x) => x.showMenu);
  const setCurrentPanel = useStore(system.tabStore, (s) => s.setCurrentPanel);
  const setLayout = useStore(system.tabStore, (s) => s.setLayout);
  const layout = useStore(system.tabStore, (s) => s.layout);

  const loadTab = useCallback(
    (tab: TabBase): TabData => {
      const loaded = system.tabLoader.load(tab);
      if (!loaded) {
        return tab as TabData;
      }
      return loaded;
    },
    [system, props]
  );

  const onLayoutChange = (newLayout: LayoutBase) => {
    //We need to find the graph tab container in the newlayout
    const graphContainer = findGraphPanel(newLayout);

    if (graphContainer?.activeId) {
      //Get the active Id to find the currently selected graph
      setCurrentPanel(graphContainer.activeId!);

      // Keep the editor's active graph in sync with the focused graph tab so
      // panels bound via useActiveGraph() rebind to it.
      if (isGraphTabId(graphContainer.activeId)) {
        system.activeGraph
          .getState()
          .setActiveGraph(sessionIdFromTabId(graphContainer.activeId));
      }
    }

    // Dispose sessions whose tabs were closed in this layout change.
    const before = collectGraphSessionIds(layout);
    const after = collectGraphSessionIds(newLayout);
    for (const id of before) {
      if (!after.has(id)) {
        system.disposeSession(id);
      }
    }

    setLayout(newLayout);
  };

  return (
    <div className={styles.root}>
      {showMenu && <MenuBar />}
      <DockLayout
        layout={layout}
        groups={groups}
        loadTab={loadTab}
        style={{ flex: 1, height: '100%', width: '100%' }}
        onLayoutChange={onLayoutChange}
      />
      <NotificationProvider />
    </div>
  );
};
