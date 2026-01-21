import { ConfirmDialog } from './ui/confirm-dialog';
import { NoteSharing } from './NoteSharing';
import { RichNoteEditor, type RichNoteEditorRef } from './RichNoteEditor';
import { useTheme, useThemeColors } from '../hooks/useThemeColors';
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
  const colors = useThemeColors();
  const { isDark } = useTheme();
  const { planLimits } = useUserStore();
  const editorRef = useRef<RichNoteEditorRef>(null);
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
  const [showCheckboxDropdown, setShowCheckboxDropdown] = useState(false);
  const [showDeleteCheckedConfirm, setShowDeleteCheckedConfirm] = useState(false);
  const [showUncheckAllConfirm, setShowUncheckAllConfirm] = useState(false);

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
    <div
      className="flex-1 flex flex-col min-h-0 overflow-hidden"
      style={{ backgroundColor: colors.bg }}
    >
      {/* Toolbar */}
      <div className="border-b py-2 relative z-10" style={{ borderBottomColor: colors.border }}>
        <div className="flex items-center gap-2 px-4 flex-wrap">
          {/* Back Button (narrow view) */}
          {onBack && (
            <button
              onClick={() => {
                editorRef.current?.blur();
                setTimeout(onBack, 50);
              }}
              className="flex items-center py-1.5 pr-2 -ml-1 flex-shrink-0"
            >
              <ChevronLeft size={20} color={colors.primary} />
              <span className="text-sm" style={{ color: colors.primary }}>
                Back
              </span>
            </button>
          )}
          {/* Pinned Toggle */}
          <button
            onClick={() => onUpdate({ pinned: !note.pinned })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md flex-shrink-0"
            style={{
              backgroundColor: note.pinned
                ? isDark
                  ? 'rgba(251, 191, 36, 0.2)'
                  : 'rgba(245, 158, 11, 0.15)'
                : colors.bgTertiary,
            }}
          >
            <Pin size={16} color={note.pinned ? colors.primary : colors.icon} />
            {!isNarrow && (
              <span
                className="text-sm"
                style={{ color: note.pinned ? colors.primary : colors.textTertiary }}
              >
                {note.pinned ? 'Pinned' : 'Pin'}
              </span>
            )}
          </button>

          {/* Private Toggle */}
          <button
            onClick={() => onUpdate({ is_private: !note.is_private })}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md flex-shrink-0"
            style={{
              backgroundColor: note.is_private
                ? colors.bgTertiary
                : isDark
                  ? 'rgba(34, 197, 94, 0.2)'
                  : 'rgba(34, 197, 94, 0.15)',
            }}
          >
            {note.is_private ? (
              <>
                <Lock size={16} color={colors.icon} />
                {!isNarrow && (
                  <span className="text-sm" style={{ color: colors.textTertiary }}>
                    Private
                  </span>
                )}
              </>
            ) : (
              <>
                <LockOpen size={16} color={colors.success} />
                {!isNarrow && (
                  <span className="text-sm" style={{ color: colors.success }}>
                    Shared
                  </span>
                )}
              </>
            )}
          </button>

          {/* Separator */}
          <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: colors.border }} />

          {/* Read-only Toggle */}
          <button
            onClick={() => {
              const newState = !isReadOnly;
              setIsReadOnly(newState);
              editorRef.current?.setEditable(!newState);
            }}
            className="p-1.5 rounded-md flex-shrink-0"
            style={{
              backgroundColor: isReadOnly ? colors.primary + '20' : colors.bgTertiary,
            }}
          >
            {isReadOnly ? (
              <Eye size={16} color={colors.primary} />
            ) : (
              <EyeOff size={16} color={colors.icon} />
            )}
          </button>

          <div className="w-px h-4 mx-1 flex-shrink-0" style={{ backgroundColor: colors.border }} />

          {/* Checkbox dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setShowCheckboxDropdown(!showCheckboxDropdown)}
              className="flex items-center gap-0.5 p-1.5 rounded-md flex-shrink-0"
              style={{
                backgroundColor: showCheckboxDropdown ? colors.primary + '20' : colors.bgTertiary,
              }}
            >
              <SquareCheck size={16} color={showCheckboxDropdown ? colors.primary : colors.icon} />
              <ChevronDown size={12} color={showCheckboxDropdown ? colors.primary : colors.icon} />
            </button>
            {showCheckboxDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => setShowCheckboxDropdown(false)}
                />
                <div
                  className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[160px]"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                  }}
                >
                  <button
                    onClick={() => {
                      editorRef.current?.toggleTaskList();
                      setShowCheckboxDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderBottomColor: colors.border, color: colors.text }}
                  >
                    Insert checkbox
                  </button>
                  <button
                    onClick={() => {
                      setShowCheckboxDropdown(false);
                      setShowDeleteCheckedConfirm(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ borderBottomColor: colors.border, color: colors.text }}
                  >
                    Delete checked lines
                  </button>
                  <button
                    onClick={() => {
                      setShowCheckboxDropdown(false);
                      setShowUncheckAllConfirm(true);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: colors.text }}
                  >
                    Uncheck all
                  </button>
                </div>
              </>
            )}
          </div>

          <div
            className="w-px h-4 mx-0.5 flex-shrink-0"
            style={{ backgroundColor: colors.border }}
          />

          {/* Heading dropdown trigger */}
          <div className="relative">
            <button
              onClick={() => setShowHeadingDropdown(!showHeadingDropdown)}
              className="flex items-center gap-0.5 p-1.5 rounded-md flex-shrink-0"
              style={{
                backgroundColor: showHeadingDropdown ? colors.primary + '20' : colors.bgTertiary,
              }}
            >
              <Heading size={16} color={showHeadingDropdown ? colors.primary : colors.icon} />
              <ChevronDown size={12} color={showHeadingDropdown ? colors.primary : colors.icon} />
            </button>
            {showHeadingDropdown && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => setShowHeadingDropdown(false)}
                />
                <div
                  className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[120px]"
                  style={{
                    backgroundColor: colors.bgSecondary,
                    borderColor: colors.border,
                  }}
                >
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        editorRef.current?.toggleHeading(level as 1 | 2 | 3);
                        setShowHeadingDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/5"
                      style={{
                        borderBottomWidth: level < 3 ? 1 : 0,
                        borderBottomColor: colors.border,
                      }}
                    >
                      <span
                        className="font-semibold"
                        style={{
                          fontSize: 18 - level * 2,
                          color: colors.text,
                        }}
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
            className="p-1.5 rounded-md flex-shrink-0"
            style={{ backgroundColor: colors.bgTertiary }}
          >
            <List size={16} color={colors.icon} />
          </button>

          <div
            className="w-px h-4 mx-0.5 flex-shrink-0"
            style={{ backgroundColor: colors.border }}
          />

          <button
            onClick={handleCopyMarkdown}
            className="p-1.5 rounded-md flex-shrink-0"
            style={{
              backgroundColor: copied ? colors.success + '20' : colors.bgTertiary,
            }}
          >
            <Copy size={16} color={copied ? colors.success : colors.icon} />
          </button>
        </div>
      </div>

      {/* Rich Text Editor */}
      <RichNoteEditor
        ref={editorRef}
        key={`${note.id}-${isDark ? 'dark' : 'light'}`}
        content={note.content || ''}
        onUpdate={handleContentUpdate}
        maxLength={maxContentLength}
        placeholder="Start writing..."
      />

      {/* Tags Section at Bottom */}
      <div className="border-t px-4 py-3" style={{ borderTopColor: colors.border }}>
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
            <Hash
              size={12}
              color={isTagNameOverLimit ? colors.error : colors.iconMuted}
              className="mr-1"
            />
            <input
              type="text"
              value={newTagName}
              onChange={(e) => {
                setNewTagName(e.target.value);
                setShowTagPicker(e.target.value.length > 0);
              }}
              onFocus={() => setShowTagPicker(true)}
              onBlur={() => {
                // Delay hiding to allow clicking suggestions
                setTimeout(() => setShowTagPicker(false), 200);
              }}
              placeholder="Add tag..."
              className="bg-transparent text-sm outline-none min-w-[80px] py-1"
              style={{
                color: isTagNameOverLimit ? colors.error : colors.inputText,
              }}
              maxLength={MAX_TAG_NAME_LENGTH + 10}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            />
            {isTagNameOverLimit && (
              <span className="text-[10px] ml-1" style={{ color: colors.error }}>
                Max {MAX_TAG_NAME_LENGTH}
              </span>
            )}
          </div>
        </div>

        {/* Tag suggestions dropdown */}
        {showTagPicker && availableTags.length > 0 && (
          <div className="mt-2 p-2 rounded-lg" style={{ backgroundColor: colors.bgTertiary }}>
            <p className="text-xs mb-1.5" style={{ color: colors.textMuted }}>
              {newTagName.trim() ? 'Suggestions' : 'Available tags'}
            </p>
            <div className="flex flex-wrap gap-2">
              {availableTags
                .filter(
                  (tag) =>
                    !newTagName.trim() || tag.name.toLowerCase().includes(newTagName.toLowerCase())
                )
                .slice(0, 8)
                .map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      onAddTag?.(tag.id);
                      setNewTagName('');
                      setShowTagPicker(false);
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
      <div
        className="flex items-center justify-between px-4 py-2 border-t"
        style={{ borderTopColor: colors.border }}
      >
        <span className="text-xs" style={{ color: colors.textMuted }}>
          Created {formatDate(note.created_at)}
          {note.updated_at !== note.created_at && ` · Updated ${formatDate(note.updated_at)}`}
        </span>
        {onTrash && (
          <button onClick={onTrash} className="p-1 hover:opacity-70">
            <Trash2 size={16} color={colors.iconMuted} />
          </button>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        visible={showDeleteCheckedConfirm}
        title="Delete checked lines"
        message="Are you sure you want to delete all checked lines? This cannot be undone."
        confirmText="Delete"
        destructive
        onConfirm={() => {
          handleDeleteCheckedTasks();
          setShowDeleteCheckedConfirm(false);
        }}
        onCancel={() => setShowDeleteCheckedConfirm(false)}
      />
      <ConfirmDialog
        visible={showUncheckAllConfirm}
        title="Uncheck all"
        message="Are you sure you want to uncheck all checkboxes in this note?"
        confirmText="Uncheck all"
        onConfirm={() => {
          handleUncheckAll();
          setShowUncheckAllConfirm(false);
        }}
        onCancel={() => setShowUncheckAllConfirm(false)}
      />
    </div>
  );
}
