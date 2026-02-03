import { useRef, useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

interface UseRecipeEditorOptions {
  content: string;
  onUpdate: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const DEBOUNCE_MS = 300;

export function useRecipeEditor({
  content,
  onUpdate,
  placeholder = 'Add recipe notes, ingredients, instructions...',
  editable = true,
}: UseRecipeEditorOptions) {
  const lastContentRef = useRef(content);
  const isInitPhaseRef = useRef(true);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({
        nested: true,
        onReadOnlyChecked: () => true,
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({
        markedOptions: { gfm: true },
      }),
    ],
    content,
    contentType: 'markdown',
    editable,
    autofocus: false,
    editorProps: {
      attributes: {
        class: 'recipe-editor-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Recipe notes',
      },
    },
    onUpdate: ({ editor }) => {
      if (isInitPhaseRef.current) return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const markdown = editor.getMarkdown();
        if (markdown !== lastContentRef.current) {
          lastContentRef.current = markdown;
          onUpdateRef.current(markdown);
        }
      }, DEBOUNCE_MS);
    },
  });

  // Handle init phase
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

      (editor as any).commands.setContent(content || '', { contentType: 'markdown' });

      setTimeout(() => {
        isInitPhaseRef.current = false;
      }, 400);
    }
  }, [editor, content]);

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Cleanup on unmount
  useEffect(() => {
    const editorInstance = editor;
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (editorInstance && !isInitPhaseRef.current) {
        const markdown = editorInstance.getMarkdown?.() ?? '';
        if (markdown && markdown !== lastContentRef.current) {
          onUpdateRef.current(markdown);
        }
      }
    };
  }, [editor]);

  const getMarkdown = () => editor?.getMarkdown() ?? '';

  const setMarkdown = (markdown: string) => {
    if (!editor) return;
    lastContentRef.current = markdown;
    (editor as any).commands.setContent(markdown, { contentType: 'markdown' });
    onUpdateRef.current(markdown);
  };

  return {
    editor,
    getMarkdown,
    setMarkdown,
  };
}
