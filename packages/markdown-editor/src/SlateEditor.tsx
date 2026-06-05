import { useCallback, useMemo, forwardRef, useImperativeHandle, useEffect, useRef } from 'react';
import {
  createEditor,
  Editor,
  Element as SlateElement,
  Node,
  Path,
  Range,
  Transforms,
  type Descendant,
} from 'slate';
import {
  Editable,
  ReactEditor,
  Slate,
  useSlateStatic,
  withReact,
  type RenderElementProps,
  type RenderLeafProps,
} from 'slate-react';
import { withHistory } from 'slate-history';
import { parseMarkdown, serializeMarkdown } from './markdown';
import type { CheckItem } from './markdown';
import type { CustomEditor, CustomElement } from './types';

export interface SlateEditorHandle {
  getMarkdown: () => string;
  setMarkdown: (md: string) => void;
  focus: () => void;
  blur: () => void;
  setEditable: (editable: boolean) => void;
  toggleCheckList: () => void;
  toggleBulletList: () => void;
  toggleHeading: (level: 1 | 2 | 3) => void;
  setParagraph: () => void;
  toggleBold: () => void;
  deleteCheckedItems: () => void;
  uncheckAll: () => void;
}

interface Props {
  initialMarkdown: string;
  onChange: (markdown: string) => void;
  editable: boolean;
  maxLength: number;
  placeholder?: string;
}

export const SlateEditor = forwardRef<SlateEditorHandle, Props>(function SlateEditor(
  { initialMarkdown, onChange, editable, maxLength, placeholder = 'Start writing...' },
  ref,
) {
  const editor = useMemo(() => withShortcuts(withHistory(withReact(createEditor()))), []);
  const initialValue = useMemo<Descendant[]>(() => {
    const parsed = parseMarkdown(initialMarkdown || '');
    return parsed.length > 0 ? parsed : [{ type: 'paragraph', children: [{ text: '' }] }];
  }, [initialMarkdown]);

  const lastEmittedRef = useRef(initialMarkdown);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // External markdown update (e.g. after a delete-all-checked on a different view)
  useEffect(() => {
    if (initialMarkdown === lastEmittedRef.current) return;
    const parsed = parseMarkdown(initialMarkdown || '');
    const next: Descendant[] =
      parsed.length > 0 ? parsed : [{ type: 'paragraph', children: [{ text: '' }] }];
    // Replace entire document contents
    editor.children = next;
    Transforms.deselect(editor);
    editor.onChange();
    lastEmittedRef.current = initialMarkdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMarkdown]);

  const handleChange = useCallback(
    (value: Descendant[]) => {
      // Skip if it's just a selection change
      const isAstChange = editor.operations.some((op) => op.type !== 'set_selection');
      if (!isAstChange) return;
      const md = serializeMarkdown(value);
      if (md === lastEmittedRef.current) return;
      if (md.length > maxLength) return;
      lastEmittedRef.current = md;
      onChangeRef.current(md);
    },
    [editor, maxLength],
  );

  const renderElement = useCallback(
    (props: RenderElementProps) => <ElementRenderer {...props} readOnly={!editable} />,
    [editable],
  );
  const renderLeaf = useCallback((props: RenderLeafProps) => <LeafRenderer {...props} />, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => handleKeyDown(editor, event),
    [editor],
  );

  // Focus at end of last non-empty block on mount. Users expect the cursor to
  // be right after the last real text so Enter creates a new list item, not
  // parked on an empty trailing paragraph.
  useEffect(() => {
    if (!editable) return;
    const raf = requestAnimationFrame(() => {
      focusAtContentEnd(editor);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getMarkdown: () => serializeMarkdown(editor.children),
    setMarkdown: (md) => {
      const parsed = parseMarkdown(md || '');
      const next: Descendant[] =
        parsed.length > 0 ? parsed : [{ type: 'paragraph', children: [{ text: '' }] }];
      editor.children = next;
      Transforms.deselect(editor);
      editor.onChange();
      lastEmittedRef.current = md;
      onChangeRef.current(md);
    },
    focus: () => ReactEditor.focus(editor),
    blur: () => ReactEditor.blur(editor),
    setEditable: () => {
      // Controlled by the `editable` prop — no-op to keep the same API.
    },
    toggleCheckList: () => toggleBlockList(editor, 'check-list', 'check-item'),
    toggleBulletList: () => toggleBlockList(editor, 'bullet-list', 'bullet-item'),
    toggleHeading: (level) => toggleHeading(editor, level),
    setParagraph: () => setParagraph(editor),
    toggleBold: () => toggleMark(editor, 'bold'),
    deleteCheckedItems: () => deleteCheckedItems(editor),
    uncheckAll: () => uncheckAll(editor),
  }));

  return (
    <Slate editor={editor} initialValue={initialValue} onChange={handleChange}>
      <Editable
        readOnly={!editable}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        className="slate-editor"
        spellCheck
        autoFocus={false}
        id="note-editor"
        role="textbox"
        aria-multiline="true"
        aria-label="Note content"
      />
    </Slate>
  );
});

// --- Rendering ---

function ElementRenderer({
  attributes,
  children,
  element,
  readOnly,
}: RenderElementProps & { readOnly: boolean }) {
  switch (element.type) {
    case 'heading':
      if (element.level === 1) return <h1 {...attributes}>{children}</h1>;
      if (element.level === 2) return <h2 {...attributes}>{children}</h2>;
      return <h3 {...attributes}>{children}</h3>;
    case 'paragraph':
      return <p {...attributes}>{children}</p>;
    case 'bullet-list':
      return (
        <ul {...attributes} className="bullet-list">
          {children}
        </ul>
      );
    case 'bullet-item':
      return <li {...attributes}>{children}</li>;
    case 'check-list':
      return (
        <ul {...attributes} className="check-list">
          {children}
        </ul>
      );
    case 'check-item':
      return (
        <CheckItemElement attributes={attributes} element={element}>
          {children}
        </CheckItemElement>
      );
    case 'link':
      return (
        <a
          {...attributes}
          href={element.url}
          target="_blank"
          rel="noreferrer"
          // Allow cmd/ctrl-click to open link even while editable
          onClick={(e) => {
            if (readOnly || e.metaKey || e.ctrlKey) {
              window.open(element.url, '_blank', 'noopener,noreferrer');
              e.preventDefault();
            }
          }}
        >
          {children}
        </a>
      );
  }
}

function CheckItemElement({
  attributes,
  element,
  children,
}: {
  attributes: RenderElementProps['attributes'];
  element: CheckItem;
  children: React.ReactNode;
}) {
  const editor = useSlateStatic();
  const handleToggle = () => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.setNodes<CheckItem>(editor, { checked: !element.checked }, { at: path });
  };
  return (
    <li {...attributes} className={element.checked ? 'is-checked' : ''}>
      <span contentEditable={false} className="check-box">
        <input type="checkbox" checked={element.checked} onChange={handleToggle} />
      </span>
      <span className="check-text">{children}</span>
    </li>
  );
}

