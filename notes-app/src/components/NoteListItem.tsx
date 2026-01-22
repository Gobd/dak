import { Pin, Lock, Users, CircleUser, SquareCheck, Square } from 'lucide-react';
import type { Note } from '../types/note';
import { getNoteTitle } from '../types/note';

interface NoteListItemProps {
  note: Note;
  isSelected: boolean;
  onClick: () => void;
  searchQuery?: string;
  selectionMode?: boolean;
  isChecked?: boolean;
  canSelect?: boolean;
}

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

function HighlightedText({ text, query, className }: HighlightedTextProps) {
  if (!query.trim()) {
    return <span className={`truncate ${className || ''}`}>{text}</span>;
  }

  const parts: { text: string; highlight: boolean }[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;

  let index = lowerText.indexOf(lowerQuery);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), highlight: false });
    }
    parts.push({ text: text.slice(index, index + query.length), highlight: true });
    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  return (
    <span className={`truncate ${className || ''}`}>
      {parts.map((part, i) =>
        part.highlight ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-300/50">
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = diffMs / (1000 * 60);
  const hours = diffMs / (1000 * 60 * 60);
  const days = diffMs / (1000 * 60 * 60 * 24);
  const weeks = days / 7;
  const months = days / 30;

  if (minutes < 1) {
    return 'just now';
  } else if (minutes < 60) {
    const m = Math.floor(minutes);
    return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  } else if (days < 7) {
    const d = Math.floor(days);
    return `${d} ${d === 1 ? 'day' : 'days'} ago`;
  } else if (weeks < 4) {
    const w = Math.round(weeks * 10) / 10;
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
  } else {
    const mo = Math.round(months * 10) / 10;
    return `${mo} ${mo === 1 ? 'month' : 'months'} ago`;
  }
}

export function NoteListItem({
  note,
  isSelected,
  onClick,
  searchQuery,
  selectionMode = false,
  isChecked = false,
  canSelect = true,
}: NoteListItemProps) {
  const title = getNoteTitle(note.content);
  const query = searchQuery?.trim() || '';
  const isSharedWithMe = !!note.owner_email;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 transition-colors ${
        isSelected && !selectionMode ? 'bg-zinc-200 dark:bg-zinc-800' : ''
      } ${selectionMode && !canSelect ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center flex-1 min-w-0 mr-2">
          {selectionMode && canSelect && (
            <span className="mr-2 flex-shrink-0">
              {isChecked ? (
                <SquareCheck size={18} className="text-amber-500" />
              ) : (
                <Square size={18} className="text-zinc-500" />
              )}
            </span>
          )}
          {note.pinned && <Pin size={12} className="mr-1 flex-shrink-0 text-amber-500" />}
          {isSharedWithMe ? (
            <CircleUser size={12} className="mr-1 flex-shrink-0 text-blue-500" />
          ) : note.is_private ? (
            <Lock size={12} className="mr-1 flex-shrink-0 text-zinc-500" />
          ) : (
            <Users size={12} className="mr-1 flex-shrink-0 text-zinc-500" />
          )}
          <HighlightedText
            text={title}
            query={query}
            className="font-medium text-base flex-1 min-w-0 text-zinc-950 dark:text-white"
          />
        </div>
        <span className="text-xs flex-shrink-0 text-zinc-500">
          {formatRelativeTime(note.updated_at)}
        </span>
      </div>
    </button>
  );
}
