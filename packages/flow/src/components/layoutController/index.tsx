import type {
  BoxBase,

  LayoutBase,
  LayoutData,
  PanelBase,
  TabBase,
  TabData,
  TabGroup,
} from 'rc-dock';
import { DockLayout } from 'rc-dock'
// import { FindDialog } from '@/components/dialogs/findDialog.js';

import React, { useCallback } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { Reduce, Maximize, Xmark } from 'iconoir-react';
import { useSystem } from '@/system/provider.js';
import { MenuBar } from '../menubar';

const groups: Record<string, TabGroup> = {
  default: {
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
        </VscodeButton>,
      );
      return <div className='flex'>{buttons}</div>;
    },
  },
  popout: {
    animated: false,
    floatable: true,

    panelExtra: (panelData, context) => {
      const buttons: React.ReactElement[] = [];
      if (panelData?.parent?.mode !== 'window') {
        const maxxed = panelData?.parent?.mode === 'maximize';
        buttons.push(
          <VscodeButton
            secondary

            key="maximize"
            title={
              panelData?.parent?.mode === 'maximize' ? 'Restore' : 'Maximize'
            }
            iconOnly
            onClick={() => context.dockMove(panelData, null, 'maximize')}
          >
            {maxxed ? <Reduce /> : <Maximize />}
          </VscodeButton>,
        );
        // buttons.push(
        //   <DockButton
        //     key="new-window"
        //     title="Open in new window"
        //     icon={<ArrowUpRight />}
        //     onClick={() => context.dockMove(panelData, null, 'new-window')}
        //   ></DockButton>,
        // );
      }
      buttons.push(
        <VscodeButton
          secondary
          iconOnly
          key="close"
          title="Close"
          onClick={() => context.dockMove(panelData, null, 'remove')}
        >
          <Xmark />
        </VscodeButton>,
      );
      return <div className='flex'>{buttons}</div>;
    },
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
          </VscodeButton>,
        );
      }

      return <div className='flex'>{buttons}</div>;
    },
  },
};

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

function findGraphPanel(layout: LayoutBase): PanelBase | null {
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
                            id: "logs"
                          },
                          {
                            id: 'dropPanel',
                          },
                        ],
                      },
                    ],
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
                            id: 'graph',
                          },
                        ],
                      },
                    ],
                  },
                  {
                    size: 4,
                    mode: 'vertical',
                    children: [
                      {
                        size: 12,
                        tabs: [
                          {
                            id: 'system:settings'
                          },
                          {
                            id: 'unifiedPorts',
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};


export const LayoutController = (props: {}) => {
  const system = useSystem();
  const setCurrentPanel = system.useTabStore((s) => s.setCurrentPanel)
  // const registerDocker = useRegisterRef<DockLayout>('docker');
  // const dispatch = useDispatch();

  // const dockerRef = useSelector(dockerSelector) as MutableRefObject<DockLayout>;

  const loadTab = useCallback(
    (tab: TabBase): TabData => {
      const loaded = system.tabLoader.load(tab);
      if (!loaded) {
        return tab as TabData
      }
      return loaded;
    },
    [system, props],
  );

  // useEffect(() => {
  //   if (dockerRef?.current && initialLayout) {
  //     dockerRef.current?.loadLayout(initialLayout);
  //   }
  // }, [dockerRef]);

  const onLayoutChange = (newLayout: LayoutBase) => {
    //We need to find the graph tab container in the newlayout
    const graphContainer = findGraphPanel(newLayout)

    if (graphContainer?.activeId) {
      //Get the active Id to find the currently selected graph
      setCurrentPanel(graphContainer.activeId!);
    }
  };

  return (
    <div
      className="flex-col h-full" style={{ background: 'var(--colors-bgCanvas)' }}
    >
      <MenuBar />
      {/* {props.showMenu && <MenuBar menu={menuItems} />} */}
      <DockLayout
        // ref={registerDocker}
        defaultLayout={defaultLayout as LayoutData}
        groups={groups}
        loadTab={loadTab}
        style={{ flex: 1, height: '100%', width: '100%' }}
        onLayoutChange={onLayoutChange}
      />
      {/* <FindDialog /> */}
    </div>
  );
};
