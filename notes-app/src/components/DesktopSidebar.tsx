import { useNavigate } from 'react-router-dom';
import { LogOut, PanelLeftClose, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { TagsSidebarSection } from './TagChips';
import type { Tag } from '../types/tag';

interface DesktopSidebarProps {
  onClose: () => void;
  tags: Tag[];
  selectedTagId: string | null;
  onSelectTag: (id: string | null) => void;
  tagCounts: Record<string, number>;
  userEmail?: string;
  onLogout: () => void;
}

export function DesktopSidebar({
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
    <div className="w-56 flex flex-col border-r border-zinc-200 dark:border-zinc-800">
      {/* Nav Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-lg font-semibold text-zinc-950 dark:text-white">SimpleNotes</span>
        <button onClick={onClose} className="p-1 hover:opacity-70">
          <PanelLeftClose size={18} className="text-zinc-400" />
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
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <RefreshCw size={16} className="text-zinc-400" />
          <span className="text-sm text-zinc-500">Refresh</span>
        </button>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Settings size={16} className="text-zinc-400" />
          <span className="text-sm text-zinc-500">Settings</span>
        </button>
        <button
          onClick={() => navigate('/trash')}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Trash2 size={16} className="text-zinc-400" />
          <span className="text-sm text-zinc-500">Trash</span>
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
        >
          <LogOut size={16} className="text-zinc-400" />
          <span className="text-sm truncate text-zinc-500">{userEmail}</span>
        </button>
      </div>
    </div>
  );
}
