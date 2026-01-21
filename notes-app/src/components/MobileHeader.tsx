import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Lock,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Settings,
  Square,
  SquareCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { Tag as TagType } from '../types/tag';

interface MobileHeaderProps {
  colors: {
    border: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    text: string;
    textMuted: string;
    icon: string;
    iconMuted: string;
    primary: string;
    primaryText: string;
    error: string;
  };
  // Selection mode
  isSelectionMode: boolean;
  allOwnedSelected: boolean;
  selectedNoteIds: Set<string>;
  toggleSelectAll: () => void;
  onBulkDelete: () => void;
  exitSelectionMode: () => void;
  enterSelectionMode: () => void;
  // View toggle
  showPrivate: boolean;
  toggleShowPrivate: () => void;
  // Create menu
  showCreateMenu: boolean;
  setShowCreateMenu: (show: boolean) => void;
  onCreateNote: (isPrivate: boolean) => void;
  // Mobile menu
  showMobileMenu: boolean;
  setShowMobileMenu: (show: boolean) => void;
  // Tags
  tags: TagType[];
  selectedTagId: string | null;
  setSelectedTagId: (id: string | null) => void;
  tagCounts: Record<string, number>;
  showMobileTagsMenu: boolean;
  setShowMobileTagsMenu: (show: boolean) => void;
  // Logout
  onLogout: () => void;
}

