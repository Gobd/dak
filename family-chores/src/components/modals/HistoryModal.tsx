import { useEffect, useState } from 'react';
import { Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Modal } from '@dak/ui';
import { usePointsStore } from '../../stores/points-store';
import { useMembersStore } from '../../stores/members-store';
import { MemberAvatar } from '../shared/MemberAvatar';

interface HistoryModalProps {
  onClose: () => void;
}

export function HistoryModal({ onClose }: HistoryModalProps) {
  const { ledger, fetchLedger } = usePointsStore();
  const { members } = useMembersStore();
  const [filterMemberId, setFilterMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchLedger(filterMemberId ?? undefined, 100).then(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [filterMemberId, fetchLedger]);

  const getMember = (memberId: string) => members.find((m) => m.id === memberId);

  return (
    <Modal open={true} onClose={onClose} title="Points History">
      {/* Filter */}
      <div className="pb-4 border-b border-border mb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Filter size={16} className="text-text-muted flex-shrink-0" />
          <button
            onClick={() => setFilterMemberId(null)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
              filterMemberId === null ? 'bg-accent text-text' : 'bg-surface-sunken'
            }`}
          >
            All
          </button>
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => setFilterMemberId(member.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filterMemberId === member.id ? 'bg-accent text-text' : 'bg-surface-sunken'
              }`}
            >
              <span>{member.avatar_emoji}</span>
              <span>{member.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-text-muted">Loading...</div>
          </div>
        ) : ledger.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-text-muted">No history yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {ledger.map((entry) => {
              const member = getMember(entry.member_id);
              const isPositive = entry.amount > 0;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 p-4 hover:bg-surface-raised/50"
                >
                  {member && (
                    <MemberAvatar
                      name={member.name}
                      emoji={member.avatar_emoji}
                      color={member.color}
                      size="md"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">
                      {entry.transaction_type === 'earned'
                        ? 'Task completed'
                        : entry.transaction_type === 'redeemed'
                          ? (entry.notes ?? 'Points redeemed')
                          : (entry.notes ?? 'Adjustment')}
                    </p>
                    <p className="text-sm text-text-muted">
                      {member?.name} • {format(new Date(entry.created_at), 'MMM d, h:mm a')}
                    </p>
                  </div>

                  <span
                    className={`text-lg font-semibold ${
                      isPositive ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {entry.amount}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
