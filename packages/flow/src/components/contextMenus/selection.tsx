import type { CSSProperties } from 'react';
import { DynamicContextMenu } from './DynamicContextMenu';

export interface ISelectionContextMenuProps extends CSSProperties { }

/** Selection context menu , items from the contextMenu registry ('selection'). */
export const SelectionContextMenu = ({
  ...rest
}: ISelectionContextMenuProps) => (
  <DynamicContextMenu target="selection" context={{}} style={rest} />
);
