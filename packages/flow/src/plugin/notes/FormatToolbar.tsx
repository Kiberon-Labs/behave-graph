import { useState } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import { VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';
import {
  Bold,
  Code,
  Italic,
  List,
  NumberedListLeft,
  Quote,
  Strikethrough,
  Youtube
} from 'iconoir-react';

interface FormatToolbarProps {
  editor: Editor;
}

/**
 * Formatting actions for the note editor. Buttons are the same VscodeButton
 * component the FloatingToolbar uses, so the note toolbar stays visually
 * consistent with the rest of the editor chrome; the active format renders as
 * a primary (accent) button.
 *
 * The button row swallows mousedown so clicking a formatting button keeps the
 * editor's text selection instead of blurring it. The video row must NOT: its
 * text field needs focus. Video embedding uses an inline URL field rather than
 * `window.prompt`, which is blocked in VS Code webviews.
 */
export const FormatToolbar = ({ editor }: FormatToolbarProps) => {
  // null = embed row closed; a string = the URL being typed.
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const active = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      h1: editor.isActive('heading', { level: 1 }),
      h2: editor.isActive('heading', { level: 2 }),
      h3: editor.isActive('heading', { level: 3 }),
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      codeBlock: editor.isActive('codeBlock'),
      blockquote: editor.isActive('blockquote')
    })
  });

  const embedVideo = () => {
    const src = videoUrl?.trim();
    if (src) {
      editor.chain().focus().setYoutubeVideo({ src }).run();
    }
    setVideoUrl(null);
  };

  return (
    <div className="notes-toolbar nodrag nopan">
      <div
        className="notes-toolbar__row"
        onMouseDown={(e) => e.preventDefault()}
      >
        <VscodeButton
          secondary={!active.bold}
          iconOnly
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </VscodeButton>
        <VscodeButton
          secondary={!active.italic}
          iconOnly
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </VscodeButton>
        <VscodeButton
          secondary={!active.strike}
          iconOnly
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </VscodeButton>
        <VscodeButton
          secondary={!active.code}
          iconOnly
          title="Code"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <Code />
        </VscodeButton>
        <div className="notes-toolbar__separator" />
        <VscodeButton
          secondary={!active.h1}
          title="Heading 1"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        >
          H1
        </VscodeButton>
        <VscodeButton
          secondary={!active.h2}
          title="Heading 2"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </VscodeButton>
        <VscodeButton
          secondary={!active.h3}
          title="Heading 3"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </VscodeButton>
        <div className="notes-toolbar__separator" />
        <VscodeButton
          secondary={!active.bulletList}
          iconOnly
          title="Bullet List"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </VscodeButton>
        <VscodeButton
          secondary={!active.orderedList}
          iconOnly
          title="Numbered List"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <NumberedListLeft />
        </VscodeButton>
        <VscodeButton
          secondary={!active.codeBlock}
          iconOnly
          title="Code Block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <Code />
        </VscodeButton>
        <VscodeButton
          secondary={!active.blockquote}
          iconOnly
          title="Quote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </VscodeButton>
        <div className="notes-toolbar__separator" />
        <VscodeButton
          secondary={videoUrl === null}
          iconOnly
          title="Embed YouTube Video"
          onClick={() => setVideoUrl(videoUrl === null ? '' : null)}
        >
          <Youtube />
        </VscodeButton>
      </div>

      {videoUrl !== null && (
        <div
          className="notes-toolbar__embed"
          // Keep keystrokes (e.g. Backspace) from reaching React Flow, which
          // would delete the selected note while the URL is being typed.
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') embedVideo();
            if (e.key === 'Escape') setVideoUrl(null);
          }}
        >
          <VscodeTextfield
            type="text"
            placeholder="YouTube video URL"
            value={videoUrl}
            onInput={(e: any) => setVideoUrl(e.target.value)}
          />
          <VscodeButton title="Embed" onClick={embedVideo}>
            Embed
          </VscodeButton>
          <VscodeButton
            secondary
            title="Cancel"
            onClick={() => setVideoUrl(null)}
          >
            Cancel
          </VscodeButton>
        </div>
      )}
    </div>
  );
};
