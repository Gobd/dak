import { CalendarDays, User, Calendar, Trophy } from 'lucide-react';
import type { DashboardView } from '../types';
import { useSettingsStore } from '../stores/settings-store';

interface TabBarProps {
  activeView: DashboardView;
  onViewChange: (view: DashboardView) => void;
}

const allTabs: {
  id: DashboardView;
  label: string;
  icon: typeof CalendarDays;
}[] = [
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'my-tasks', label: 'By Person', icon: User },
  { id: 'weekly', label: 'Weekly', icon: Calendar },
  { id: 'leaderboard', label: 'Points', icon: Trophy },
];

export function TabBar({ activeView, onViewChange }: TabBarProps) {
  const { settings } = useSettingsStore();
  const hidePoints = settings?.hide_points ?? false;

  // Filter out leaderboard tab when points are hidden
  const tabs = hidePoints ? allTabs.filter((t) => t.id !== 'leaderboard') : allTabs;

  return (
    <div className="flex bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-700">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 text-sm font-medium transition-colors ${
              isActive
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                : 'text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-800'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs sm:text-sm">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
