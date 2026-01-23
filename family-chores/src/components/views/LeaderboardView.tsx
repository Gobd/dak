import { useEffect, useMemo } from 'react';
import { Trophy, Medal, Award, Users } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { usePointsStore } from '../../stores/points-store';
import { useMembersStore } from '../../stores/members-store';
import { MemberAvatar } from '../shared/MemberAvatar';

interface LeaderboardViewProps {
  onOpenFamily: () => void;
}

type Period = 'week' | 'month' | 'all';

const periodLabels: Record<Period, string> = {
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
};

export function LeaderboardView({ onOpenFamily }: LeaderboardViewProps) {
  const { periodPoints, balances, currentPeriod, setPeriod, loading } = usePointsStore();
  const { members } = useMembersStore();

  useEffect(() => {
    setPeriod(currentPeriod);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Calculate date range for current period
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (currentPeriod) {
      case 'week': {
        const weekStart = startOfWeek(now, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`;
      }
      case 'month': {
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        return `${format(monthStart, 'MMM d')} - ${format(monthEnd, 'MMM d')}`;
      }
      case 'all':
        return 'Since the beginning';
      default:
        return '';
    }
  }, [currentPeriod]);

  // Sort members by period points
  const sortedMembers = [...members].sort((a, b) => {
    const aPoints = periodPoints[a.id] ?? 0;
    const bPoints = periodPoints[b.id] ?? 0;
    return bPoints - aPoints;
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="text-warning" size={24} />;
      case 1:
        return <Medal className="text-text-muted" size={24} />;
      case 2:
        return <Award className="text-warning" size={24} />;
      default:
        return <span className="w-6 text-center text-text-muted font-medium">{index + 1}</span>;
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* Period selector */}
      <div className="space-y-2">
        <div className="flex bg-surface-sunken rounded-lg p-1">
          {(['week', 'month', 'all'] as Period[]).map((period) => (
            <button
              key={period}
              onClick={() => setPeriod(period)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                currentPeriod === period
                  ? 'bg-surface-sunken text-text shadow-sm'
                  : 'text-text-secondary text-text-muted hover:text-text dark:hover:text-text'
              }`}
            >
              {periodLabels[period]}
            </button>
          ))}
        </div>
        <p className="text-xs text-center text-text-muted">{dateRange}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-text-muted">Loading...</div>
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto bg-surface-sunken rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-text-muted" />
          </div>
          <div>
            <p className="text-text-muted">No family members yet</p>
            <p className="text-sm text-text-muted mt-1">Add your family to track points</p>
          </div>
          <button
            onClick={onOpenFamily}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-text rounded-lg hover:bg-accent-hover"
          >
            <Users size={18} />
            Add Family Members
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMembers.map((member, index) => {
            const points = periodPoints[member.id] ?? 0;
            const totalBalance = balances[member.id] ?? 0;
            const isTop3 = index < 3;

            return (
              <div
                key={member.id}
                className={`flex items-center gap-4 p-4 rounded-xl ${
                  isTop3 ? 'bg-surface-raised shadow-sm' : 'bg-surface'
                } ${index === 0 ? 'ring-2 ring-gold' : ''}`}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8">{getRankIcon(index)}</div>

                {/* Avatar */}
                <MemberAvatar
                  name={member.name}
                  emoji={member.avatar_emoji}
                  color={member.color}
                  size={isTop3 ? 'lg' : 'md'}
                />

                {/* Name and balance */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-text truncate">{member.name}</h3>
                  <p className="text-sm text-text-muted">{totalBalance} total points</p>
                </div>

                {/* Period points */}
                <div className="text-right">
                  <p
                    className={`text-xl font-bold ${
                      index === 0
                        ? 'text-warning'
                        : index === 1
                          ? 'text-text-muted'
                          : index === 2
                            ? 'text-warning'
                            : 'text-accent'
                    }`}
                  >
                    {points}
                  </p>
                  <p className="text-xs text-text-muted">pts</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
