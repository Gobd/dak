import React, { useEffect, useImperativeHandle, forwardRef } from 'react';
import type { EditorState } from 'lexical';
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  CLICK_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $getNearestNodeFromDOMNode,
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
import {
  ListItemNode,
  ListNode,
  $isListNode,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_CHECK_LIST_COMMAND,
} from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { $setBlocksType } from '@lexical/selection';
import {
  HEADING,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  CODE,
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
  CODE,
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
    ul: 'list-disc pl-5 mb-4',
    ol: 'list-decimal pl-5 mb-4',
    listitem: 'mb-1',
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
      const root = $getRoot();
      if (root.getTextContent() === '') {
        $convertFromMarkdownString(content, CUSTOM_TRANSFORMERS);
        $getRoot().selectEnd();
      }
    });
  }, [editor, content]);

  return null;
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(editable);
  }, [editor, editable]);
  return null;
}

function ReadOnlyCheckListPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      CLICK_COMMAND,
      (event: MouseEvent) => {
        if (editor.isEditable()) return false;

        const target = event.target as HTMLElement;
        if (target.tagName === 'LI') {
          const rect = target.getBoundingClientRect();
          const x = event.clientX - rect.left;
          if (x >= 0 && x <= 30) {
            editor.update(() => {
              const node = $getNearestNodeFromDOMNode(target);
              if (node instanceof ListItemNode) {
                const parent = node.getParent();
                if ($isListNode(parent) && parent.getListType() === 'check') {
                  node.toggleChecked();
                }
              }
            });
            return true;
          }
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor]);

  return null;
}

function EditorRefPlugin({ editorRef }: { editorRef: React.ForwardedRef<LexicalEditorHandle> }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(editorRef, () => ({
    blur: () => {
      editor.blur();
    },
    deleteCheckedItems: () => {
      const wasEditable = editor.isEditable();
      if (!wasEditable) editor.setEditable(true);
      editor.update(
        () => {
          const root = $getRoot();
          const itemsToRemove: ListItemNode[] = [];
          const dfs = (node: any) => {
            if (node.getType() === 'listitem' && node.getChecked()) {
              itemsToRemove.push(node);
            } else if (node.getChildren) {
              node.getChildren().forEach(dfs);
            }
          };
          root.getChildren().forEach(dfs);
          itemsToRemove.forEach((item) => item.remove());
        },
        {
          onUpdate: () => {
            if (!wasEditable) editor.setEditable(false);
          },
        },
      );
    },
    uncheckAll: () => {
      const wasEditable = editor.isEditable();
      if (!wasEditable) editor.setEditable(true);
      editor.update(
        () => {
          const root = $getRoot();
          const dfs = (node: any) => {
            if (node.getType() === 'listitem' && node.getChecked()) {
              node.setChecked(false);
            } else if (node.getChildren) {
              node.getChildren().forEach(dfs);
            }
          };
          root.getChildren().forEach(dfs);
        },
        {
          onUpdate: () => {
            if (!wasEditable) editor.setEditable(false);
          },
        },
      );
    },
    toggleCheckList: () => {
      editor.focus(() => {
        editor.update(
          () => {
            if (!$getSelection()) $getRoot().selectEnd();
          },
          { discrete: true },
        );
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      });
    },
    toggleHeading: (level: 1 | 2 | 3) => {
      editor.update(() => {
        let selection = $getSelection();
        if (!selection) {
          $getRoot().selectEnd();
          selection = $getSelection();
        }
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createHeadingNode(`h${level}` as HeadingTagType));
        }
      });
      editor.focus();
    },
    setParagraph: () => {
      editor.update(() => {
        let selection = $getSelection();
        if (!selection) {
          $getRoot().selectEnd();
          selection = $getSelection();
        }
        if ($isRangeSelection(selection)) {
          $setBlocksType(selection, () => $createParagraphNode());
        }
      });
      editor.focus();
    },
    toggleBulletList: () => {
      editor.focus(() => {
        editor.update(
          () => {
            if (!$getSelection()) $getRoot().selectEnd();
          },
          { discrete: true },
        );
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      });
    },
  }));

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
        CodeNode,
        CodeHighlightNode,
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
                <ContentEditable className="editor-input outline-none min-h-[150px] h-full" />
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
            <EditorRefPlugin editorRef={ref} />
          </div>
        </LexicalComposer>
      </div>
    );
  },
);
