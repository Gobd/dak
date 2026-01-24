import { ConfirmModal } from '@dak/ui';
import { useToggle } from '@dak/hooks';
import { NoteSharing } from './NoteSharing';
import { RichNoteEditor, type RichNoteEditorRef } from './RichNoteEditor';
import { useUserStore } from '../stores/user-store';
import type { Note, NoteUpdate } from '../types/note';
import type { Tag } from '../types/tag';
import {
  ChevronDown,
  ChevronLeft,
  Copy,
  Hash,
  Eye,
  EyeOff,
  Heading,
  List,
  Lock,
  LockOpen,
  Pin,
  SquareCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';

const MAX_TAG_NAME_LENGTH = 30;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'long' });
  } else {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

interface NoteEditorProps {
  note: Note;
  onUpdate: (updates: NoteUpdate) => void;
  onBack?: () => void;
  onTrash?: () => void;
  tags?: Tag[];
  noteTags?: Tag[];
  onAddTag?: (tagId: string) => void;
  onRemoveTag?: (tagId: string) => void;
  onCreateTag?: (name: string) => void;
}

export function NoteEditor({
  note,
  onUpdate,
  onBack,
  onTrash,
  tags = [],
  noteTags = [],
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: NoteEditorProps) {
  const { planLimits } = useUserStore();
  const editorRef = useRef<RichNoteEditorRef>(null);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;

  const showTagPicker = useToggle(false);
  const [newTagName, setNewTagName] = useState('');
  const [copied, setCopied] = useState(false);
  const isReadOnly = useToggle(false);
  const showHeadingDropdown = useToggle(false);
  const showCheckboxDropdown = useToggle(false);
  const showDeleteCheckedConfirm = useToggle(false);
  const showUncheckAllConfirm = useToggle(false);

  const maxContentLength = planLimits.maxNoteLength;

  const handleCopyMarkdown = async () => {
    if (note.content) {
      await navigator.clipboard.writeText(note.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleContentUpdate = (content: string) => {
    onUpdate({ content });
  };

  const handleCreateTag = () => {
    const trimmed = newTagName.trim();
    if (trimmed && trimmed.length <= MAX_TAG_NAME_LENGTH && onCreateTag) {
      onCreateTag(trimmed);
      setNewTagName('');
    }
  };

  const handleDeleteCheckedTasks = () => {
    const markdown = editorRef.current?.getMarkdown() || '';
    if (!markdown) return;
    const lines = markdown.split('\n');
    const filtered = lines.filter((line) => !line.match(/^(\s*[-*]?\s*)?\[x\]/i));
    const newContent = filtered.join('\n');
    if (newContent !== markdown) {
      editorRef.current?.setMarkdown(newContent);
    }
  };

  const handleUncheckAll = () => {
    const markdown = editorRef.current?.getMarkdown() || '';
    if (!markdown) return;
    const newContent = markdown.replace(/\[x\]/gi, '[ ]');
    if (newContent !== markdown) {
      editorRef.current?.setMarkdown(newContent);
    }
  };

  const isTagNameOverLimit = newTagName.trim().length > MAX_TAG_NAME_LENGTH;
  const availableTags = tags.filter((t) => !noteTags.some((nt) => nt.id === t.id));

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="border-b py-2 relative z-10 border-border">
        <div className="flex items-center gap-2 px-4 flex-wrap">
          {/* Back Button (narrow view) */}
          {onBack && (
            <button
              onClick={() => {
                editorRef.current?.blur();
                setTimeout(onBack, 50);
              }}
              className="flex items-center py-1.5 pr-2 -ml-1 flex-shrink-0 text-warning"
            >
              <ChevronLeft size={20} />
              <span className="text-sm">Back</span>
            </button>
          )}
          {/* Pinned Toggle */}
          <button
            onClick={() => onUpdate({ pinned: !note.pinned })}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md flex-shrink-0 ${
              note.pinned ? 'bg-warning/20 dark:bg-warning/20' : 'bg-surface-sunken'
            }`}
          >
            <Pin size={16} className={note.pinned ? 'text-warning' : 'text-text-muted'} />
            {!isNarrow && (
              <span className={`text-sm ${note.pinned ? 'text-warning' : 'text-text-muted'}`}>
                {note.pinned ? 'Pinned' : 'Pin'}
              </span>
            )}
          </button>

          {/* Private Toggle */}
          <button
            onClick={() => onUpdate({ is_private: !note.is_private })}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md flex-shrink-0 ${
              note.is_private ? 'bg-surface-sunken' : 'bg-success/15 dark:bg-success/20'
            }`}
          >
            {note.is_private ? (
              <>
                <Lock size={16} className="text-text-muted" />
                {!isNarrow && <span className="text-sm text-text-muted">Private</span>}
              </>
            ) : (
              <>
                <LockOpen size={16} className="text-success" />
                {!isNarrow && <span className="text-sm text-success">Shared</span>}
              </>
            )}
          </button>

          {/* Separator */}
          <div className="w-px h-4 mx-1 flex-shrink-0 bg-surface-sunken" />

          {/* Read-only Toggle */}
          <button
            onClick={() => {
              const newState = !isReadOnly.value;
              isReadOnly.set(newState);
              editorRef.current?.setEditable(!newState);
            }}
            className={`p-1.5 rounded-md flex-shrink-0 ${
              isReadOnly.value ? 'bg-warning/20 dark:bg-warning/20' : 'bg-surface-sunken'
            }`}
          >
            {isReadOnly.value ? (
              <Eye size={16} className="text-warning" />
            ) : (
              <EyeOff size={16} className="text-text-muted" />
            )}
          </button>

          <div className="w-px h-4 mx-1 flex-shrink-0 bg-surface-sunken" />

          {/* Checkbox dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => showCheckboxDropdown.toggle()}
              className={`flex items-center gap-0.5 p-1.5 rounded-md flex-shrink-0 ${
                showCheckboxDropdown.value ? 'bg-warning/20 dark:bg-warning/20' : 'bg-surface-sunken'
              }`}
            >
              <SquareCheck
                size={16}
                className={showCheckboxDropdown.value ? 'text-warning' : 'text-text-muted'}
              />
              <ChevronDown
                size={12}
                className={showCheckboxDropdown.value ? 'text-warning' : 'text-text-muted'}
              />
            </button>
            {showCheckboxDropdown.value && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => showCheckboxDropdown.setFalse()}
                />
                <div className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[160px] bg-surface-sunken border-border">
                  <button
                    onClick={() => {
                      editorRef.current?.toggleTaskList();
                      showCheckboxDropdown.setFalse();
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b hover:bg-surface-sunken hover:bg-surface-sunken border-border text-text"
                  >
                    Insert checkbox
                  </button>
                  <button
                    onClick={() => {
                      showCheckboxDropdown.setFalse();
                      showDeleteCheckedConfirm.setTrue();
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b hover:bg-surface-sunken hover:bg-surface-sunken border-border text-text"
                  >
                    Delete checked lines
                  </button>
                  <button
                    onClick={() => {
                      showCheckboxDropdown.setFalse();
                      showUncheckAllConfirm.setTrue();
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-surface-sunken hover:bg-surface-sunken text-text"
                  >
                    Uncheck all
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 mx-0.5 flex-shrink-0 bg-surface-sunken" />

          {/* Heading dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => showHeadingDropdown.toggle()}
              className={`flex items-center gap-0.5 p-1.5 rounded-md flex-shrink-0 ${
                showHeadingDropdown.value ? 'bg-warning/20 dark:bg-warning/20' : 'bg-surface-sunken'
              }`}
            >
              <Heading
                size={16}
                className={showHeadingDropdown.value ? 'text-warning' : 'text-text-muted'}
              />
              <ChevronDown
                size={12}
                className={showHeadingDropdown.value ? 'text-warning' : 'text-text-muted'}
              />
            </button>
            {showHeadingDropdown.value && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => showHeadingDropdown.setFalse()}
                />
                <div className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[120px] bg-surface-sunken border-border">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        editorRef.current?.toggleHeading(level as 1 | 2 | 3);
                        showHeadingDropdown.setFalse();
                      }}
                      className={`w-full px-3 py-2 text-left hover:bg-surface-sunken hover:bg-surface-sunken ${
                        level < 3 ? 'border-b border-border' : ''
                      }`}
                    >
                      <span
                        className="font-semibold text-text"
                        style={{ fontSize: 18 - level * 2 }}
                      >
                        Heading {level}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => editorRef.current?.toggleBulletList()}
            className="p-1.5 rounded-md flex-shrink-0 bg-surface-sunken"
          >
            <List size={16} className="text-text-muted" />
          </button>

          <div className="w-px h-4 mx-0.5 flex-shrink-0 bg-surface-sunken" />

          <button
            onClick={handleCopyMarkdown}
            className={`p-1.5 rounded-md flex-shrink-0 ${
              copied ? 'bg-success/20' : 'bg-surface-sunken'
            }`}
          >
            <Copy size={16} className={copied ? 'text-success' : 'text-text-muted'} />
          </button>
        </div>
      </div>

      {/* Rich Text Editor */}
      <RichNoteEditor
        ref={editorRef}
        key={note.id}
        content={note.content || ''}
        onUpdate={handleContentUpdate}
        maxLength={maxContentLength}
        placeholder="Start writing..."
      />

      {/* Tags Section at Bottom */}
      <div className="border-t px-4 py-3 border-border">
        {/* Tags row with inline input */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Current tags */}
          {noteTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onRemoveTag?.(tag.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-full"
              style={{ backgroundColor: (tag.color || '#71717a') + '33' }}
            >
              <Hash size={12} color={tag.color || '#71717a'} />
              <span className="text-sm" style={{ color: tag.color || '#71717a' }}>
                {tag.name}
              </span>
              <X size={12} color={tag.color || '#71717a'} />
            </button>
          ))}

          {/* Inline tag input */}
          <div className="flex items-center relative">
            <Hash size={12} className={isTagNameOverLimit ? 'text-danger' : 'text-text-muted'} />
            <input
              type="text"
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value);
                showTagPicker.set(e.target.value.length > 0);
              }}
              onFocus={() => showTagPicker.setTrue()}
              onBlur={() => {
                setTimeout(() => showTagPicker.setFalse(), 200);
              }}
              placeholder="Add tag..."
              className={`bg-transparent text-sm outline-none min-w-[80px] py-1 ml-1 ${
                isTagNameOverLimit ? 'text-danger' : 'text-text'
              } placeholder:text-text-muted`}
              maxLength={MAX_TAG_NAME_LENGTH + 10}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
            {isTagNameOverLimit && (
              <span className="text-[10px] ml-1 text-danger">Max {MAX_TAG_NAME_LENGTH}</span>
            )}
          </div>
        </div>

        {/* Tag suggestions dropdown */}
        {showTagPicker.value && availableTags.length > 0 && (
          <div className="mt-2 p-2 rounded-lg bg-surface-sunken">
            <p className="text-xs mb-1.5 text-text-muted">
              {newTagName.trim() ? 'Suggestions' : 'Available tags'}
            </p>
            <div className="flex flex-wrap gap-2">
              {availableTags
                .filter(
                  (tag) =>
                    !newTagName.trim() || tag.name.toLowerCase().includes(newTagName.toLowerCase()),
                )
                .slice(0, 8)
                .map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onAddTag?.(tag.id);
                      setNewTagName('');
                      showTagPicker.setFalse();
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-full"
                    style={{ backgroundColor: (tag.color || '#71717a') + '33' }}
                  >
                    <Hash size={12} color={tag.color || '#71717a'} />
                    <span className="text-sm" style={{ color: tag.color || '#71717a' }}>
                      {tag.name}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Sharing Section */}
      <NoteSharing
        note={note}
        onTogglePrivate={(isPrivate) => onUpdate({ is_private: isPrivate })}
      />

      {/* Created/Updated Info + Trash */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <span className="text-xs text-text-muted">
          Created {formatDate(note.created_at)}
          {note.updated_at !== note.created_at && ` · Updated ${formatDate(note.updated_at)}`}
        </span>
        {onTrash && (
          <button onClick={onTrash} className="p-1 hover:opacity-70">
            <Trash2 size={16} className="text-text-muted" />
          </button>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmModal
        open={showDeleteCheckedConfirm.value}
        title="Delete checked lines"
        message="Are you sure you want to delete all checked lines? This cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          handleDeleteCheckedTasks();
          showDeleteCheckedConfirm.setFalse();
        }}
        onClose={() => showDeleteCheckedConfirm.setFalse()}
      />
      <ConfirmModal
        open={showUncheckAllConfirm.value}
        title="Uncheck all"
        message="Are you sure you want to uncheck all checkboxes in this note?"
        confirmText="Uncheck all"
        variant="primary"
        onConfirm={() => {
          handleUncheckAll();
          showUncheckAllConfirm.setFalse();
        }}
        onClose={() => showUncheckAllConfirm.setFalse()}
      />
    </div>
  );
}
