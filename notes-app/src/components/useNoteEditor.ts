import { useRef, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

// Tiptap's Paragraph extension emits `&nbsp;` as the markdown for an empty
// paragraph to preserve blank lines. Its own parser reverses that, but
// TaskItem/ListItem parsers do not — so an empty list line round-trips as
// literal "&nbsp;" text inside the list item. Strip it from list lines on
// load and before save so it never surfaces to the user.
const NBSP_IN_LIST_RE = /^(\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?)(?:&nbsp;| )\s*$/;
function stripNbspFromListLines(markdown: string): string {
  if (!markdown) return markdown;
  return markdown
    .split('\n')
    .map((line) => line.replace(NBSP_IN_LIST_RE, '$1'))
    .join('\n');
}

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

export function useNoteEditor({
  content,
  onUpdate,
  maxLength = 50000,
  placeholder = 'Start writing...',
}: UseNoteEditorOptions) {
  const lastContentRef = useRef(content);
  const isInitPhaseRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  // Keep ref updated with latest callback
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const initialContent = stripNbspFromListLines(content);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
        // Allow toggling checkboxes in read-only mode, and — unlike the default
        // which only flips the DOM checkbox — also update the underlying doc
        // so `getMarkdown()` reflects the change and "Delete checked" works.
        onReadOnlyChecked: (node, checked) => {
          const ed = editorRef.current;
          if (!ed) return false;
          const { state, view } = ed;
          let pos: number | null = null;
          state.doc.descendants((n, p) => {
            if (pos !== null) return false;
            if (n === node) {
              pos = p;
              return false;
            }
            return true;
          });
          if (pos === null) return false;
          view.dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked }));
          return true;
        },
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
      editorRef.current = editor;
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
      editorRef.current = editor;
      // Skip updates during init phase (TipTap normalizing markdown)
      if (isInitPhaseRef.current) return;

      // Debounce content changes
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const markdown = stripNbspFromListLines(editor.getMarkdown());
        if (markdown !== lastContentRef.current && markdown.length <= maxLength) {
          lastContentRef.current = markdown;
          onUpdate(markdown);
        }
      }, DEBOUNCE_MS);
    },
  });

  editorRef.current = editor;

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
    if (editor && content !== lastContentRef.current) {
      lastContentRef.current = content;
      isInitPhaseRef.current = true;

      if (content) {
        const sanitized = stripNbspFromListLines(content);
        (editor as any).commands.setContent(sanitized, { contentType: 'markdown' });
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
        const markdown = stripNbspFromListLines(editorInstance.getMarkdown?.() ?? '');
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
    return stripNbspFromListLines(editor.getMarkdown() ?? '');
  };
  const setMarkdown = (markdown: string) => {
    if (!editor) return;
    const sanitized = stripNbspFromListLines(markdown);
    lastContentRef.current = sanitized;
    (editor as any).commands.setContent(sanitized, { contentType: 'markdown' });
    onUpdateRef.current(sanitized);
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
