import type { CSSProperties } from 'react';
import { useCallback } from 'react';
import type { EdgeChange } from 'reactflow';
import {
  VscodeContextMenu,
  VscodeContextMenuItem,
  VscodeDivider
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system';

export interface IEdgeContextMenuProps extends CSSProperties {
  edgeID: string;
  sourceID: string;
  targetID: string;
}

export const EdgeContextMenu = ({
  edgeID,
  sourceID,
  targetID,
  ...rest
}: IEdgeContextMenuProps) => {
  const sys = useSystem();

  const centerOnNode = useCallback(
    (nodeId: string) => {
      const node = sys.nodeStore.getState().nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const x = node.position.x + (node.width ?? 0) / 2;
      const y = node.position.y + (node.height ?? 0) / 2;

      sys.refStore.getState().getRef('reactflow')?.setCenter(x, y, {
        duration: 200,
        zoom: 1
      });
    },
    [sys]
  );

  const findSource = useCallback(
    () => centerOnNode(sourceID),
    [centerOnNode, sourceID]
  );
  const findTarget = useCallback(
    () => centerOnNode(targetID),
    [centerOnNode, targetID]
  );

  const deleteEdge = useCallback(() => {
    const change: EdgeChange = {
      id: edgeID,
      type: 'remove'
    };
    sys.edgeStore.getState().applyEdgeChanges([change]);
  }, [edgeID, sys.edgeStore]);

  const onSelect = useCallback(
    (e: any) => {
      switch (e.detail.value) {
        case 'findSource':
          findSource();
          break;
        case 'findTarget':
          findTarget();
          break;
        case 'delete':
          deleteEdge();
          break;
      }
    },
    [deleteEdge, findSource, findTarget]
  );

  return (
    <VscodeContextMenu
      show
      onVscContextMenuSelect={onSelect}
      style={{ zIndex: 2000, position: 'absolute', ...rest }}
      data={[
        {
          label: 'Find Source',
          value: 'findSource'
        },
        {
          label: 'Find Target',
          value: 'findTarget'
        },
        {
          separator: true
        },
        {
          label: 'Delete',
          value: 'delete'
        }
      ]}
    >
      <VscodeContextMenuItem onClick={findSource}>
        Find Source
      </VscodeContextMenuItem>
      <VscodeContextMenuItem onClick={findTarget}>
        Find Target
      </VscodeContextMenuItem>
      <VscodeDivider />
      <VscodeContextMenuItem onClick={deleteEdge}>Delete</VscodeContextMenuItem>
    </VscodeContextMenu>
  );
};
