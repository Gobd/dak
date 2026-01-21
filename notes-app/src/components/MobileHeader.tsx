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
      <div className="flex items-center justify-between px-4 py-3 border-b z-10 border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
        <button onClick={toggleSelectAll} className="flex items-center gap-2">
          {allOwnedSelected ? (
            <SquareCheck size={20} className="text-amber-500 dark:text-amber-400" />
          ) : (
            <Square size={20} className="text-zinc-400" />
          )}
          <span className="text-sm text-zinc-950 dark:text-white">All</span>
        </button>
        <span className="text-sm font-medium text-zinc-950 dark:text-white">
          {selectedNoteIds.size} selected
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedNoteIds.size > 0 && onBulkDelete()}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              selectedNoteIds.size > 0
                ? 'bg-red-500 text-white'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
            }`}
          >
            Delete
          </button>
          <button onClick={exitSelectionMode} className="p-1">
            <X size={20} className="text-zinc-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b z-10 border-zinc-200 dark:border-zinc-800">
      <button onClick={toggleShowPrivate} className="flex items-center gap-1 py-1 pr-2">
        {!showPrivate && <Lock size={16} className="text-amber-500 dark:text-amber-400" />}
        <span className="text-xl font-bold text-zinc-950 dark:text-white">
          {showPrivate ? 'All Notes' : 'Public'}
        </span>
        <ChevronDown size={18} className="text-zinc-500" />
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
            className="p-2 rounded-lg bg-amber-500 dark:bg-amber-400"
          >
            <Plus size={20} className="text-black" />
          </button>
          {showCreateMenu && showPrivate && (
            <div className="absolute top-11 right-0 rounded-lg border min-w-[160px] z-[100] bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              <button
                onClick={() => onCreateNote(false)}
                className="w-full flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <Plus size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">New Note</span>
              </button>
              <button
                onClick={() => onCreateNote(true)}
                className="w-full flex items-center gap-2 p-3"
              >
                <Lock size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">Private Note</span>
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
            <Menu size={20} className="text-zinc-500" />
          </button>
          {showMobileMenu && (
            <div className="absolute top-11 right-0 rounded-lg border min-w-[200px] max-h-[400px] z-[100] bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
              {/* Tags Section */}
              <button
                onClick={() => setShowMobileTagsMenu(!showMobileTagsMenu)}
                className="w-full flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-zinc-500" />
                  <span className="text-sm text-zinc-950 dark:text-white">
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
                      className="px-1 py-0.5 rounded text-xs bg-zinc-200 dark:bg-zinc-900 text-zinc-500"
                    >
                      Clear
                    </button>
                  )}
                  <ChevronRight
                    size={16}
                    className={`text-zinc-400 transition-transform ${showMobileTagsMenu ? 'rotate-90' : ''}`}
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
                    className={`w-full flex items-center gap-2 py-2.5 px-4 ${
                      !selectedTagId ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        !selectedTagId ? 'text-zinc-950 dark:text-white' : 'text-zinc-500'
                      }`}
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
                      className={`w-full flex items-center gap-2 py-2.5 px-4 ${
                        selectedTagId === tag.id ? 'bg-zinc-200 dark:bg-zinc-700' : ''
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: tag.color || '#f59e0b' }}
                      />
                      <span
                        className={`text-sm flex-1 text-left truncate ${
                          selectedTagId === tag.id
                            ? 'text-zinc-950 dark:text-white'
                            : 'text-zinc-500'
                        }`}
                      >
                        {tag.name}
                      </span>
                      {tagCounts[tag.id] && (
                        <span className="text-xs text-zinc-500">{tagCounts[tag.id]}</span>
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
                className="w-full flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <RefreshCw size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">Refresh</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <Settings size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">Settings</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/trash');
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <Trash2 size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">Trash</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  enterSelectionMode();
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-zinc-200 dark:border-zinc-700"
              >
                <SquareCheck size={16} className="text-zinc-500" />
                <span className="text-sm text-zinc-950 dark:text-white">Select</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 p-3"
              >
                <LogOut size={16} className="text-red-500" />
                <span className="text-sm text-red-500">Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
