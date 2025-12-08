import { AlignmentPanel } from '../panels/alignment/index.js';
// import { DropPanel } from '../panels/dropPanel/index.js';
// import { GraphPanel } from '../panels/graph/index.js';
// import { Legend } from '../panels/legend/index.js';
import { LogsPanel } from '../panels/logs/index.js';
import { MenuItemElement } from './menuItem.js';
// import { NodeSettingsPanel } from '../panels/nodeSettings/index.js';
import { Settings } from '../panels/systemSettings';
import { KeymapsPanel } from '../panels/keymaps';
import type { TabData } from 'rc-dock';
import { type JSX } from 'react';

import {
  Archive,
  Download,
  PagePlusIn,
  Redo,
  SettingsProfiles,
  Undo,
  Upload
} from 'iconoir-react';
import { Seperator, type IMenu, type IMenuItem } from '@/store/menubar.js';
import { useSystem } from '@/system/index.js';
import {
  findTabInLayout,
  removeTabFromLayout,
  addFloatingTab
} from '../layoutController/utils.js';
import { SearchPanel } from '../panels/search/index.js';

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
          name: 'save',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} {...rest}>
              Save
            </MenuItemElement>
          )
        },
        {
          name: 'load',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} {...rest}>
              Load
            </MenuItemElement>
          )
        }
        // {
        //   name: 'upload',
        //   render: function FileLoad(rest) {
        //     const graphRef = useSelector(graphEditorSelector);

        //     const onClick = () => {
        //       if (!graphRef) return;

        //       const input = document.createElement('input');
        //       input.type = 'file';
        //       input.accept = '.json';
        //       //@ts-ignore
        //       input.onchange = (e: HTMLInputElement) => {
        //         //@ts-ignore
        //         const file = e.target.files[0];
        //         if (!file) return;
        //         const reader = new FileReader();
        //         reader.onload = (e) => {
        //           const text = (e.target as FileReader).result;
        //           const data = JSON.parse(text as string);

        //           //TODO open a new tab
        //           graphRef.loadRaw(data);
        //         };
        //         reader.readAsText(file);
        //       };
        //       input.click();
        //     };

        //     return (
        //       <MenuItemElement onClick={onClick} icon={<Upload />} {...rest}>
        //         <u>U</u>pload
        //       </MenuItemElement>
        //     );
        //   },
        // },
        // {
        //   name: 'download',
        //   render: function FileSave(rest) {
        //     const mainGraph = useSelector(mainGraphSelector);
        //     const graphRef = mainGraph?.ref as
        //       | ImperativeEditorRef
        //       | undefined;

        //     const onSave = () => {
        //       const saved = graphRef!.save();
        //       const blob = new Blob([JSON.stringify(saved)], {
        //         type: 'application/json',
        //       });
        //       const url = URL.createObjectURL(blob);
        //       const link = document.createElement('a');
        //       link.href = url;
        //       link.download = (saved.annotations[title] || 'graph') + `.json`;
        //       document.body.appendChild(link);
        //       link.click();
        //     };

        //     return (
        //       <MenuItemElement
        //         disabled={!graphRef}
        //         icon={<Download />}
        //         onClick={onSave}
        //         {...rest}
        //       >
        //         <u>D</u>ownload
        //       </MenuItemElement>
        //     );
        //   },
        // },
      ]
    },
    {
      title: 'Edit',
      name: 'edit',
      items: [
        {
          name: 'undo',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} icon={<Undo />} {...rest}>
              Undo
            </MenuItemElement>
          )
        },
        {
          name: 'redo',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} icon={<Redo />} {...rest}>
              Redo
            </MenuItemElement>
          )
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
      title: 'Run',
      name: 'run',
      items: [
        {
          name: 'Start Engine',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} {...rest}>
              Start Engine
            </MenuItemElement>
          )
        },
        {
          name: 'Stop Engine',
          render: ({ key, ...rest }) => (
            <MenuItemElement key={key} {...rest}>
              Stop Engine
            </MenuItemElement>
          )
        },
        new Seperator()
      ]
    },
    {
      name: 'window',
      title: 'Window',
      items: [
        // windowButton({
        //   name: 'nodeSettings',
        //   id: 'nodeSettings',
        //   title: 'Node Settings',
        //   icon: <Cpu />,
        //   content: <NodeSettingsPanel />,
        // }),
        // windowButton({
        //   name: 'graphSettings',
        //   id: 'graphSettings',
        //   title: 'Graph Settings',
        //   content: <GraphPanel />,
        // }),
        windowButton({
          name: 'logs',
          id: 'logs',
          title: 'Logs',
          icon: <Archive />,
          content: <LogsPanel />
        }),
        // windowButton({
        //   name: 'playControls',
        //   id: 'playControls',
        //   title: 'Play Controls',
        //   icon: <Play />,
        //   content: <PlayPanel />,
        // }),
        // windowButton({
        //   name: 'legend',
        //   id: 'legend',
        //   title: 'Legend',
        //   content: <Legend />,
        // }),
        windowButton({
          name: 'alignment',
          id: 'alignment',
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
        // windowButton({
        //   name: 'dropPanel',
        //   id: 'dropPanel',
        //   title: 'Nodes',
        //   content: <DropPanel />,
        // }),

        new Seperator(),

        {
          name: 'saveLayout',
          render: function SaveLayout(rest) {
            // const saveLayout = useCallback(() => {
            //   const saved = dockerRef.current.saveLayout();
            //   const blob = new Blob([JSON.stringify(saved)], {
            //     type: 'application/json',
            //   });
            //   const url = URL.createObjectURL(blob);
            //   const link = document.createElement('a');
            //   link.href = url;
            //   link.download = `layout.json`;
            //   document.body.appendChild(link);
            //   link.click();
            // }, [dockerRef]);
            return (
              <MenuItemElement
                icon={<Download />}
                // onClick={saveLayout}
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
            // const loadLayout = useCallback(() => {
            //   const input = document.createElement('input');
            //   input.type = 'file';
            //   input.accept = '.json';
            //   //@ts-ignore
            //   input.onchange = (e: HTMLInputElement) => {
            //     //@ts-ignore
            //     const file = e.target.files[0];
            //     if (!file) return;
            //     const reader = new FileReader();
            //     reader.onload = (e) => {
            //       const text = (e.target as FileReader).result;
            //       const data = JSON.parse(text as string);
            //       dockerRef.current.loadLayout(data);
            //     };
            //     reader.readAsText(file);
            //   };
            //   input.click();
            // }, [dockerRef]);

            return (
              <MenuItemElement
                icon={<Upload />}
                // onClick={loadLayout}
                {...rest}
              >
                Load Layout
              </MenuItemElement>
            );
          }
        }
      ]
    }
  ]
});
