import { Button, ConfirmModal, Chip } from '@dak/ui';
import { useToggle, useCopyToClipboard } from '@dak/hooks';
import { useEffect, useRef, useState } from 'react';
import { NoteSharing } from './NoteSharing';
import { RichNoteEditor } from './RichNoteEditor';
import type { SlateEditorHandle } from '@dak/markdown-editor';
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
} from 'lucide-react';

const MAX_TAG_NAME_LENGTH = 30;
const DEBOUNCE_MS = 300;

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
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;

  const showTagPicker = useToggle(false);
  const [newTagName, setNewTagName] = useState('');
  const [copyToClipboard, copied] = useCopyToClipboard();
  const isReadOnly = useToggle(false);
  const showHeadingDropdown = useToggle(false);
  const showCheckboxDropdown = useToggle(false);
  const showDeleteCheckedConfirm = useToggle(false);
  const showUncheckAllConfirm = useToggle(false);

  const editorRef = useRef<SlateEditorHandle>(null);
  const onUpdateRef = useRef(onUpdate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const maxContentLength = planLimits.maxNoteLength;

  // Initial content resolved once per note id — empty notes start with `# ` for title entry
  const initialMarkdown = note.content || '# ';

  const handleEditorChange = (markdown: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateRef.current({ content: markdown });
    }, DEBOUNCE_MS);
  };

  // Flush pending content on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        const latest = editorRef.current?.getMarkdown();
        if (latest !== undefined && latest !== note.content) {
          onUpdateRef.current({ content: latest });
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCopyMarkdown = () => {
    if (note.content) copyToClipboard(note.content);
  };

  const handleCreateTag = () => {
    const trimmed = newTagName.trim();
    if (trimmed && trimmed.length <= MAX_TAG_NAME_LENGTH && onCreateTag) {
      onCreateTag(trimmed);
      setNewTagName('');
    }
  };

  const handleDeleteCheckedTasks = () => {
    editorRef.current?.deleteCheckedItems();
  };

  const handleUncheckAll = () => {
    editorRef.current?.uncheckAll();
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                editorRef.current?.blur();
                setTimeout(onBack, 50);
              }}
              className="flex items-center py-1.5 pr-2 -ml-1 flex-shrink-0 text-warning"
            >
              <ChevronLeft size={20} />
              <span className="text-sm">Back</span>
            </Button>
          )}
          {/* Pinned Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onUpdate({ pinned: !note.pinned })}
            className={`flex items-center gap-1 flex-shrink-0 ${
              note.pinned ? 'bg-warning/20 dark:bg-warning/20' : ''
            }`}
          >
            <Pin size={16} className={note.pinned ? 'text-warning' : 'text-text-muted'} />
            {!isNarrow && (
              <span className={`text-sm ${note.pinned ? 'text-warning' : 'text-text-muted'}`}>
                {note.pinned ? 'Pinned' : 'Pin'}
              </span>
            )}
          </Button>

          {/* Private Toggle */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onUpdate({ is_private: !note.is_private })}
            className={`flex items-center gap-1 flex-shrink-0 ${
              note.is_private ? '' : 'bg-success/15 dark:bg-success/20'
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
          </Button>

          {/* Separator */}
          <div className="w-px h-4 mx-1 flex-shrink-0 bg-surface-sunken" />

          {/* Read-only Toggle */}
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => {
              const newState = !isReadOnly.value;
              isReadOnly.set(newState);
              if (newState) editorRef.current?.blur();
            }}
            className={`flex-shrink-0 ${
              isReadOnly.value ? 'bg-warning/20 dark:bg-warning/20' : ''
            }`}
          >
            {isReadOnly.value ? (
              <Eye size={16} className="text-warning" />
            ) : (
              <EyeOff size={16} className="text-text-muted" />
            )}
          </Button>

          <div className="w-px h-4 mx-1 flex-shrink-0 bg-surface-sunken" />

          {/* Checkbox dropdown trigger */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => showCheckboxDropdown.toggle()}
              className={`flex items-center gap-0.5 flex-shrink-0 ${
                showCheckboxDropdown.value ? 'bg-warning/20 dark:bg-warning/20' : ''
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
            </Button>
            {showCheckboxDropdown.value && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => showCheckboxDropdown.setFalse()}
                />
                <div className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[160px] bg-surface-sunken border-border">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      editorRef.current?.toggleCheckList();
                      showCheckboxDropdown.setFalse();
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b border-border text-text rounded-none justify-start"
                  >
                    Insert checkbox
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      showCheckboxDropdown.setFalse();
                      showDeleteCheckedConfirm.setTrue();
                    }}
                    className="w-full px-3 py-2 text-left text-sm border-b border-border text-text rounded-none justify-start"
                  >
                    Delete checked lines
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      showCheckboxDropdown.setFalse();
                      showUncheckAllConfirm.setTrue();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-text rounded-none justify-start"
                  >
                    Uncheck all
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="w-px h-4 mx-0.5 flex-shrink-0 bg-surface-sunken" />

          {/* Heading dropdown trigger */}
          <div className="relative">
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={() => showHeadingDropdown.toggle()}
              className={`flex items-center gap-0.5 flex-shrink-0 ${
                showHeadingDropdown.value ? 'bg-warning/20 dark:bg-warning/20' : ''
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
            </Button>
            {showHeadingDropdown.value && (
              <>
                <div
                  className="fixed inset-0 z-[99]"
                  onClick={() => showHeadingDropdown.setFalse()}
                />
                <div className="absolute top-11 left-0 rounded-lg border shadow-lg z-[100] min-w-[120px] bg-surface-sunken border-border">
                  {[1, 2, 3].map((level) => (
                    <Button
                      key={level}
                      variant="ghost"
                      onClick={() => {
                        editorRef.current?.toggleHeading(level as 1 | 2 | 3);
                        showHeadingDropdown.setFalse();
                      }}
                      className="w-full px-3 py-2 text-left rounded-none justify-start border-b border-border"
                    >
                      <span
                        className="font-semibold text-text"
                        style={{ fontSize: 18 - level * 2 }}
                      >
                        Heading {level}
                      </span>
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      editorRef.current?.setParagraph();
                      showHeadingDropdown.setFalse();
                    }}
                    className="w-full px-3 py-2 text-left rounded-none justify-start"
                  >
                    <span className="text-text" style={{ fontSize: 14 }}>
                      Normal Text
                    </span>
                  </Button>
                </div>
              </>
            )}
          </div>

          <Button
            variant="secondary"
            size="icon-sm"
            onClick={() => editorRef.current?.toggleBulletList()}
            className="flex-shrink-0"
          >
            <List size={16} className="text-text-muted" />
          </Button>

          <div className="w-px h-4 mx-0.5 flex-shrink-0 bg-surface-sunken" />

          <Button
            variant="secondary"
            size="icon-sm"
            onClick={handleCopyMarkdown}
            className={`flex-shrink-0 ${copied ? 'bg-success/20' : ''}`}
          >
            <Copy size={16} className={copied ? 'text-success' : 'text-text-muted'} />
          </Button>
        </div>
      </div>

      {/* Rich Text Editor */}
      <RichNoteEditor
        ref={editorRef}
        initialMarkdown={initialMarkdown}
        onChange={handleEditorChange}
        editable={!isReadOnly.value}
        maxLength={maxContentLength}
        placeholder="Start writing..."
      />

      {/* Tags Section at Bottom */}
      <div className="border-t px-4 py-3 border-border">
        <div className="flex items-center flex-wrap gap-2">
          {noteTags.map((tag) => (
            <Chip
              key={tag.id}
              size="sm"
              color={tag.color || '#71717a'}
              onRemove={() => onRemoveTag?.(tag.id)}
            >
              <Hash size={12} />
              {tag.name}
            </Chip>
          ))}

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
                  <Chip
                    key={tag.id}
                    size="sm"
                    color={tag.color || '#71717a'}
                    onClick={() => {
                      onAddTag?.(tag.id);
                      setNewTagName('');
                      showTagPicker.setFalse();
                    }}
                  >
                    <Hash size={12} />
                    {tag.name}
                  </Chip>
                ))}
            </div>
          </div>
        )}
      </div>

      <NoteSharing
        note={note}
        onTogglePrivate={(isPrivate) => onUpdate({ is_private: isPrivate })}
      />

      <div className="flex items-center justify-between px-4 py-2 border-t border-border">
        <span className="text-xs text-text-muted">
          Created {formatDate(note.created_at)}
          {note.updated_at !== note.created_at && ` · Updated ${formatDate(note.updated_at)}`}
        </span>
        {onTrash && (
          <Button variant="ghost" size="icon-sm" onClick={onTrash}>
            <Trash2 size={16} className="text-text-muted" />
          </Button>
        )}
      </div>

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
