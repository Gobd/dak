import { useRef, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

// Focus at end of actual content, skipping empty trailing paragraphs that TipTap creates
function focusAtContentEnd(editor: ReturnType<typeof useEditor>): void {
  if (!editor) return;
  const { doc } = editor.state;

  // Find the last block with actual content
  let lastContentPos = doc.content.size;
  let foundContent = false;

  doc.descendants((node, pos) => {
    if (node.isTextblock && node.textContent.length > 0) {
      // Position at end of text content within this block
      lastContentPos = pos + node.content.size + 1;
      foundContent = true;
    }
    return true; // continue traversing
  });

  if (foundContent) {
    editor.chain().focus().setTextSelection(lastContentPos).run();
  } else {
    editor.commands.focus('end');
  }
}

interface UseNoteEditorOptions {
  content: string; // markdown content
  onUpdate: (content: string) => void; // returns markdown
  maxLength?: number;
  placeholder?: string;
}

// Debounce delay for content changes
const DEBOUNCE_MS = 300;

// TipTap can insert non-breaking spaces (char 160) or &nbsp; entities
// Normalize to regular spaces to avoid weird characters in saved content
function normalizeMarkdown(raw: string): string {
  return raw.replace(/\u00A0/g, ' ').replace(/&nbsp;/g, ' ');
}

export function useNoteEditor({
  content,
  onUpdate,
  maxLength = 50000,
  placeholder = 'Start writing...',
}: UseNoteEditorOptions) {
  const lastContentRef = useRef(normalizeMarkdown(content));
  const isInitPhaseRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);

  // Keep ref updated with latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const initialContent = normalizeMarkdown(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
        onReadOnlyChecked: () => true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true, // GitHub Flavored Markdown (task lists, tasks, etc.)
        },
      }),
    ],
    content: initialContent,
    contentType: 'markdown',
    autofocus: false, // Handle focus manually after DOM is ready
    onCreate: ({ editor }) => {
      // For new/empty notes, start with an h1 heading for the title
      if (!initialContent) {
        (editor as any).commands.setContent('# ', { contentType: 'markdown' });
        editor.commands.setTextSelection(1);
        editor.commands.focus();
      } else {
        // Delay focus until after browser has finished rendering
        requestAnimationFrame(() => focusAtContentEnd(editor));
      }
    },
    editorProps: {
      attributes: {
        id: 'note-editor',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Note content',
      },
    },
    onUpdate: ({ editor }) => {
      // Skip updates during init phase (TipTap normalizing markdown)
      if (isInitPhaseRef.current) return;

      // Debounce content changes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const markdown = normalizeMarkdown(editor.getMarkdown());
        if (markdown !== lastContentRef.current && markdown.length <= maxLength) {
          lastContentRef.current = markdown;
          onUpdate(markdown);
        }
      }, DEBOUNCE_MS);
    },
  });

  // Handle init phase (absorb Tiptap's markdown normalization)
  // Must exceed TipTap's debounce (see DEBOUNCE_MS)
  useEffect(() => {
    const timer = setTimeout(() => {
      isInitPhaseRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Update content when it changes externally
  useEffect(() => {
    const normalized = normalizeMarkdown(content);
    if (editor && normalized !== lastContentRef.current) {
      lastContentRef.current = normalized;
      isInitPhaseRef.current = true;

      if (normalized) {
        // Normalize before setting to prevent &nbsp; from rendering as literal text
        (editor as any).commands.setContent(normalized, { contentType: 'markdown' });
        // Delay focus until after browser has finished rendering the new content
        requestAnimationFrame(() => focusAtContentEnd(editor));
      } else {
        // New note: set h1 heading, focus at start
        (editor as any).commands.setContent('# ', { contentType: 'markdown' });
        editor.commands.setTextSelection(1);
        editor.commands.focus();
      }

      // Reset init phase after content is set
      setTimeout(() => {
        isInitPhaseRef.current = false;
      }, 400);
    }
  }, [editor, content]);

  // Flush pending changes and cleanup on unmount
  useEffect(() => {
    const editorInstance = editor;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Flush any pending changes before unmount
      if (editorInstance && !isInitPhaseRef.current) {
        const markdown = normalizeMarkdown(editorInstance.getMarkdown?.() ?? '');
        if (markdown && markdown !== lastContentRef.current && markdown.length <= maxLength) {
          onUpdateRef.current(markdown);
        }
      }
    };
  }, [editor, maxLength]);

  // Helper functions that were previously on the ref
  const toggleTaskList = () => editor?.chain().focus().toggleTaskList().run();
  const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
  const toggleHeading = (level: 1 | 2 | 3) =>
    editor?.chain().focus().toggleHeading({ level }).run();
  const setEditable = (editable: boolean) => {
    editor?.setEditable(editable);
    if (!editable) {
      editor?.commands.blur();
    }
  };
  const blur = () => editor?.commands.blur();
  const getMarkdown = () => {
    if (!editor) return '';
    return normalizeMarkdown(editor.getMarkdown() ?? '');
  };
  const setMarkdown = (markdown: string) => {
    if (!editor) return;
    const normalized = normalizeMarkdown(markdown);
    lastContentRef.current = normalized;
    (editor as any).commands.setContent(normalized, { contentType: 'markdown' });
    onUpdateRef.current(normalized);
  };

  return {
    editor,
    toggleTaskList,
    toggleBulletList,
    toggleHeading,
    setEditable,
    blur,
    getMarkdown,
    setMarkdown,
  };
}
