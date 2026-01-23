import { useState } from 'react';
import { Settings, Users, ClipboardList, Gift, History, Moon, Sun, LogOut } from 'lucide-react';
import { ConfirmModal } from '@dak/ui';
import { useThemeStore } from '../stores/theme-store';
import { useAuthStore } from '../stores/auth-store';
import { useSettingsStore } from '../stores/settings-store';

interface ActionBarProps {
  onOpenSettings: () => void;
  onOpenFamily: () => void;
  onOpenChores: () => void;
  onOpenRedeem: () => void;
  onOpenHistory: () => void;
}

export function ActionBar({
  onOpenSettings,
  onOpenFamily,
  onOpenChores,
  onOpenRedeem,
  onOpenHistory,
}: ActionBarProps) {
  const { dark, toggle } = useThemeStore();
  const { signOut } = useAuthStore();
  const { settings } = useSettingsStore();
  const hidePoints = settings?.hide_points ?? false;
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const allButtons = [
    {
      icon: Settings,
      label: 'Settings',
      onClick: onOpenSettings,
      pin: true,
      hideWhenPointsHidden: false,
    },
    {
      icon: Users,
      label: 'Family',
      onClick: onOpenFamily,
      pin: true,
      hideWhenPointsHidden: false,
    },
    {
      icon: ClipboardList,
      label: 'Chores',
      onClick: onOpenChores,
      pin: true,
      hideWhenPointsHidden: false,
    },
    {
      icon: Gift,
      label: 'Redeem',
      onClick: onOpenRedeem,
      pin: true,
      hideWhenPointsHidden: true,
    },
    {
      icon: History,
      label: 'History',
      onClick: onOpenHistory,
      pin: false,
      hideWhenPointsHidden: true,
    },
  ];

  const buttons = hidePoints ? allButtons.filter((b) => !b.hideWhenPointsHidden) : allButtons;

  return (
    <div className="flex items-center justify-around bg-surface border-t border-border px-2 py-2 sm:py-3">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className="flex flex-col items-center gap-1 p-2 rounded-lg text-text-secondary text-text-muted hover:bg-surface-sunken dark:hover:bg-surface-raised hover:text-text dark:hover:text-text transition-colors min-w-[48px]"
            title={btn.label}
          >
            <Icon size={18} />
            <span className="text-[10px] sm:text-xs">{btn.label}</span>
          </button>
        );
      })}

      <button
        onClick={toggle}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-text-secondary text-text-muted hover:bg-surface-sunken dark:hover:bg-surface-raised hover:text-text dark:hover:text-text transition-colors min-w-[48px]"
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        <span className="text-[10px] sm:text-xs">Theme</span>
      </button>

      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-text-secondary text-text-muted hover:bg-danger-light dark:hover:bg-danger-light hover:text-danger transition-colors min-w-[48px]"
        title="Sign out"
      >
        <LogOut size={18} />
        <span className="text-[10px] sm:text-xs">Logout</span>
      </button>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        open={showLogoutConfirm}
        message="Are you sure you want to sign out?"
        confirmText="Sign out"
        variant="danger"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
