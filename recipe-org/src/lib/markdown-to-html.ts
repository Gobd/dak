import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from '@tiptap/markdown';

/**
 * Convert markdown to HTML using Tiptap's rendering
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Create a headless editor to parse and render
  const editor = new Editor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown.configure({ markedOptions: { gfm: true } }),
    ],
    content: markdown,
    contentType: 'markdown',
  });

  const html = editor.getHTML();
  editor.destroy();

  return html;
}
