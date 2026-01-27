import { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import './tiptap-styles.css';

// Strip trailing whitespace, newlines, and &nbsp; entities that create empty paragraphs
function trimTrailingEmpty(str: string): string {
  return str.replace(/(\s|&nbsp;|\u00A0)+$/g, '');
}

// Focus at end of actual content, skipping empty trailing paragraphs that TipTap creates
function focusAtContentEnd(editor: ReturnType<typeof useEditor>): void {
  if (!editor) return;
  const { doc } = editor.state;
  const lastChild = doc.lastChild;
  if (lastChild?.type.name === 'paragraph' && lastChild.textContent === '') {
    const targetPos = doc.content.size - lastChild.nodeSize - 1;
    editor.commands.setTextSelection(targetPos);
    editor.commands.focus();
  } else {
    editor.commands.focus('end');
  }
}

export interface RichNoteEditorRef {
  toggleTaskList: () => void;
  toggleBulletList: () => void;
  toggleHeading: (level: 1 | 2 | 3) => void;
  setEditable: (editable: boolean) => void;
  blur: () => void;
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
}

interface RichNoteEditorProps {
  content: string; // markdown content
  onUpdate: (content: string) => void; // returns markdown
  maxLength?: number;
  placeholder?: string;
}

// Debounce delay for content changes
const DEBOUNCE_MS = 300;

export const RichNoteEditor = forwardRef<RichNoteEditorRef, RichNoteEditorProps>(
  function RichNoteEditor(
    { content, onUpdate, maxLength = 50000, placeholder = 'Start writing...' },
    ref,
  ) {
    const lastContentRef = useRef(trimTrailingEmpty(content));
    const isInitPhaseRef = useRef(true);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onUpdateRef = useRef(onUpdate);

    // Keep ref updated with latest callback
    useEffect(() => {
      onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const initialContent = trimTrailingEmpty(content);

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
      autofocus: 'end',
      onCreate: ({ editor }) => focusAtContentEnd(editor),
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
          const markdown = trimTrailingEmpty(editor.getMarkdown());
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
      // Trim trailing whitespace so focus('end') lands on actual text, not an empty line
      const trimmedContent = trimTrailingEmpty(content);
      if (editor && trimmedContent !== lastContentRef.current) {
        lastContentRef.current = trimmedContent;
        isInitPhaseRef.current = true;

        if (trimmedContent) {
          (editor as any).commands.setContent(trimmedContent, { contentType: 'markdown' });
          focusAtContentEnd(editor);
        } else {
          (editor as any).commands.setContent('# ', { contentType: 'markdown' });
          editor.commands.setTextSelection(1);
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
          const markdown = trimTrailingEmpty(editorInstance.getMarkdown?.() ?? '');
          if (markdown && markdown !== lastContentRef.current && markdown.length <= maxLength) {
            onUpdateRef.current(markdown);
          }
        }
      };
    }, [editor, maxLength]);

    // Expose editor methods via ref
    useImperativeHandle(
      ref,
      () => ({
        toggleTaskList: () => editor?.chain().focus().toggleTaskList().run(),
        toggleBulletList: () => editor?.chain().focus().toggleBulletList().run(),
        toggleHeading: (level: 1 | 2 | 3) => editor?.chain().focus().toggleHeading({ level }).run(),
        setEditable: (editable: boolean) => {
          editor?.setEditable(editable);
          if (!editable) {
            editor?.commands.blur();
          }
        },
        blur: () => editor?.commands.blur(),
        getMarkdown: () => {
          if (!editor) return '';
          return trimTrailingEmpty(editor.getMarkdown() ?? '');
        },
        setMarkdown: (markdown: string) => {
          if (!editor) return;
          const trimmed = trimTrailingEmpty(markdown);
          lastContentRef.current = trimmed;
          (editor as any).commands.setContent(trimmed, { contentType: 'markdown' });
          onUpdateRef.current(trimmed);
        },
      }),
      [editor],
    );

    return (
      <div className="flex-1 min-h-0 overflow-auto editor-scroll-container bg-surface">
        <EditorContent editor={editor} className="tiptap-editor h-full" />
      </div>
    );
  },
);
