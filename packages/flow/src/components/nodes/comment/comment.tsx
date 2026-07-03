import { lazy, memo, Suspense } from 'react';
import type { NodeProps } from 'reactflow';
import type { ICommentNode } from '@/types/nodes';

/**
 * Comment nodes embed a tiptap/prosemirror rich-text editor (~320 KB). Most
 * graphs have no comment nodes, so load the implementation lazily — the editor
 * weight only enters the bundle when a comment node is actually rendered.
 */
const LazyCommentNode = lazy(() =>
  import('./commentImpl').then((m) => ({ default: m.CommentNodeImpl }))
);

const CommentNodeRaw = (props: NodeProps<ICommentNode['data']>) => (
  <Suspense fallback={null}>
    <LazyCommentNode {...props} />
  </Suspense>
);

export const CommentNode = memo(CommentNodeRaw);
