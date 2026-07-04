import { lazy, memo, Suspense } from 'react';
import type { NodeProps } from 'reactflow';
import type { INoteNode } from '@/types/nodes';

/**
 * Note nodes embed a tiptap/prosemirror rich-text editor (~320 KB). Most
 * graphs have no note nodes, so load the implementation lazily — the editor
 * weight only enters the bundle when a note node is actually rendered.
 */
const LazyNoteNode = lazy(() =>
  import('./noteImpl').then((m) => ({ default: m.NoteNodeImpl }))
);

const NoteNodeRaw = (props: NodeProps<INoteNode['data']>) => (
  <Suspense fallback={null}>
    <LazyNoteNode {...props} />
  </Suspense>
);

export const NoteNode = memo(NoteNodeRaw);
