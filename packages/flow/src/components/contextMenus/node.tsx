import { useReactFlow } from 'reactflow';
import { useCallback } from 'react';
import clsx from 'classnames';
import {
  VscodeContextMenu,
  VscodeContextMenuItem,
  VscodeDivider
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system';

export interface INodeContextMenuProps {
  nodeID: string;
}

export const NodeContextMenu = ({ nodeID, ...rest }: INodeContextMenuProps) => {
  const reactFlowInstance = useReactFlow();
  const sys = useSystem();

  // const deleteEl = useCallback(() => {
  //     if (!isDeletable) {
  //         trigger({
  //             title: 'Node is not deletable',
  //             description: 'This node cannot be deleted',
  //         });
  //         return;
  //     }

  //     if (nodes) {
  //         reactFlowInstance.deleteElements({ nodes });
  //     }
  // }, [isDeletable, nodes, reactFlowInstance, trigger]);

  const focus = useCallback(() => {
    const nodeSearch = sys.nodeStore.getState().nodes;
    const reactFlowInstance = sys.refStore.getState().getRef('reactflow');
    const nodes = nodeID
      ? nodeSearch.filter((x) => x.id === nodeID)
      : nodeSearch.filter((x) => x.selected);
    if (nodes) {
      const focalCenter = nodes.reduce(
        (acc, node) => {
          return {
            x: acc.x + node.position.x + (node.width || 0) / 2,
            y: acc.y + node.position.y + (node.height || 0) / 2
          };
        },
        { x: 0, y: 0 }
      );

      reactFlowInstance?.setCenter(focalCenter.x, focalCenter.y, {
        duration: 200,
        zoom: 1
      });
    }
  }, [nodeID]);

  const onResetTrace = useCallback(() => {
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((x) => {
        //Remove filtering
        return {
          ...x,
          className: clsx(x.className, {
            filtered: false
          })
        };
      })
    );
  }, [reactFlowInstance]);

  // const onDuplicate = useCallback(() => {
  //     duplicateNodes(nodes.map((x) => x.id));
  // }, [duplicateNodes, nodes]);

  const onSelect = useCallback(
    (e) => {
      switch (e.detail.value) {
        case 'traceUpstream':
          sys.actionStore.getState().actions.traceUpstream(nodeID);
          break;
        case 'traceDownstream':
          sys.actionStore.getState().actions.traceDownstream(nodeID);
          break;
        case 'resetTrace':
          sys.actionStore.getState().actions.resetTrace();
          break;

        case 'focus':
          focus();
          break;
      }
    },
    [focus]
  );

  return (
    <VscodeContextMenu
      show
      onVscContextMenuSelect={onSelect}
      style={{ zIndex: 2000, position: 'absolute', ...rest }}
      data={[
        {
          label: 'Focus',
          keybinding: 'Ctrl+Comma',
          value: 'focus'
        },
        {
          separator: true
        },
        {
          label: 'Trace Upstream',
          keybinding: 'Ctrl+Comma',
          value: 'traceUpstream'
        },
        {
          label: 'Trace Downstream',
          keybinding: 'Ctrl+Comma',
          value: 'traceDownstream'
        },
        {
          separator: true
        },
        {
          label: 'Reset Trace',
          // keybinding: 'Ctrl+Shift+X',
          value: 'resetTrace'
        }
      ]}
    >
      {/* <VscodeContextMenuItem onClick={onDuplicate}>Duplicate</VscodeContextMenuItem> */}
      <VscodeContextMenuItem onClick={focus}>Focus</VscodeContextMenuItem>
      <VscodeDivider />

      <VscodeContextMenuItem onClick={onResetTrace}>
        Reset Trace
      </VscodeContextMenuItem>
      <VscodeDivider />
      {/* <VscodeContextMenuItem disabled={!isDeletable} onClick={deleteEl}> */}
      {/* Delete
            </VscodeContextMenuItem> */}
    </VscodeContextMenu>
  );
};
