import type { Descendant } from 'slate';

// Slate node types we support. Everything else parses as plain text.
export type Heading = { type: 'heading'; level: 1 | 2 | 3; children: Inline[] };
export type Paragraph = { type: 'paragraph'; children: Inline[] };
export type BulletList = { type: 'bullet-list'; children: BulletItem[] };
export type BulletItem = { type: 'bullet-item'; children: Inline[] };
export type CheckList = { type: 'check-list'; children: CheckItem[] };
export type CheckItem = { type: 'check-item'; checked: boolean; children: Inline[] };

export type Block = Heading | Paragraph | BulletList | BulletItem | CheckList | CheckItem;

export type PlainText = { text: string };
export type Link = { type: 'link'; url: string; children: PlainText[] };
export type Inline = PlainText | Link;

export type EditorValue = (Heading | Paragraph | BulletList | CheckList)[];

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const CHECK_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s?(.*)$/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function parseMarkdown(md: string): EditorValue {
  const lines = md.split('\n');
  const out: EditorValue = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check items first (before bullets, since checks match bullet too)
    const checkMatch = line.match(CHECK_RE);
    if (checkMatch) {
      const items: CheckItem[] = [];
      while (i < lines.length) {
        const m = lines[i].match(CHECK_RE);
        if (!m) break;
        items.push({
          type: 'check-item',
          checked: m[2].toLowerCase() === 'x',
          children: parseInlines(m[3]),
        });
        i += 1;
      }
      out.push({ type: 'check-list', children: items });
      continue;
    }

    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      const items: BulletItem[] = [];
      while (i < lines.length) {
        // Stop if it becomes a check item
        if (lines[i].match(CHECK_RE)) break;
        const m = lines[i].match(BULLET_RE);
        if (!m) break;
        items.push({ type: 'bullet-item', children: parseInlines(m[2]) });
        i += 1;
      }
      out.push({ type: 'bullet-list', children: items });
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      out.push({ type: 'heading', level, children: parseInlines(headingMatch[2]) });
      i += 1;
      continue;
    }

    // Paragraph (possibly empty). Blank lines stay as empty paragraphs so
    // blank-line intent round-trips.
    out.push({ type: 'paragraph', children: parseInlines(line) });
    i += 1;
  }

  if (out.length === 0) out.push({ type: 'paragraph', children: [{ text: '' }] });
  return out;
}

function parseInlines(text: string): Inline[] {
  if (!text) return [{ text: '' }];
  const nodes: Inline[] = [];
  let lastEnd = 0;
  LINK_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(text)) !== null) {
    if (m.index > lastEnd) nodes.push({ text: text.slice(lastEnd, m.index) });
    nodes.push({ type: 'link', url: m[2], children: [{ text: m[1] }] });
    lastEnd = m.index + m[0].length;
  }
  if (lastEnd < text.length) nodes.push({ text: text.slice(lastEnd) });
  if (nodes.length === 0) nodes.push({ text: '' });
  return nodes;
}

export function serializeMarkdown(value: Descendant[]): string {
  const lines: string[] = [];
  for (const node of value as EditorValue) {
    switch (node.type) {
      case 'heading':
        lines.push(`${'#'.repeat(node.level)} ${serializeInlines(node.children)}`);
        break;
      case 'paragraph':
        lines.push(serializeInlines(node.children));
        break;
      case 'bullet-list':
        for (const item of node.children) {
          lines.push(`- ${serializeInlines(item.children)}`);
        }
        break;
      case 'check-list':
        for (const item of node.children) {
          lines.push(`- [${item.checked ? 'x' : ' '}] ${serializeInlines(item.children)}`);
        }
        break;
    }
  }
  return lines.join('\n');
}

function serializeInlines(children: Inline[]): string {
  return children
    .map((c) => {
      if ('type' in c && c.type === 'link') {
        const label = c.children.map((t) => t.text).join('');
        return `[${label}](${c.url})`;
      }
      return (c as PlainText).text;
    })
    .join('');
}
