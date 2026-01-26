import { getMotivation, getMotivationBgColor, getMotivationTextColor } from '../lib/motivation';
import type { StreakStats } from '../types';

interface MotivationBannerProps {
  todayUnits: number;
  dailyLimit: number;
  streaks: StreakStats | null;
}

export function MotivationBanner({ todayUnits, dailyLimit, streaks }: MotivationBannerProps) {
  const { message, level, subMessage } = getMotivation(todayUnits, dailyLimit, streaks);
  const bgColor = getMotivationBgColor(level);
  const textColor = getMotivationTextColor(level);

  return (
    <div className={`rounded-lg border px-4 py-3 ${bgColor}`}>
      <p className={`text-center font-medium ${textColor}`}>{message}</p>
      {subMessage && <p className="text-center text-sm text-text-muted mt-1">{subMessage}</p>}
    </div>
  );
}
