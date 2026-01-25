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
import { Button } from '@dak/ui';
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
  // Kiosk mode - locks to public only
  isPublicOnly?: boolean;
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
  isPublicOnly = false,
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
      <div className="flex items-center justify-between px-4 py-3 border-b z-10 border-border bg-surface-sunken">
        <Button variant="ghost" onClick={toggleSelectAll} className="flex items-center gap-2 p-0">
          {allOwnedSelected ? (
            <SquareCheck size={20} className="text-warning" />
          ) : (
            <Square size={20} className="text-text-muted" />
          )}
          <span className="text-sm text-text">All</span>
        </Button>
        <span className="text-sm font-medium text-text">{selectedNoteIds.size} selected</span>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedNoteIds.size > 0 ? 'danger' : 'secondary'}
            size="sm"
            onClick={() => selectedNoteIds.size > 0 && onBulkDelete()}
          >
            Delete
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={exitSelectionMode}>
            <X size={20} className="text-text-muted" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b z-10 border-border">
      {isPublicOnly ? (
        <span className="text-xl font-bold text-text">Notes</span>
      ) : (
        <Button variant="ghost" onClick={toggleShowPrivate} className="flex items-center gap-1 py-1 pr-2 p-0">
          {!showPrivate && <Lock size={16} className="text-warning" />}
          <span className="text-xl font-bold text-text">
            {showPrivate ? 'All Notes' : 'Public'}
          </span>
          <ChevronDown size={18} className="text-text-muted" />
        </Button>
      )}
      <div className="flex items-center gap-2">
        {/* Create Note Button */}
        <div className="relative z-[11]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (isPublicOnly || !showPrivate) {
                onCreateNote(false);
              } else {
                setShowMobileMenu(false);
                setShowCreateMenu(!showCreateMenu);
              }
            }}
            className="bg-warning hover:bg-warning"
          >
            <Plus size={20} className="text-black" />
          </Button>
          {showCreateMenu && showPrivate && !isPublicOnly && (
            <div className="absolute top-11 right-0 rounded-lg border min-w-[160px] z-[100] bg-surface-sunken border-border">
              <Button
                variant="ghost"
                onClick={() => onCreateNote(false)}
                className="w-full flex items-center gap-2 p-3 border-b border-border rounded-none justify-start"
              >
                <Plus size={16} className="text-text-muted" />
                <span className="text-sm text-text">New Note</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => onCreateNote(true)}
                className="w-full flex items-center gap-2 p-3 rounded-none justify-start"
              >
                <Lock size={16} className="text-text-muted" />
                <span className="text-sm text-text">Private Note</span>
              </Button>
            </div>
          )}
        </div>
        {/* Menu Button */}
        <div className="relative z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setShowCreateMenu(false);
              setShowMobileMenu(!showMobileMenu);
            }}
          >
            <Menu size={20} className="text-text-muted" />
          </Button>
          {showMobileMenu && (
            <div className="absolute top-11 right-0 rounded-lg border min-w-[200px] max-h-[400px] z-[100] bg-surface-sunken border-border">
              {/* Tags Section */}
              <Button
                variant="ghost"
                onClick={() => setShowMobileTagsMenu(!showMobileTagsMenu)}
                className="w-full flex items-center justify-between p-3 border-b border-border rounded-none"
              >
                <div className="flex items-center gap-2">
                  <Tag size={16} className="text-text-muted" />
                  <span className="text-sm text-text">
                    {selectedTagId
                      ? tags.find((t) => t.id === selectedTagId)?.name || 'Tags'
                      : 'Tags'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedTagId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTagId(null);
                        setShowMobileTagsMenu(false);
                        setShowMobileMenu(false);
                      }}
                      className="px-1 py-0.5 text-xs bg-surface-sunken text-text-muted"
                    >
                      Clear
                    </Button>
                  )}
                  <ChevronRight
                    size={16}
                    className={`text-text-muted transition-transform ${showMobileTagsMenu ? 'rotate-90' : ''}`}
                  />
                </div>
              </Button>
              {showMobileTagsMenu && (
                <div className="max-h-[200px] overflow-auto">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedTagId(null);
                      setShowMobileTagsMenu(false);
                      setShowMobileMenu(false);
                    }}
                    className={`w-full flex items-center gap-2 py-2.5 px-4 rounded-none justify-start ${
                      !selectedTagId ? 'bg-surface-sunken' : ''
                    }`}
                  >
                    <span className={`text-sm ${!selectedTagId ? 'text-text' : 'text-text-muted'}`}>
                      All notes
                    </span>
                  </Button>
                  {tags.map((tag) => (
                    <Button
                      key={tag.id}
                      variant="ghost"
                      onClick={() => {
                        setSelectedTagId(tag.id);
                        setShowMobileTagsMenu(false);
                        setShowMobileMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 py-2.5 px-4 rounded-none justify-start ${
                        selectedTagId === tag.id ? 'bg-surface-sunken' : ''
                      }`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: tag.color || '#f59e0b' }}
                      />
                      <span
                        className={`text-sm flex-1 text-left truncate ${
                          selectedTagId === tag.id ? 'text-text' : 'text-text-muted'
                        }`}
                      >
                        {tag.name}
                      </span>
                      {tagCounts[tag.id] && (
                        <span className="text-xs text-text-muted">{tagCounts[tag.id]}</span>
                      )}
                    </Button>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMobileMenu(false);
                  window.location.reload();
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-border rounded-none justify-start"
              >
                <RefreshCw size={16} className="text-text-muted" />
                <span className="text-sm text-text">Refresh</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/settings');
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-border rounded-none justify-start"
              >
                <Settings size={16} className="text-text-muted" />
                <span className="text-sm text-text">Settings</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMobileMenu(false);
                  navigate('/trash');
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-border rounded-none justify-start"
              >
                <Trash2 size={16} className="text-text-muted" />
                <span className="text-sm text-text">Trash</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMobileMenu(false);
                  enterSelectionMode();
                }}
                className="w-full flex items-center gap-2 p-3 border-b border-border rounded-none justify-start"
              >
                <SquareCheck size={16} className="text-text-muted" />
                <span className="text-sm text-text">Select</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMobileMenu(false);
                  onLogout();
                }}
                className="w-full flex items-center gap-2 p-3 rounded-none justify-start"
              >
                <LogOut size={16} className="text-danger" />
                <span className="text-sm text-danger">Log out</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
