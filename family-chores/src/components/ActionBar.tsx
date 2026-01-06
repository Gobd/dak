import { useState } from "react";
import {
  Settings,
  Users,
  ClipboardList,
  Gift,
  History,
  Moon,
  Sun,
  LogOut,
} from "lucide-react";
import { useThemeStore } from "../stores/theme-store";
import { useAuthStore } from "../stores/auth-store";
import { useSettingsStore } from "../stores/settings-store";

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
    { icon: Settings, label: "Settings", onClick: onOpenSettings, pin: true, hideWhenPointsHidden: false },
    { icon: Users, label: "Family", onClick: onOpenFamily, pin: true, hideWhenPointsHidden: false },
    { icon: ClipboardList, label: "Chores", onClick: onOpenChores, pin: true, hideWhenPointsHidden: false },
    { icon: Gift, label: "Redeem", onClick: onOpenRedeem, pin: true, hideWhenPointsHidden: true },
    { icon: History, label: "History", onClick: onOpenHistory, pin: false, hideWhenPointsHidden: true },
  ];

  const buttons = hidePoints
    ? allButtons.filter((b) => !b.hideWhenPointsHidden)
    : allButtons;

  return (
    <div className="flex items-center justify-around bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-700 px-2 py-2 sm:py-3">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors min-w-[48px]"
            title={btn.label}
          >
            <Icon size={18} />
            <span className="text-[10px] sm:text-xs">{btn.label}</span>
          </button>
        );
      })}

      <button
        onClick={toggle}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-900 dark:hover:text-white transition-colors min-w-[48px]"
        title={dark ? "Light mode" : "Dark mode"}
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
        <span className="text-[10px] sm:text-xs">Theme</span>
      </button>

      <button
        onClick={() => setShowLogoutConfirm(true)}
        className="flex flex-col items-center gap-1 p-2 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors min-w-[48px]"
        title="Sign out"
      >
        <LogOut size={18} />
        <span className="text-[10px] sm:text-xs">Logout</span>
      </button>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-xs p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Sign out?
            </h3>
            <p className="text-gray-500 dark:text-neutral-400 mb-6">
              Are you sure you want to sign out?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-neutral-600 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  signOut();
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
