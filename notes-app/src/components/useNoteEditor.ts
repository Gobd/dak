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
  // Store the sanitized form so later comparisons against editor.getMarkdown()
  // (also sanitized) don't falsely flag the note as edited on mount/unmount.
  const lastContentRef = useRef(stripNbspFromListLines(content));
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
        // Let Tiptap keep the checkbox's new state in read-only mode. Doc
        // updates are handled by the handleDOMEvents.change hook below, which
        // looks up the node by DOM position (reliable across toggles) rather
        // than by the stale closure `node` Tiptap would pass here.
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

  // In view-only mode, Tiptap's default task-item handler only toggles the
  // DOM checkbox without updating the doc (so state isn't saved, "(N)"
  // doesn't update, and Delete-checked sees stale content). We attach a
  // capture-phase change listener on the editor's root to find the toggled
  // checkbox's taskItem by DOM index and dispatch setNodeMarkup ourselves.
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    const handler = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target || target.tagName !== 'INPUT' || target.type !== 'checkbox') return;
      if (editor.isEditable) return;
      // Walk up to the nearest <li>. TaskItem's nodeView puts the checkbox
      // inside <li><label><input/></label>…</li>; we don't match on
      // data-type because it isn't always set on the nodeView's bare <li>.
      const li = target.closest('li') as HTMLElement | null;
      if (!li) return;
      // Match by DOM order against taskItem nodes in the doc. Only count
      // <li>s that have a checkbox child (i.e. task items, not bullets).
      const allLis = Array.from(root.querySelectorAll<HTMLElement>('li')).filter((el) =>
        el.querySelector(':scope > label > input[type="checkbox"]'),
      );
      const liIndex = allLis.indexOf(li);
      if (liIndex < 0) return;
      const { state, view } = editor;
      let taskPos = -1;
      let taskNode: ReturnType<typeof state.doc.nodeAt> = null;
      let seen = 0;
      state.doc.descendants((n, p) => {
        if (taskPos >= 0) return false;
        if (n.type.name === 'taskItem') {
          if (seen === liIndex) {
            taskPos = p;
            taskNode = n;
            return false;
          }
          seen += 1;
        }
        return true;
      });
      if (!taskNode || taskPos < 0) return;
      view.dispatch(
        state.tr.setNodeMarkup(taskPos, undefined, {
          ...(taskNode as any).attrs,
          checked: target.checked,
        }),
      );
    };
    root.addEventListener('change', handler, true);
    return () => root.removeEventListener('change', handler, true);
  }, [editor]);

  // Handle init phase (absorb Tiptap's markdown normalization).
  // Must exceed TipTap's debounce (see DEBOUNCE_MS). Also captures the
  // editor's own normalized output as the "clean" baseline so an open+close
  // without edits doesn't fire a false save (which bumps updated_at and
  // reorders the note list).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (editorRef.current) {
        lastContentRef.current = stripNbspFromListLines(editorRef.current.getMarkdown?.() ?? '');
      }
      isInitPhaseRef.current = false;
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  // Update content when it changes externally
  useEffect(() => {
    if (!editor) return;
    const sanitized = stripNbspFromListLines(content);
    if (sanitized !== lastContentRef.current) {
      lastContentRef.current = sanitized;
      isInitPhaseRef.current = true;

      if (content) {
        (editor as any).commands.setContent(sanitized, { contentType: 'markdown' });
        // Delay focus until after browser has finished rendering the new content
        requestAnimationFrame(() => focusAtContentEnd(editor));
      } else {
        // New note: set h1 heading, focus at start
        (editor as any).commands.setContent('# ', { contentType: 'markdown' });
        editor.commands.setTextSelection(1);
        editor.commands.focus();
      }

      // Reset init phase after content is set, capturing the editor's
      // normalized output as the clean baseline (see init-phase effect).
      setTimeout(() => {
        if (editorRef.current) {
          lastContentRef.current = stripNbspFromListLines(editorRef.current.getMarkdown?.() ?? '');
        }
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
    // `setContent` is gated on editable=true. In view-only mode (e.g. the
    // "Delete checked lines" button used on a kiosk display) we need to
    // flip editable on for the write, then restore it.
    const wasEditable = editor.isEditable;
    if (!wasEditable) editor.setEditable(true);
    (editor as any).commands.setContent(sanitized, { contentType: 'markdown' });
    if (!wasEditable) {
      editor.setEditable(false);
      editor.commands.blur();
    }
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
