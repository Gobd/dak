import { Settings, Users, ClipboardList, Gift, History, Moon, Sun, LogOut } from 'lucide-react';
import { useToggle } from '@dak/hooks';
import { ConfirmModal, Button } from '@dak/ui';
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
  const showLogoutConfirm = useToggle(false);

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
          <Button
            key={btn.label}
            variant="ghost"
            onClick={btn.onClick}
            className="flex flex-col items-center gap-1 p-2 h-auto text-text-muted hover:text-text min-w-[48px]"
            title={btn.label}
          >
            <Icon size={18} />
            <span className="text-[10px] sm:text-xs">{btn.label}</span>
          </Button>
        );
      })}

      <Button
        variant="ghost"
        onClick={toggle}
        className="flex flex-col items-center gap-1 p-2 h-auto text-text-muted hover:text-text min-w-[48px]"
        title={dark ? 'Light mode' : 'Dark mode'}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        <span className="text-[10px] sm:text-xs">Theme</span>
      </Button>

      <Button
        variant="ghost"
        onClick={() => showLogoutConfirm.setTrue()}
        className="flex flex-col items-center gap-1 p-2 h-auto text-text-muted hover:text-danger hover:bg-danger-light min-w-[48px]"
        title="Sign out"
      >
        <LogOut size={18} />
        <span className="text-[10px] sm:text-xs">Logout</span>
      </Button>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        open={showLogoutConfirm.value}
        message="Are you sure you want to sign out?"
        confirmText="Sign out"
        variant="danger"
        onConfirm={() => {
          showLogoutConfirm.setFalse();
          signOut();
        }}
        onClose={() => showLogoutConfirm.setFalse()}
      />
    </div>
  );
}
