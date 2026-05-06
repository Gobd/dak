import type { Descendant } from 'slate';

// Slate node types we support. Everything else parses as plain text.
export type Heading = { type: 'heading'; level: 1 | 2 | 3; children: Inline[] };
export type Paragraph = { type: 'paragraph'; children: Inline[] };
export type BulletList = { type: 'bullet-list'; children: BulletItem[] };
export type BulletItem = { type: 'bullet-item'; children: Inline[] };
export type CheckList = { type: 'check-list'; children: CheckItem[] };
export type CheckItem = { type: 'check-item'; checked: boolean; children: Inline[] };

export type Block = Heading | Paragraph | BulletList | BulletItem | CheckList | CheckItem;

export type PlainText = { text: string; bold?: boolean };
export type Link = { type: 'link'; url: string; children: PlainText[] };
export type Inline = PlainText | Link;

export type EditorValue = (Heading | Paragraph | BulletList | CheckList)[];

const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*+]\s+(.*)$/;
const CHECK_RE = /^(\s*)[-*+]\s+\[([ xX])\]\s?(.*)$/;

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

// Single-pass tokenizer for inlines. Scans for the earliest `[label](url)` or
// `**bold**` and emits plain text between them. Bold inside link labels is not
// supported (links nest plain text only).
function parseInlines(text: string): Inline[] {
  if (!text) return [{ text: '' }];
  const nodes: Inline[] = [];
  let pos = 0;

  while (pos < text.length) {
    const boldStart = findDelim(text, pos, '**');
    const linkStart = findLinkStart(text, pos);

    let nextStart = -1;
    let kind: 'bold' | 'link' | null = null;
    if (boldStart >= 0 && (linkStart < 0 || boldStart < linkStart)) {
      nextStart = boldStart;
      kind = 'bold';
    } else if (linkStart >= 0) {
      nextStart = linkStart;
      kind = 'link';
    }

    if (kind === null) {
      nodes.push({ text: text.slice(pos) });
      break;
    }

    if (nextStart > pos) nodes.push({ text: text.slice(pos, nextStart) });

    if (kind === 'bold') {
      const close = findDelim(text, nextStart + 2, '**');
      if (close < 0) {
        // No closing delimiter — treat the `**` as literal text
        nodes.push({ text: text.slice(nextStart) });
        break;
      }
      const inner = text.slice(nextStart + 2, close);
      if (inner.length > 0) nodes.push({ text: inner, bold: true });
      pos = close + 2;
    } else {
      const m = text.slice(nextStart).match(/^\[([^\]]+)\]\(([^)]+)\)/);
      if (!m) {
        nodes.push({ text: text.slice(nextStart, nextStart + 1) });
        pos = nextStart + 1;
      } else {
        nodes.push({ type: 'link', url: m[2], children: [{ text: m[1] }] });
        pos = nextStart + m[0].length;
      }
    }
  }

  if (nodes.length === 0) nodes.push({ text: '' });
  return nodes;
}

function findDelim(text: string, from: number, delim: string): number {
  const idx = text.indexOf(delim, from);
  return idx;
}

function findLinkStart(text: string, from: number): number {
  // Only return an index that looks like the start of a well-formed link.
  for (let i = from; i < text.length; i += 1) {
    if (text[i] !== '[') continue;
    const rest = text.slice(i);
    if (/^\[([^\]]+)\]\(([^)]+)\)/.test(rest)) return i;
  }
  return -1;
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
      const t = c as PlainText;
      return t.bold && t.text.length > 0 ? `**${t.text}**` : t.text;
    })
    .join('');
}
