import { useEffect, useState } from "react";
import { X, Filter } from "lucide-react";
import { format } from "date-fns";
import { usePointsStore } from "../../stores/points-store";
import { useMembersStore } from "../../stores/members-store";
import { MemberAvatar } from "../shared/MemberAvatar";

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

  const getMember = (memberId: string) =>
    members.find((m) => m.id === memberId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Points History
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            <Filter size={16} className="text-gray-400 flex-shrink-0" />
            <button
              onClick={() => setFilterMemberId(null)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                filterMemberId === null
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-neutral-800"
              }`}
            >
              All
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setFilterMemberId(member.id)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${
                  filterMemberId === member.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-neutral-800"
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
              <div className="text-gray-500 dark:text-neutral-400">
                Loading...
              </div>
            </div>
          ) : ledger.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-neutral-400">
                No history yet
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-neutral-800">
              {ledger.map((entry) => {
                const member = getMember(entry.member_id);
                const isPositive = entry.amount > 0;

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-neutral-800/50"
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
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {entry.transaction_type === "earned"
                          ? "Task completed"
                          : entry.transaction_type === "redeemed"
                            ? (entry.notes ?? "Points redeemed")
                            : (entry.notes ?? "Adjustment")}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-400">
                        {member?.name} •{" "}
                        {format(new Date(entry.created_at), "MMM d, h:mm a")}
                      </p>
                    </div>

                    <span
                      className={`text-lg font-semibold ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {entry.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