function LeafRenderer({ attributes, children, leaf }: RenderLeafProps) {
  if (leaf.bold) return <strong {...attributes}>{children}</strong>;
  return <span {...attributes}>{children}</span>;
}

// --- Keyboard handling ---

function handleKeyDown(editor: CustomEditor, event: React.KeyboardEvent) {
  const { selection } = editor;
  if (!selection) return;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
    event.preventDefault();
    toggleMark(editor, 'bold');
    return;
  }

  if (event.key === 'Enter') {
    const [match] = Editor.nodes(editor, {
      match: (n) =>
        SlateElement.isElement(n) && (n.type === 'check-item' || n.type === 'bullet-item'),
    });
    if (match) {
      const [node] = match;
      const isEmpty = Node.string(node).length === 0;
      if (isEmpty) {
        // Exit the list: lift the item out and convert to paragraph
        event.preventDefault();
        Transforms.unwrapNodes(editor, {
          match: (n) =>
            SlateElement.isElement(n) && (n.type === 'check-list' || n.type === 'bullet-list'),
          split: true,
        });
        Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
        return;
      }
      // Split into a new item of the same type. For check items force unchecked.
      event.preventDefault();
      Transforms.splitNodes(editor, { always: true });
      if (SlateElement.isElement(node) && node.type === 'check-item') {
        Transforms.setNodes(editor, { checked: false } as Partial<CheckItem>);
      }
      return;
    }
    // Enter at end of a heading breaks to a paragraph so you don't keep typing in the heading
    const [headingMatch] = Editor.nodes(editor, {
      match: (n) => SlateElement.isElement(n) && n.type === 'heading',
    });
    if (headingMatch) {
      const [, path] = headingMatch;
      const end = Editor.end(editor, path);
      if (
        Range.isCollapsed(selection) &&
        selection.anchor.offset === end.offset &&
        selection.anchor.path.join(',') === end.path.join(',')
      ) {
        event.preventDefault();
        Transforms.insertNodes(editor, { type: 'paragraph', children: [{ text: '' }] });
        return;
      }
    }
  }

  if (event.key === 'Backspace') {
    if (!Range.isCollapsed(selection)) return;
    const { offset } = selection.anchor;
    if (offset !== 0) return;
    // At the start of a block. If it's a list item or heading, convert to paragraph.
    const [match] = Editor.nodes(editor, {
      match: (n) =>
        SlateElement.isElement(n) &&
        (n.type === 'check-item' || n.type === 'bullet-item' || n.type === 'heading'),
    });
    if (!match) return;
    const [node] = match;
    event.preventDefault();
    if (
      SlateElement.isElement(node) &&
      (node.type === 'check-item' || node.type === 'bullet-item')
    ) {
      Transforms.unwrapNodes(editor, {
        match: (n) =>
          SlateElement.isElement(n) && (n.type === 'check-list' || n.type === 'bullet-list'),
        split: true,
      });
      Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
    } else {
      // heading
      Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
    }
    return;
  }
}