export function MobileHeader({
  colors,
  isSelectionMode,
  allOwnedSelected,
  selectedNoteIds,
  toggleSelectAll,
  onBulkDelete,
  exitSelectionMode,
  enterSelectionMode,
  showPrivate,
  toggleShowPrivate,
  showCreateMenu,
  setShowCreateMenu,
  onCreateNote,
  showMobileMenu,
  setShowMobileMenu,
  tags,
  selectedTagId,
  setSelectedTagId,
  tagCounts,
  showMobileTagsMenu,
  setShowMobileTagsMenu,
  onLogout,
}: MobileHeaderProps) {
  const navigate = useNavigate();

  if (isSelectionMode) {
    return (
      <div
        className="flex items-center justify-between px-4 py-3 border-b z-10"
        style={{
          borderBottomColor: colors.border,
          backgroundColor: colors.bgSecondary,
        }}
      >
        <button onClick={toggleSelectAll} className="flex items-center gap-2">
          {allOwnedSelected ? (
            <SquareCheck size={20} color={colors.primary} />
          ) : (
            <Square size={20} color={colors.iconMuted} />
          )}
          <span className="text-sm" style={{ color: colors.text }}>
            All
          </span>
        </button>
        <span className="text-sm font-medium" style={{ color: colors.text }}>
          {selectedNoteIds.size} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedNoteIds.size > 0 && onBulkDelete()}
            className="px-3 py-1.5 rounded-md text-sm font-medium"
            style={{
              backgroundColor: selectedNoteIds.size > 0 ? colors.error : colors.border,
              color: selectedNoteIds.size > 0 ? '#fff' : colors.textMuted,
            }}
          >
            Delete
          </button>
          <button onClick={exitSelectionMode} className="p-1">
            <X size={20} color={colors.icon} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between px-4 py-3 border-b z-10"
      style={{ borderBottomColor: colors.border }}
    >
      <button onClick={toggleShowPrivate} className="flex items-center gap-1 py-1 pr-2">
        {!showPrivate && <Lock size={16} color={colors.primary} />}
        <span className="text-xl font-bold" style={{ color: colors.text }}>
          {showPrivate ? 'All Notes' : 'Public'}
        </span>
        <ChevronDown size={18} color={colors.textMuted} />
      </button>
      <div className="flex items-center gap-2">
        {/* Create Note Button */}
        <div className="relative z-[11]">
          <button
            onClick={() => {
              if (!showPrivate) {
                onCreateNote(false);
              } else {
                setShowMobileMenu(false);
                setShowCreateMenu(!showCreateMenu);
              }
            }}
            className="p-2 rounded-lg"
            style={{ backgroundColor: colors.primary }}
          >
            <Plus size={20} color={colors.primaryText} />
          </button>
          {showCreateMenu && showPrivate && (
            <div
              className="absolute top-11 right-0 rounded-lg border min-w-[160px] z-[100]"
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
              }}
            >
              <button
                onClick={() => onCreateNote(false)}
                className="w-full flex items-center gap-2 p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <Plus size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  New Note
                </span>
              </button>
              <button
                onClick={() => onCreateNote(true)}
                className="w-full flex items-center gap-2 p-3"
              >
                <Lock size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  Private Note
                </span>
              </button>
            </div>
          )}
        </div>
        {/* Menu Button */}
        <div className="relative z-10">
          <button
            onClick={() => {
              setShowCreateMenu(false);
              setShowMobileMenu(!showMobileMenu);
            }}
            className="p-2"
          >
            <Menu size={20} color={colors.icon} />
          </button>
          {showMobileMenu && (
            <div
              className="absolute top-11 right-0 rounded-lg border min-w-[200px] max-h-[400px] z-[100]"
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
              }}
            >
              {/* Tags Section */}
              <button
                onClick={() => setShowMobileTagsMenu(!showMobileTagsMenu)}
                className="w-full flex items-center justify-between p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <div className="flex items-center gap-2">
                  <Tag size={16} color={colors.icon} />
                  <span className="text-sm" style={{ color: colors.text }}>
                    {selectedTagId
                      ? tags.find((t) => t.id === selectedTagId)?.name || 'Tags'
                      : 'Tags'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTagId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTagId(null);
                        setShowMobileTagsMenu(false);
                        setShowMobileMenu(false);
                      }}
                      className="px-1 py-0.5 rounded text-xs"
                      style={{
                        backgroundColor: colors.bgTertiary,
                        color: colors.textMuted,
                      }}
                    >
                      Clear
                    </button>
                  )}
                  <ChevronRight
                    size={16}
                    color={colors.iconMuted}
                    className={`transition-transform ${showMobileTagsMenu ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {showMobileTagsMenu && (
                <div className="max-h-[200px] overflow-auto">
                  <button
                    onClick={() => {
                      setSelectedTagId(null);
                      setShowMobileTagsMenu(false);
                      setShowMobileMenu(false);
                    }}
                    className="w-full flex items-center gap-2 py-2.5 px-4"
                    style={{
                      backgroundColor: !selectedTagId ? colors.bgHover : 'transparent',
                    }}
                  >
                    <span
                      className="text-sm"
                      style={{
                        color: !selectedTagId ? colors.text : colors.textMuted,
                      }}
                    >
                      All notes
                    </span>
                  </button>
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => {
                        setSelectedTagId(tag.id);
                        setShowMobileTagsMenu(false);
                        setShowMobileMenu(false);
                      }}
                      className="w-full flex items-center gap-2 py-2.5 px-4"
                      style={{
                        backgroundColor: selectedTagId === tag.id ? colors.bgHover : 'transparent',
                      }}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: tag.color || colors.primary }}
                      />
                      <span
                        className="text-sm flex-1 text-left truncate"
                        style={{
                          color: selectedTagId === tag.id ? colors.text : colors.textMuted,
                        }}
                      >
                        {tag.name}
                      </span>
                      {tagCounts[tag.id] && (
                        <span className="text-xs" style={{ color: colors.textMuted }}>
                          {tagCounts[tag.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  window.location.reload();
                }}
                className="w-full flex items-center gap-2 p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <RefreshCw size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  Refresh
                </span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <Settings size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  Settings
                </span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/trash');
                }}
                className="w-full flex items-center gap-2 p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <Trash2 size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  Trash
                </span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  enterSelectionMode();
                }}
                className="w-full flex items-center gap-2 p-3 border-b"
                style={{ borderBottomColor: colors.border }}
              >
                <SquareCheck size={16} color={colors.icon} />
                <span className="text-sm" style={{ color: colors.text }}>
                  Select
                </span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 p-3"
              >
                <LogOut size={16} color={colors.error} />
                <span className="text-sm" style={{ color: colors.error }}>
                  Log out
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
