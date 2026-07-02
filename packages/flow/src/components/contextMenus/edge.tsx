import type { CSSProperties } from 'react';
import { DynamicContextMenu } from './DynamicContextMenu';

export interface IEdgeContextMenuProps extends CSSProperties {
  edgeID: string;
  sourceID: string;
  targetID: string;
}

/** Edge context menu , items from the contextMenu registry (target 'edge'). */
export const EdgeContextMenu = ({
  edgeID,
  sourceID,
  targetID,
  ...rest
}: IEdgeContextMenuProps) => (
  <DynamicContextMenu
    target="edge"
    context={{ edgeId: edgeID, sourceId: sourceID, targetId: targetID }}
    style={rest}
  />
);
