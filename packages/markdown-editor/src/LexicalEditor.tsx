import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import type { EditorState } from 'lexical';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getNearestNodeFromDOMNode,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  KEY_BACKSPACE_COMMAND,
  KEY_ENTER_COMMAND,
} from 'lexical';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { HeadingNode, QuoteNode, $createHeadingNode } from '@lexical/rich-text';
import type { HeadingTagType } from '@lexical/rich-text';
import { ListItemNode, ListNode, $insertList } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import {
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  $convertToMarkdownString,
  $convertFromMarkdownString,
} from '@lexical/markdown';
import './editor-styles.css';

const CUSTOM_CHECK_LIST = {
  ...CHECK_LIST,
  // Accepts "- [ ] text", "* [ ] text", and bare "[ ] text" (for corrupted data recovery).
  // Must come before UNORDERED_LIST in CUSTOM_TRANSFORMERS so "- [ ] text" isn't
  // consumed as a bullet point before we can recognise it as a checklist item.
  regExp: /^(\s*)(?:[-*+]\s)?\s?(\[(\s|x)?\])\s/i,
  replace: (
    parentNode: Parameters<typeof CHECK_LIST.replace>[0],
    children: Parameters<typeof CHECK_LIST.replace>[1],
    match: Parameters<typeof CHECK_LIST.replace>[2],
    isImport: Parameters<typeof CHECK_LIST.replace>[3],
  ) => {
    const updatedMatch = [...match] as typeof match;
    if (updatedMatch[3] === undefined) updatedMatch[3] = ' ';
    return CHECK_LIST.replace(parentNode, children, updatedMatch, isImport);
  },
};

const CUSTOM_TRANSFORMERS = [
  HEADING,
  QUOTE,
  CUSTOM_CHECK_LIST,
  UNORDERED_LIST,
  ORDERED_LIST,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

export interface LexicalEditorHandle {
  blur: () => void;
  deleteCheckedItems: () => void;
  uncheckAll: () => void;
  toggleCheckList: () => void;
  toggleHeading: (level: 1 | 2 | 3) => void;
  setParagraph: () => void;
  toggleBulletList: () => void;
}

export interface LexicalEditorProps {
  content: string;
  onChange: (value: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const theme = {
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
  },
  heading: {
    h1: 'text-2xl font-bold mb-4',
    h2: 'text-xl font-bold mb-3',
    h3: 'text-lg font-bold mb-2',
  },
  list: {
    ul: 'lexical-ul',
    ol: 'lexical-ol',
    listitem: 'lexical-listitem',
    checklist: 'lexical-checklist',
    listitemChecked: 'lexical-list-item-checked',
    listitemUnchecked: 'lexical-list-item-unchecked',
  },
  quote: 'border-l-4 border-gray-300 pl-4 italic text-gray-600 mb-4',
  code: 'bg-gray-100 p-2 rounded font-mono text-sm block mb-4',
};

function MarkdownPlugin({ content }: { content: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editor.update(() => {
      $convertFromMarkdownString(content, CUSTOM_TRANSFORMERS);
      $getRoot().selectEnd();
    });
    // intentionally run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

function OskPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const handler = (e: Event) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      e.preventDefault();
      editor.focus();
      if (text === '\n') {
        editor.dispatchCommand(INSERT_LINE_BREAK_COMMAND, false);
      } else if (text === '\n\n') {
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
      } else if (text === 'Backspace') {
        editor.dispatchCommand(
          KEY_BACKSPACE_COMMAND,
          new KeyboardEvent('keydown', { key: 'Backspace' }),
        );
      } else if (text === 'Enter') {
        editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent('keydown', { key: 'Enter' }));
      } else {
        editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, text);
      }
    };

    root.addEventListener('osk-insert', handler);
    return () => root.removeEventListener('osk-insert', handler);
  }, [editor]);

  return null;
}

function ReadOnlyCheckListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (editor.isEditable()) return;

      const target = event.target as HTMLElement;
      if (target.tagName !== 'LI') return;

      // @ts-ignore internal field
      if (target.parentNode?.__lexicalListType !== 'check') return;

      const rect = target.getBoundingClientRect();
      const beforeWidth = parseFloat(window.getComputedStyle(target, '::before').width || '16');
      const x = event.clientX - rect.left;
      if (x >= 0 && x < beforeWidth + 4) {
        editor.update(() => {
          const node = $getNearestNodeFromDOMNode(target);
          if (node instanceof ListItemNode) {
            node.toggleChecked();
          }
        });
      }
    };

    return editor.registerRootListener((rootElement: HTMLElement | null) => {
      rootElement?.addEventListener('click', handleClick);
      return () => rootElement?.removeEventListener('click', handleClick);
    });
  }, [editor]);

  return null;
}

function EditorRefPlugin({ editorRef }: { editorRef: React.ForwardedRef<LexicalEditorHandle> }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(editorRef, () => {
    const withSelection = (fn: () => void) => {
      editor.update(() => {
        if (!$getSelection()) $getRoot().selectEnd();
        fn();
      });
      editor.focus();
    };

    const forEachCheckedItem = (cb: (node: ListItemNode) => void) => {
      const visit = (node: any) => {
        if (node.getType() === 'listitem' && node.getChecked()) {
          cb(node);
        } else {
          node.getChildren?.().forEach(visit);
        }
      };
      $getRoot().getChildren().forEach(visit);
    };

    return {
      blur: () => editor.blur(),
      deleteCheckedItems: () => {
        editor.update(() => {
          const toRemove: ListItemNode[] = [];
          forEachCheckedItem((node) => toRemove.push(node));
          toRemove.forEach((node) => node.remove());
        });
      },
      uncheckAll: () => {
        editor.update(() => forEachCheckedItem((node) => node.setChecked(false)));
      },
      toggleCheckList: () => withSelection(() => $insertList('check')),
      toggleBulletList: () => withSelection(() => $insertList('bullet')),
      toggleHeading: (level: 1 | 2 | 3) =>
        withSelection(() =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createHeadingNode(`h${level}` as HeadingTagType));
            }
          }),
        ),
      setParagraph: () =>
        withSelection(() =>
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              $setBlocksType(selection, () => $createParagraphNode());
            }
          }),
        ),
    };
  });

  return null;
}

export const LexicalEditor = forwardRef<LexicalEditorHandle, LexicalEditorProps>(
  ({ content, onChange, placeholder = 'Type here...', editable = true }, ref) => {
    const initialConfig = {
      namespace: 'DakEditor',
      theme,
      editable,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListItemNode,
        ListNode,
        AutoLinkNode,
        LinkNode,
      ],
      onError: (error: Error) => {
        console.error(error);
      },
    };

    const handleEditorChange = (editorState: EditorState) => {
      editorState.read(() => {
        const markdown = $convertToMarkdownString(CUSTOM_TRANSFORMERS);
        onChange(markdown);
      });
    };

    return (
      <div className="lexical-editor-container h-full">
        <LexicalComposer initialConfig={initialConfig}>
          <div className="editor-inner relative h-full">
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  id="lexical-editor"
                  className="editor-input outline-none min-h-[150px] h-full"
                />
              }
              placeholder={
                <div className="editor-placeholder absolute top-0 left-0 text-gray-400 pointer-events-none">
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <CheckListPlugin />
            <MarkdownShortcutPlugin transformers={CUSTOM_TRANSFORMERS} />
            <OnChangePlugin onChange={handleEditorChange} ignoreSelectionChange />
            <MarkdownPlugin content={content} />
            <EditablePlugin editable={editable} />
            <ReadOnlyCheckListPlugin />
            <OskPlugin />
            <EditorRefPlugin editorRef={ref} />
          </div>
        </LexicalComposer>
      </div>
    );
  },
);
