import { useReactFlow } from 'reactflow';
import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import clsx from 'classnames';
import {
  VscodeContextMenu,
  VscodeContextMenuItem,
  VscodeDivider
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system';
import { hidden, pinned } from '@/annotations';

export interface INodeContextMenuProps extends CSSProperties {
  nodeID: string;
}

export const NodeContextMenu = ({ nodeID, ...rest }: INodeContextMenuProps) => {
  const reactFlowInstance = useReactFlow();
  const sys = useSystem();

  // Get the current node to check if it's hidden
  const currentNode = sys.nodeStore
    .getState()
    .nodes.find((n) => n.id === nodeID);
  const isHidden =
    currentNode && 'data' in currentNode
      ? (currentNode.data.annotations?.[hidden] ?? false)
      : false;
  const isPinned =
    currentNode && 'data' in currentNode
      ? (currentNode.data.annotations?.[pinned] ?? false)
      : false;

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

  const onSelect = useCallback(
    (e: any) => {
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

        case 'pin':
          sys.actionStore.getState().actions.toggleNodePinned(nodeID);
          break;
        case 'hide':
          sys.actionStore.getState().actions.toggleNodeHidden(nodeID);
          break;
      }
    },
    [focus, nodeID, sys]
  );

  return (
    <VscodeContextMenu
      show
      onVscContextMenuSelect={onSelect}
      style={{ zIndex: 2000, position: 'absolute', ...rest }}
      data={[
        {
          label: 'Focus',
          keybinding: 'Ctrl+Shift+F',
          value: 'focus'
        },
        {
          separator: true
        },
        {
          label: 'Trace Upstream',
          keybinding: 'Ctrl+Shift+R',
          value: 'traceUpstream'
        },
        {
          label: 'Trace Downstream',
          keybinding: 'Ctrl+Shift+T',
          value: 'traceDownstream'
        },
        {
          separator: true
        },
        {
          label: 'Reset Trace',
          keybinding: 'Ctrl+Shift+G',
          value: 'resetTrace'
        },

        {
          separator: true
        },
        {
          label: isPinned ? 'Unpin' : 'Pin',
          value: 'pin'
        },
        {
          label: isHidden ? 'Show' : 'Hide',
          value: 'hide'
        }
      ]}
    >
      <VscodeContextMenuItem onClick={focus}>Focus</VscodeContextMenuItem>
      <VscodeDivider />

      <VscodeContextMenuItem onClick={onResetTrace}>
        Reset Trace
      </VscodeContextMenuItem>
      <VscodeDivider />
    </VscodeContextMenu>
  );
};
