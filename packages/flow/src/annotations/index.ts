//Used on ports to indicate meta from a ui

/**
 * Indicates that the port can be completely deleted
 */
export const nonDeletable = 'ui.nonDeletable';
/**
 * Indicates that the port can be reset to its default value / type
 */
export const resetable = 'ui.resetable';
/**
 * Indicates that the port cannot be edited
 */
export const readonly = 'ui.readonly';
/**
 * Indicates that the port is hidden from the user
 */
export const hidden = 'ui.hidden';

//Used on nodes and graph
export const annotatedTitle = 'ui.title';
export const description = 'ui.description';
export const executing = 'ui.executing';
export const pinned = 'ui.pinned';
export const layerId = 'ui.layerId';

//Used exclusively on graph
export const uiVersion = 'ui.version';

export const realtime = 'ui.realtime';
//UI annotation to detect realtime output nodes, which are used to display outputs in the UI without affecting the actual graph outputs
export const AnnotatedOutput = 'ui.annotatedOutput';
