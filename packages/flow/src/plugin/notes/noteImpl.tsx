import { NodeResizer } from 'reactflow';
import { ErrorBoundary } from 'react-error-boundary';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Youtube from '@tiptap/extension-youtube';
import { useChangeNodeData } from '@/hooks/useChangeNodeData';
import { Markdown } from 'tiptap-markdown';
import type { INoteNode } from '@/types/nodes';
import { FormatToolbar } from './FormatToolbar';
import type { NodeProps } from 'reactflow';

const NOTE_MIN_WIDTH = 160;
const NOTE_MIN_HEIGHT = 80;

/**
 * The actual note node, pulling in tiptap/prosemirror (~320 KB). It is loaded
 * lazily by `note.tsx` so that weight only lands in the bundle when a note
 * node is actually rendered.
 *
 * The note draws its own frame directly against the React Flow node bounds.
 * It must NOT use BaseNodeWrapper: that adds behave-node chrome (a second
 * bordered box) and breaks the height chain, so the frame sizes to content
 * instead of the node and drifts out of the NodeResizer bounds.
 *
 * Layout: the root div only positions the NodeResizer and floating toolbar (it
 * must not clip, or the toolbar disappears); the frame inside it clips. Only
 * the header drags the node (`dragHandle` set by `addNote`) — the body is
 * `nodrag nopan` so selecting text neither moves the node nor pans the canvas.
 * The editor is always editable: a single click gives a caret; the format
 * toolbar shows while the node is selected.
 *
 * Font size cascades from a React `style` on the root — never write to
 * `editor.view.dom` in an effect; tiptap v3 throws if the view has not mounted.
 */
export const NoteNodeImpl = ({
  data,
  selected,
  id
}: NodeProps<INoteNode['data']>) => {
  const handleNodeChange = useChangeNodeData(id);

  const editor = useEditor({
    extensions: [StarterKit, Markdown, Youtube.configure({ nocookie: true })],
    content: data.text || 'New note',
    editorProps: {
      attributes: {
        class: 'nodrag nopan'
      }
    },
    onUpdate: ({ editor }) => {
      const markdown = (
        editor.storage as { markdown?: { getMarkdown(): string } }
      ).markdown;
      if (markdown) {
        handleNodeChange('text', markdown.getMarkdown());
      }
    }
  });

  return (
    <ErrorBoundary fallback={<div>Error rendering note</div>}>
      <div
        className="notes-node-root"
        style={{ fontSize: data.fontSize || 'medium' }}
      >
        <NodeResizer
          minWidth={NOTE_MIN_WIDTH}
          minHeight={NOTE_MIN_HEIGHT}
          color="#ff0071"
          isVisible={selected || false}
        />
        {editor && selected && <FormatToolbar editor={editor} />}

        <div className="notes-node">
          <div className="notes-node__header">
            <span className="notes-node__grip" aria-hidden>
              ⠿
            </span>
            <span>Note</span>
          </div>
          <EditorContent
            editor={editor}
            className="notes-node__editor nodrag nopan"
          />
        </div>
      </div>
    </ErrorBoundary>
  );
};
