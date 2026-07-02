import {
  type NodeProps,
  NodeToolbar,
  getNodesBounds,
  useStore
} from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { useCallback, type ComponentType } from 'react';
import { VscodeButton } from '@vscode-elements/react-elements';
import { useGraph } from '@/system/provider';
import type { IGroupNode } from '@/types/nodes';

const lineStyle = { borderColor: 'white' };
const padding = 25;

function GroupNode(props: NodeProps<IGroupNode['data']>) {
  const { id, data } = props;
  const system = useGraph();
  const { minWidth, minHeight, hasChildNodes } = useStore((store) => {
    const childNodes = Array.from(store.nodeInternals.values()).filter(
      (n) => n.parentId === id
    );
    const rect = getNodesBounds(childNodes);

    return {
      minWidth: rect.width + padding * 2,
      minHeight: rect.height + padding * 2,
      hasChildNodes: childNodes.length > 0
    };
  }, isEqual);

  const onDelete = useCallback(() => {
    system.actionStore.getState().actions.deleteNodes([id]);
  }, [system, id]);

  const onDetach = useCallback(() => {
    system.actionStore.getState().actions.ungroupNodes(id);
  }, [system, id]);

  const onColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      system.actionStore
        .getState()
        .actions.updateGroupColor(id, e.target.value);
    },
    [system, id]
  );

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        background: `${data.color || '#FF0000'}40`
      }}
    >
      <NodeResizer
        lineStyle={lineStyle}
        minWidth={minWidth}
        minHeight={minHeight}
      />

      <NodeToolbar className="nodrag">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="color"
            value={data.color || '#FF0000'}
            onChange={onColorChange}
            style={{
              width: '32px',
              height: '28px',
              border: '1px solid var(--ds-input-border)',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: 'transparent'
            }}
            title="Change group color"
          />
          <VscodeButton secondary onClick={onDelete}>
            Delete
          </VscodeButton>
          {hasChildNodes && (
            <VscodeButton secondary onClick={onDetach}>
              Ungroup
            </VscodeButton>
          )}
        </div>
      </NodeToolbar>
    </div>
  );
}

GroupNode as ComponentType<NodeProps<IGroupNode['data']>>;
type IsEqualCompareObj = {
  minWidth: number;
  minHeight: number;
  hasChildNodes: boolean;
};

function isEqual(prev: IsEqualCompareObj, next: IsEqualCompareObj): boolean {
  return (
    prev.minWidth === next.minWidth &&
    prev.minHeight === next.minHeight &&
    prev.hasChildNodes === next.hasChildNodes
  );
}

export default GroupNode as ComponentType<NodeProps<IGroupNode['data']>>;
