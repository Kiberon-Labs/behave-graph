import { AlignmentPanel } from '../panels/alignment/index.js';
import { LegendPanel } from '../panels/legend/index.js';
import { LogsPanel } from '../panels/logs/index.js';
import { MenuItemElement } from './menuItem.js';
import { Settings } from '../panels/systemSettings';
import { KeymapsPanel } from '../panels/keymaps';
import type { LayoutBase, TabData } from 'rc-dock';
import { type JSX } from 'react';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import type { UIGraphJSON } from '@/types/graph.js';

import {
  Archive,
  Download,
  PagePlusIn,
  Redo,
  SettingsProfiles,
  Trash,
  Undo,
  Upload
} from 'iconoir-react';
import { Seperator, type IMenu, type IMenuItem } from '@/store/menubar.js';
import { useSystem } from '@/system/index.js';
import { useStore } from 'zustand';
import {
  findTabInLayout,
  removeTabFromLayout,
  addFloatingTab,
  findGraphPanel
} from '../layoutController/utils.js';
import { SearchPanel } from '../panels/search/index.js';
import { VariablesPanel } from '../panels/variables/index.js';
import { EventsPanel } from '../panels/events/index.js';
import { HistoryPanel } from '../panels/history/index.js';
import { PanelPanel } from '../panels/panel/index.js';

async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

function isLayoutBase(value: unknown): value is LayoutBase {
  if (!value || typeof value !== 'object') return false;
  // Minimal sanity check for rc-dock layout
  return 'dockbox' in (value as Record<string, unknown>);
}

export interface IWindowButton {
  //Id of the tab
  id: string;
  title: string;
  //name ofthe menu item
  name: string;
  icon?: JSX.Element;
  content: JSX.Element;
}
/**
 * A simple button that toggles a window panel
 * @param param0
 * @returns
 */
export const windowButton = ({
  name,
  id,
  title,
  icon,
  content
}: IWindowButton): IMenuItem => ({
  name: name,
  render: function Toggle() {
    const system = useSystem();

    const onToggle = () => {
      const currentLayout = system.tabStore.getState().layout;
      const existingPanel = findTabInLayout(currentLayout, id);

      if (existingPanel) {
        // Tab exists, remove it
        const newLayout = removeTabFromLayout(currentLayout, id);
        system.tabStore.getState().setLayout(newLayout);
      } else {
        // Tab doesn't exist, add it as a floating panel
        const tabData: TabData = {
          id,
          title,
          content: () => content,
          cached: true,
          group: 'popout'
        };

        const newLayout = addFloatingTab(currentLayout, tabData, {
          left: 500,
          top: 300,
          width: 320,
          height: 400
        });

        system.tabStore.getState().setLayout(newLayout);
      }
    };
    return (
      <MenuItemElement onClick={onToggle} key={title} icon={icon}>
        {title}
      </MenuItemElement>
    );
  }
});

