// @vitest-environment happy-dom
// @vitest-environment-options { "settings": { "disableIframePageLoading": true } }
// (embedded youtube iframes must not trigger real network requests in tests)

import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Youtube from '@tiptap/extension-youtube';
import { Markdown } from 'tiptap-markdown';

const makeEditor = (content: string) =>
  new Editor({
    element: document.createElement('div'),
    extensions: [StarterKit, Markdown, Youtube.configure({ nocookie: true })],
    content
  });

const getMarkdown = (editor: Editor): string =>
  (
    editor.storage as unknown as { markdown: { getMarkdown(): string } }
  ).markdown.getMarkdown();

describe('note markdown serialization', () => {
  it('round-trips formatted text', () => {
    const editor = makeEditor('# Title\n\nSome **bold** and `code`.');
    const md = getMarkdown(editor);
    expect(md).toContain('# Title');
    expect(md).toContain('**bold**');
    expect(md).toContain('`code`');
    editor.destroy();
  });

  it('embeds a youtube video and round-trips it through markdown', () => {
    const editor = makeEditor('');
    const inserted = editor
      .chain()
      .setYoutubeVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
      .run();
    expect(inserted).toBe(true);

    // The video serializes as an HTML block inside the markdown text.
    const md = getMarkdown(editor);
    expect(md).toContain('data-youtube-video');
    expect(md).toContain('dQw4w9WgXcQ');
    editor.destroy();

    // Loading that markdown back (what NoteNodeImpl does with data.text)
    // restores the embed.
    const reloaded = makeEditor(md);
    expect(reloaded.getHTML()).toContain('data-youtube-video');
    expect(reloaded.getHTML()).toContain('dQw4w9WgXcQ');
    reloaded.destroy();
  });

  it('rejects non-youtube urls', () => {
    const editor = makeEditor('');
    const inserted = editor
      .chain()
      .setYoutubeVideo({ src: 'https://example.com/video.mp4' })
      .run();
    expect(inserted).toBe(false);
    expect(getMarkdown(editor)).not.toContain('example.com');
    editor.destroy();
  });
});
