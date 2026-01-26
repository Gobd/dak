import { useNavigate } from 'react-router-dom';
import { LogOut, PanelLeftClose, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { Button } from '@dak/ui';
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
    <div className="w-56 flex flex-col border-r border-border">
      {/* Nav Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-lg font-semibold text-text">SimpleNotes</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose}>
          <PanelLeftClose size={18} className="text-text-muted" />
        </Button>
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
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          onClick={() => window.location.reload()}
          className="w-full flex items-center gap-2 p-2 justify-start"
        >
          <RefreshCw size={16} className="text-text-muted" />
          <span className="text-sm text-text-muted">Refresh</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2 p-2 justify-start"
        >
          <Settings size={16} className="text-text-muted" />
          <span className="text-sm text-text-muted">Settings</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/trash')}
          className="w-full flex items-center gap-2 p-2 justify-start"
        >
          <Trash2 size={16} className="text-text-muted" />
          <span className="text-sm text-text-muted">Trash</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full flex items-center gap-2 p-2 justify-start"
        >
          <LogOut size={16} className="text-text-muted" />
          <span className="text-sm truncate text-text-muted">{userEmail}</span>
        </Button>
      </div>
    </div>
  );
}
