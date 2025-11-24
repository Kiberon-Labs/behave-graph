import { AlignmentPanel } from '../panels/alignment/index.js';
// import { DropPanel } from '../panels/dropPanel/index.js';
// import { GraphPanel } from '../panels/graph/index.js';
// import { Legend } from '../panels/legend/index.js';
import { LogsPanel } from '../panels/logs/index.js';
import { MenuItemElement } from './menuItem.js';
// import { NodeSettingsPanel } from '../panels/nodeSettings/index.js';
import { Settings } from '../panels/systemSettings';
import type { TabData } from 'rc-dock';
import { useCallback, type JSX } from 'react';

import { Archive, Download, PagePlusIn, SettingsProfiles, Upload } from 'iconoir-react';
import { Seperator, type IMenu, type IMenuItem } from '@/store/menubar.js';

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
  content,
}: IWindowButton): IMenuItem => ({
  name: name,
  render: function Toggle() {


    // const onToggle = () => {
    //   const existing = dockerRef.current.find(id) as TabData;
    //   if (existing) {
    //     //Look for the panel
    //     if (existing.parent?.tabs.length === 1) {
    //       //Close the panel instead
    //       dockerRef.current.dockMove(existing.parent, null, 'remove');
    //     } else {
    //       //Close the tab
    //       dockerRef.current.dockMove(existing, null, 'remove');
    //     }
    //   } else {
    //     dockerRef.current.dockMove(
    //       {
    //         cached: true,
    //         group: 'popout',
    //         id,
    //         title,
    //         content,
    //       },
    //       null,
    //       'float',
    //       {
    //         left: 500,
    //         top: 300,
    //         width: 320,
    //         height: 400,
    //       },
    //     );
    //   }
    // };

    return (
      <MenuItemElement
        // onClick={onToggle} 
        key={title} icon={icon}>
        {title}
      </MenuItemElement>
    );
  },
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
          },
        },
        new Seperator(),
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
      ],
    },
    {
      title: 'Edit',
      name: 'edit',
      items: [
        // {
        //   name: 'undo',
        //   render: ({key,...rest}) => <MenuItemElement key={key} icon={<Undo />} {...rest} >Undo</MenuItemElement>,
        // },
        // {
        //   name: 'redo',
        //   render: ({ key, ...rest }) => <MenuItemElement key={key} icon={<Redo />} {...rest}>Redo</MenuItemElement>,
        // },
        new Seperator(),
        {
          name: 'find',
          render: ({ key, ...rest }) => {

            return (
              <MenuItemElement
                key={key}
                {...rest}
              // onClick={() => dispatch.settings.setShowSearch(true)}
              >
                Find
              </MenuItemElement>
            );
          },
        },
      ],
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
          content: <LogsPanel />,
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
          content: <AlignmentPanel />,
        }),
        windowButton({
          name: 'settings',
          id: 'settings',
          title: 'Settings',
          icon: <SettingsProfiles />,
          content: <Settings />,
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
          },
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
          },
        },
      ],
    },
  ],
});
