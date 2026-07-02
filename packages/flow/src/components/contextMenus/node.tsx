import type { CSSProperties } from 'react';
import { DynamicContextMenu } from './DynamicContextMenu';

export interface INodeContextMenuProps extends CSSProperties {
  nodeID: string;
}

/**
 * Node context menu. Items come from the editor's contextMenu registry (target
 * 'node') and dispatch through the command registry , see store/contextMenu.ts
 * and store/commands.ts to add or override entries.
 */
export const NodeContextMenu = ({ nodeID, ...rest }: INodeContextMenuProps) => (
  <DynamicContextMenu target="node" context={{ nodeId: nodeID }} style={rest} />
);