// --- Markdown shortcuts (typed-character transforms) ---

function withShortcuts(editor: CustomEditor): CustomEditor {
  const { insertText, insertData } = editor;

  editor.insertText = (text) => {
    const { selection } = editor;
    if (text.endsWith(' ') && selection && Range.isCollapsed(selection)) {
      const { anchor } = selection;
      const block = Editor.above(editor, {
        match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
      });
      const path = block ? block[1] : [];
      const start = Editor.start(editor, path);
      const range = { anchor, focus: start };
      const before = Editor.string(editor, range) + text.slice(0, -1);

      // Heading shortcuts: #, ##, ###
      const headingMatch = before.match(/^(#{1,3})$/);
      if (headingMatch) {
        Transforms.select(editor, range);
        if (!Range.isCollapsed(editor.selection!)) Transforms.delete(editor);
        Transforms.setNodes(
          editor,
          { type: 'heading', level: headingMatch[1].length as 1 | 2 | 3 } as Partial<CustomElement>,
          { match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n) },
        );
        return;
      }

      // Checklist shortcut: "- [ ]" or "- [x]" or "-[]" (forgiving)
      const checkMatch = before.match(/^[-*+]\s*\[([ xX])?\]$/);
      if (checkMatch) {
        Transforms.select(editor, range);
        if (!Range.isCollapsed(editor.selection!)) Transforms.delete(editor);
        const checked = (checkMatch[1] || '').toLowerCase() === 'x';
        Transforms.setNodes(editor, { type: 'check-item', checked } as Partial<CustomElement>, {
          match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
        });
        Transforms.wrapNodes(editor, { type: 'check-list', children: [] } as CustomElement, {
          match: (n) => SlateElement.isElement(n) && n.type === 'check-item',
        });
        return;
      }

      // Inline bold shortcut: "**word**" (just triggered by trailing space after close)
      const boldMatch = before.match(/\*\*([^*]+)\*\*$/);
      if (boldMatch) {
        const startOffset = before.length - boldMatch[0].length;
        const boldRange = {
          anchor: { path: anchor.path, offset: startOffset },
          focus: anchor,
        };
        Transforms.select(editor, boldRange);
        Transforms.delete(editor);
        Transforms.insertNodes(editor, { text: boldMatch[1], bold: true });
        // Insert a trailing space as plain text so the user doesn't stay bold
        Transforms.insertNodes(editor, { text: ' ' });
        return;
      }

      // Bullet shortcut: "-" or "*" or "+"
      if (/^[-*+]$/.test(before)) {
        Transforms.select(editor, range);
        if (!Range.isCollapsed(editor.selection!)) Transforms.delete(editor);
        Transforms.setNodes(editor, { type: 'bullet-item' } as Partial<CustomElement>, {
          match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
        });
        Transforms.wrapNodes(editor, { type: 'bullet-list', children: [] } as CustomElement, {
          match: (n) => SlateElement.isElement(n) && n.type === 'bullet-item',
        });
        return;
      }
    }
    insertText(text);
  };

  // Strip formatting on paste — only allow plain text (and parse markdown-ish content)
  editor.insertData = (data) => {
    const text = data.getData('text/plain');
    if (text) {
      // If pasted text looks like markdown (multi-line with recognizable syntax), parse it.
      // Otherwise insert as plain text so we don't accidentally transform casual pastes.
      const lines = text.split('\n');
      const looksLikeMarkdown = lines.some((l) => /^(#{1,3}\s|[-*+]\s(\[[ xX]\]\s)?)/.test(l));
      if (looksLikeMarkdown && lines.length > 1) {
        const parsed = parseMarkdown(text);
        Transforms.insertFragment(editor, parsed as Descendant[]);
        return;
      }
      Transforms.insertText(editor, text);
      return;
    }
    insertData(data);
  };

  // Allowlist normalizer: any element type not in our set becomes paragraph;
  // any text mark other than 'text' is stripped. Cheap belt-and-suspenders.
  const { normalizeNode } = editor;
  const allowedElements = new Set([
    'heading',
    'paragraph',
    'bullet-list',
    'bullet-item',
    'check-list',
    'check-item',
    'link',
  ]);
  editor.normalizeNode = (entry) => {
    const [node, path] = entry;
    if (SlateElement.isElement(node) && !allowedElements.has(node.type)) {
      Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>, { at: path });
      return;
    }
    // Strip unknown marks off text nodes
    if (!SlateElement.isElement(node) && 'text' in node) {
      const knownKeys = new Set(['text', 'bold']);
      const extra = Object.keys(node).filter((k) => !knownKeys.has(k));
      if (extra.length > 0) {
        const clean: Record<string, unknown> = {};
        for (const k of extra) clean[k] = null;
        Transforms.setNodes(editor, clean, { at: path, match: (n) => n === node });
        return;
      }
    }
    normalizeNode(entry);
  };

  return editor;
}

// --- Toolbar commands ---

function toggleBlockList(
  editor: CustomEditor,
  listType: 'check-list' | 'bullet-list',
  itemType: 'check-item' | 'bullet-item',
) {
  const [match] = Editor.nodes(editor, {
    match: (n) => SlateElement.isElement(n) && n.type === itemType,
  });
  if (match) {
    // Already a list item of this type -> unwrap
    Transforms.unwrapNodes(editor, {
      match: (n) => SlateElement.isElement(n) && n.type === listType,
      split: true,
    });
    Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
    return;
  }
  // Not in this list; convert current block
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) && (n.type === 'check-list' || n.type === 'bullet-list'),
    split: true,
  });
  const setProps: Partial<CustomElement> =
    itemType === 'check-item'
      ? ({ type: 'check-item', checked: false } as Partial<CustomElement>)
      : ({ type: 'bullet-item' } as Partial<CustomElement>);
  Transforms.setNodes(editor, setProps, {
    match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
  Transforms.wrapNodes(editor, { type: listType, children: [] } as CustomElement, {
    match: (n) => SlateElement.isElement(n) && n.type === itemType,
  });
}

function toggleHeading(editor: CustomEditor, level: 1 | 2 | 3) {
  const [match] = Editor.nodes(editor, {
    match: (n) => SlateElement.isElement(n) && n.type === 'heading' && n.level === level,
  });
  if (match) {
    Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>);
    return;
  }
  // Unwrap any list first so the block can become a heading
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) && (n.type === 'check-list' || n.type === 'bullet-list'),
    split: true,
  });
  Transforms.setNodes(editor, { type: 'heading', level } as Partial<CustomElement>, {
    match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
}

function setParagraph(editor: CustomEditor) {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      SlateElement.isElement(n) && (n.type === 'check-list' || n.type === 'bullet-list'),
    split: true,
  });
  Transforms.setNodes(editor, { type: 'paragraph' } as Partial<CustomElement>, {
    match: (n) => SlateElement.isElement(n) && Editor.isBlock(editor, n),
  });
}

