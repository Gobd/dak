import { useNavigate } from 'react-router-dom';
import { LogOut, PanelLeftClose, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { TagsSidebarSection } from './TagChips';
import type { Tag } from '../types/tag';

interface DesktopSidebarProps {
  colors: {
    border: string;
    text: string;
    textTertiary: string;
    iconMuted: string;
  };
  // Visibility
  onClose: () => void;
  // Tags
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
  tagCounts: Record<string, number>;
  // User
  userEmail?: string;
  onLogout: () => void;
}

export function DesktopSidebar({
  colors,
  onClose,
  tags,
  selectedTagId,
  onSelectTag,
  tagCounts,
  userEmail,
  onLogout,
}: DesktopSidebarProps) {
  const navigate = useNavigate();

  return (
    <div className="w-56 flex flex-col border-r" style={{ borderRightColor: colors.border }}>
      {/* Nav Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderBottomColor: colors.border }}
      >
        <span className="text-lg font-semibold" style={{ color: colors.text }}>
          SimpleNotes
        </span>
        <button onClick={onClose} className="p-1 hover:opacity-70">
          <PanelLeftClose size={18} color={colors.iconMuted} />
        </button>
      </div>

      {/* Tags */}
      <div className="flex-1 overflow-auto py-2">
        <TagsSidebarSection
          tags={tags}
          selectedTagId={selectedTagId}
          onSelectTag={onSelectTag}
          tagCounts={tagCounts}
        />
      </div>

      {/* Sidebar Footer */}
      <div className="border-t p-3" style={{ borderTopColor: colors.border }}>
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <RefreshCw size={16} color={colors.iconMuted} />
          <span className="text-sm" style={{ color: colors.textTertiary }}>
            Refresh
          </span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Settings size={16} color={colors.iconMuted} />
          <span className="text-sm" style={{ color: colors.textTertiary }}>
            Settings
          </span>
        </button>
        <button
          onClick={() => navigate('/trash')}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Trash2 size={16} color={colors.iconMuted} />
          <span className="text-sm" style={{ color: colors.textTertiary }}>
            Trash
          </span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <LogOut size={16} color={colors.iconMuted} />
          <span className="text-sm truncate" style={{ color: colors.textTertiary }}>
            {userEmail}
          </span>
        </button>
      </div>
    </div>
  );
}
