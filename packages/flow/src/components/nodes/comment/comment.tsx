import styles from './styles.module.css';
import { memo, useEffect, useRef, useState } from 'react';
import { NodeResizer, type OnResize } from 'reactflow';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useChangeNodeData } from '@/hooks/useChangeNodeData';
import { BaseNodeWrapper } from '../wrapper';
import { Markdown } from 'tiptap-markdown';
import type { ICommentNode } from '@/types/nodes';
import { FormatToolbar } from './FormatToolbar';
import type { NodeProps } from 'reactflow';

const CommentNodeRaw = ({
  data,
  selected,
  id
}: NodeProps<ICommentNode['data']>) => {
  const [isEditing, setIsEditing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const handleNodeChange = useChangeNodeData(id);

  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: data.text || '> Comment',
    editable: isEditing,
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none w-full h-full nodrag',
        style: `font-size: ${data.fontSize || 'medium'}; padding: 0.5rem;`
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

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
    }
  }, [isEditing, editor]);

  useEffect(() => {
    if (editor && data.fontSize) {
      const editorElement = editor.view.dom as HTMLElement;
      editorElement.style.fontSize = data.fontSize;
    }
  }, [data.fontSize, editor]);

  const onResize: OnResize = (event, params) => {
    if (!containerRef.current) return;
    containerRef.current.style.height = `${params.height}px`;
    containerRef.current.style.width = `${params.width}px`;
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    setTimeout(() => {
      editor?.commands.focus();
    }, 0);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the new focus target is within the editor
    const relatedTarget = e.relatedTarget as Node;
    if (containerRef.current?.contains(relatedTarget)) {
      return; // Don't close if focus is moving within the editor
    }

    setTimeout(() => {
      setIsEditing(false);
    }, 200);
  };

  return (
    <BaseNodeWrapper metadata={data.annotations}>
      <div className={styles.commentNode}>
        <NodeResizer
          onResize={onResize}
          color="#ff0071"
          isVisible={selected || false}
        />

        <div
          ref={containerRef}
          className={styles.editorContainer}
          onDoubleClick={handleDoubleClick}
          onBlur={handleBlur}
        >
          {editor && isEditing && <FormatToolbar editor={editor} />}
          <EditorContent editor={editor} className={styles.editorContent} />
        </div>
      </div>
    </BaseNodeWrapper>
  );
};

export const CommentNode = memo(CommentNodeRaw);