function deleteCheckedItems(editor: CustomEditor) {
  // Collect checked paths top-down, delete bottom-up so paths stay valid
  const paths: Path[] = [];
  for (const [node, path] of Node.nodes(editor)) {
    if (SlateElement.isElement(node) && node.type === 'check-item' && node.checked) {
      paths.push(path);
    }
  }
  paths.sort((a, b) => Path.compare(b, a));
  Editor.withoutNormalizing(editor, () => {
    for (const path of paths) {
      Transforms.removeNodes(editor, { at: path });
    }
  });
}

function toggleMark(editor: CustomEditor, mark: 'bold') {
  const marks = Editor.marks(editor);
  const isActive = marks ? (marks as Record<string, unknown>)[mark] === true : false;
  if (isActive) {
    Editor.removeMark(editor, mark);
  } else {
    Editor.addMark(editor, mark, true);
  }
}

function focusAtContentEnd(editor: CustomEditor) {
  ReactEditor.focus(editor);
  // Find the last leaf path in the document with non-empty text, else the very last leaf.
  let target: Path | null = null;
  let lastLeaf: Path | null = null;
  for (const [node, path] of Node.nodes(editor)) {
    if (!SlateElement.isElement(node) && 'text' in node) {
      lastLeaf = path;
      if (node.text.length > 0) target = path;
    }
  }
  const chosen = target ?? lastLeaf;
  if (!chosen) return;
  const leaf = Node.get(editor, chosen) as { text: string };
  const end = { path: chosen, offset: leaf.text.length };
  Transforms.select(editor, { anchor: end, focus: end });
}

function uncheckAll(editor: CustomEditor) {
  Editor.withoutNormalizing(editor, () => {
    for (const [node, path] of Node.nodes(editor)) {
      if (SlateElement.isElement(node) && node.type === 'check-item' && node.checked) {
        Transforms.setNodes<CheckItem>(editor, { checked: false }, { at: path });
      }
    }
  });
}