export const defaultMenuDataFactory = (): IMenu => ({
  items: [
    {
      title: 'File',
      name: 'file',
      items: [
        {
          name: 'newGraph',
          render: (rest) => {
            return (
              <MenuItemElement key="new" icon={<PagePlusIn />} {...rest}>
                New Graph
              </MenuItemElement>
            );
          }
        },
        new Seperator(),
        {
          name: 'saveBehave',
          render: function SaveGraph(rest) {
            const system = useSystem();

            const onSave = () => {
              system.flowStore.getState().invalidateCache();
              const graph = system.flowStore.getState().getGraph();
              system.pubsub.publish('graph:inner:saved', graph);
            };

            return (
              <MenuItemElement
                key={'saveBehave'}
                icon={<Download />}
                onClick={onSave}
                {...rest}
              >
                Save inner Behave Graph
              </MenuItemElement>
            );
          }
        },
        {
          name: 'loadBehave',
          render: function LoadGraph(rest) {
            const system = useSystem();

            const onLoad = () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json,application/json';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const parsed = (await readJsonFile(file)) as GraphJSON;
                  system.flowStore.getState().setGraph(parsed);

                  const reactflow = system.refStore
                    .getState()
                    .getRef('reactflow');
                  setTimeout(() => {
                    reactflow?.fitView();
                  }, 100);
                } catch (err) {
                  console.error('Failed to load graph', err);
                }
              };
              input.click();
            };

            return (
              <MenuItemElement
                key={'loadBehave'}
                icon={<Upload />}
                onClick={onLoad}
                {...rest}
              >
                Load inner Behave Graph
              </MenuItemElement>
            );
          }
        },
        new Seperator(),
        {
          name: 'saveUI',
          render: function SaveGraph(rest) {
            const system = useSystem();

            const onSave = () => {
              system.actionStore.getState().actions.save();
            };

            return (
              <MenuItemElement
                key={'saveUI'}
                icon={<Download />}
                onClick={onSave}
                {...rest}
              >
                Save Graph
              </MenuItemElement>
            );
          }
        },
        {
          name: 'loadUI',
          render: function LoadGraph(rest) {
            const system = useSystem();

            const onLoad = () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json,application/json';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const parsed = (await readJsonFile(file)) as UIGraphJSON;

                  // UIGraphJSON format - deserialize UI state and load inner graph
                  system.graph.deseralize(parsed);
                  system.flowStore
                    .getState()
                    .setGraph(parsed.flow, { skipLayout: true });
                } catch (err) {
                  console.error('Failed to load graph', err);
                }
              };
              input.click();
            };

            return (
              <MenuItemElement
                key={'loadUI'}
                icon={<Upload />}
                onClick={onLoad}
                {...rest}
              >
                Load Graph
              </MenuItemElement>
            );
          }
        },
        new Seperator(),
        {
          name: 'clear',
          render: function ClearGraph({ key, ...rest }) {
            const system = useSystem();

            const onClear = () => {
              system.graph.clear();
              system.flowStore.getState().invalidateCache();
            };

            return (
              <MenuItemElement
                key={key}
                icon={<Trash />}
                onClick={onClear}
                {...rest}
              >
                Clear
              </MenuItemElement>
            );
          }
        }
      ]
    },
    {
      title: 'Edit',
      name: 'edit',
      items: [
        {
          name: 'undo',
          render: ({ key, ...rest }) => {
            const sys = useSystem();

            const canUndo = useStore(sys.undoManager.store, (s) => s.canUndo);
            return (
              <MenuItemElement
                onClick={() => canUndo && sys.undoManager.undo()}
                disabled={!canUndo}
                key={key}
                icon={<Undo />}
                {...rest}
              >
                Undo
              </MenuItemElement>
            );
          }
        },
        {
          name: 'redo',
          render: ({ key, ...rest }) => {
            const sys = useSystem();

            const canRedo = useStore(sys.undoManager.store, (s) => s.canRedo);
            return (
              <MenuItemElement
                onClick={() => canRedo && sys.undoManager.redo()}
                disabled={!canRedo}
                key={key}
                icon={<Redo />}
                {...rest}
              >
                Redo
              </MenuItemElement>
            );
          }
        },
        new Seperator(),
        {
          name: 'cut',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} icon={<Redo />} {...rest}>
              Cut
            </MenuItemElement>
          )
        },
        {
          name: 'copy',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} icon={<Redo />} {...rest}>
              Copy
            </MenuItemElement>
          )
        },
        {
          name: 'paste',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} icon={<Redo />} {...rest}>
              Paste
            </MenuItemElement>
          )
        },
        new Seperator(),
        windowButton({
          name: 'find',
          id: 'find',
          title: 'Find',
          content: <SearchPanel />
        })
      ]
    },
    {
      name: 'window',
      title: 'Window',
      items: [
        windowButton({
          name: 'history',
          id: 'history',
          title: 'History',
          content: <HistoryPanel />
        }),
        windowButton({
          name: 'logs',
          id: 'logs',
          title: 'Logs',
          icon: <Archive />,
          content: <LogsPanel />
        }),
        windowButton({
          name: 'variables',
          id: 'variables',
          title: 'Variables',
          content: <VariablesPanel />
        }),
        windowButton({
          name: 'events',
          id: 'events',
          title: 'Events',
          content: <EventsPanel />
        }),
        windowButton({
          name: 'legend',
          id: 'legend',
          title: 'Legend',
          content: <LegendPanel />
        }),
        windowButton({
          name: 'alignment',
          id: 'distribution',
          title: 'Alignment + Distribution',
          content: <AlignmentPanel />
        }),
        windowButton({
          name: 'settings',
          id: 'system:settings',
          title: 'Settings',
          icon: <SettingsProfiles />,
          content: <Settings />
        }),
        windowButton({
          name: 'keymaps',
          id: 'keymaps',
          title: 'Keyboard Shortcuts',
          icon: <SettingsProfiles />,
          content: <KeymapsPanel />
        }),
        windowButton({
          name: 'panels',
          id: 'panels',
          title: 'Panels',
          content: <PanelPanel />
        }),

        new Seperator(),

        {
          name: 'saveLayout',
          render: function SaveLayout(rest) {
            const system = useSystem();

            const saveLayout = () => {
              const layout = system.tabStore.getState().layout;
              system.pubsub.publish('layout:saved', layout);
            };

            return (
              <MenuItemElement
                icon={<Download />}
                onClick={saveLayout}
                {...rest}
              >
                Save Layout
              </MenuItemElement>
            );
          }
        },
        {
          name: 'loadLayout',
          render: function LoadLayout(rest) {
            const system = useSystem();

            const loadLayout = () => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.json,application/json';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const parsed = await readJsonFile(file);
                  if (!isLayoutBase(parsed)) {
                    throw new Error('Invalid layout file');
                  }

                  system.tabStore.getState().setLayout(parsed);

                  const graphPanel = findGraphPanel(parsed);
                  if (graphPanel?.activeId) {
                    system.tabStore
                      .getState()
                      .setCurrentPanel(graphPanel.activeId);
                  }
                } catch (err) {
                  console.error('Failed to load layout', err);
                }
              };
              input.click();
            };

            return (
              <MenuItemElement icon={<Upload />} onClick={loadLayout} {...rest}>
                Load Layout
              </MenuItemElement>
            );
          }
        }
      ]
    }
  ]
});
