import type { LayoutBase, TabBase, TabData, TabGroup } from 'rc-dock';
import { DockLayout } from 'rc-dock';
// import { FindDialog } from '@/components/dialogs/findDialog.js';

import React, { useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { Reduce, Maximize, Xmark } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { MenuBar } from '../menubar';
import { useStore } from 'zustand';
import { findGraphPanel } from './utils';

const groups: Record<string, TabGroup> = {
  default: {
    animated: false,
    floatable: true
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
      return <div className="flex">{buttons}</div>;
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

      return <div className="flex">{buttons}</div>;
    }
  }
};

export const LayoutController = (props: {}) => {
  const system = useSystem();
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
    }
    setLayout(newLayout);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <MenuBar />
      {/* {props.showMenu && <MenuBar menu={menuItems} />} */}
      <DockLayout
        // ref={registerDocker}
        layout={layout}
        groups={groups}
        loadTab={loadTab}
        style={{ flex: 1, height: '100%', width: '100%' }}
        onLayoutChange={onLayoutChange}
      />
      {/* <FindDialog /> */}
    </div>
  );
};
