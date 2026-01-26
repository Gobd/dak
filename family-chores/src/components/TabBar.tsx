import { CalendarDays, User, Calendar, Trophy } from 'lucide-react';
import { Button } from '@dak/ui';
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
    <div className="flex bg-surface border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;
        return (
          <Button
            key={tab.id}
            variant="ghost"
            onClick={() => onViewChange(tab.id)}
            className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 py-3 sm:py-4 px-2 h-auto rounded-none ${
              isActive
                ? 'text-accent border-b-2 border-accent bg-accent-light'
                : 'text-text-muted hover:text-text hover:bg-surface-raised'
            }`}
          >
            <Icon size={20} />
            <span className="text-xs sm:text-sm">{tab.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
