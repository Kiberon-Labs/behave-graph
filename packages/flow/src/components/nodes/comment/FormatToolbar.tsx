import styles from './styles.module.css';
import type { Editor } from '@tiptap/react';
import { Code, List, NumberedListLeft, Quote } from 'iconoir-react';

interface FormatToolbarProps {
  editor: Editor;
}

export const FormatToolbar = ({ editor }: FormatToolbarProps) => {
  return (
    <div className={styles.bubbleMenu}>
      <div className={styles.menuBar}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? styles.isActive : ''}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? styles.isActive : ''}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? styles.isActive : ''}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? styles.isActive : ''}
          title="Code"
        >
          <Code />
        </button>
        <div className={styles.separator} />
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          className={
            editor.isActive('heading', { level: 1 }) ? styles.isActive : ''
          }
          title="Heading 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive('heading', { level: 2 }) ? styles.isActive : ''
          }
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={
            editor.isActive('heading', { level: 3 }) ? styles.isActive : ''
          }
          title="Heading 3"
        >
          H3
        </button>
        <div className={styles.separator} />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? styles.isActive : ''}
          title="Bullet List"
        >
          <List />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? styles.isActive : ''}
          title="Numbered List"
        >
          <NumberedListLeft />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? styles.isActive : ''}
          title="Code Block"
        >
          <Code />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? styles.isActive : ''}
          title="Quote"
        >
          <Quote />
        </button>
      </div>
    </div>
  );
};
