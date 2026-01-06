import { useState, useMemo } from "react";
import { format } from "date-fns";
import { Users, ClipboardList } from "lucide-react";
import { useInstancesStore } from "../../stores/instances-store";
import { useMembersStore } from "../../stores/members-store";
import { usePointsStore } from "../../stores/points-store";
import { TaskCard } from "../shared/TaskCard";
import { MemberAvatar } from "../shared/MemberAvatar";
import { ProgressRing } from "../shared/ProgressRing";

interface MyTasksViewProps {
  onOpenFamily: () => void;
  onOpenChores: () => void;
}

export function MyTasksView({ onOpenFamily, onOpenChores }: MyTasksViewProps) {
  const { instances, completeTask, uncompleteTask } = useInstancesStore();
  const { members } = useMembersStore();
  const { balances } = usePointsStore();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(
    members[0]?.id ?? null,
  );

  const selectedMember = members.find((m) => m.id === selectedMemberId);

  // Filter tasks for selected member:
  // 1. Personal tasks (assigned_to matches this member)
  // 2. Shared tasks (assigned_to is null) where this member is in assignees
  const { personalTasks, sharedTasks } = useMemo(() => {
    const personal = instances.filter(
      (instance) => instance.assigned_to === selectedMemberId,
    );
    const shared = instances.filter(
      (instance) =>
        !instance.assigned_to &&
        instance.assignees.some((a) => a.id === selectedMemberId),
    );
    return { personalTasks: personal, sharedTasks: shared };
  }, [instances, selectedMemberId]);

  const allMemberTasks = [...personalTasks, ...sharedTasks];
  const completedCount = allMemberTasks.filter((t) => t.completed).length;
  const progressPercent =
    allMemberTasks.length > 0
      ? (completedCount / allMemberTasks.length) * 100
      : 0;

  const memberBalance = selectedMemberId
    ? (balances[selectedMemberId] ?? 0)
    : 0;

  return (
    <div className="p-4 space-y-6">
      {/* Member selector */}
      <div className="mb-1">
        <p className="text-xs text-gray-500 dark:text-neutral-400">
          Tap a family member to see their tasks
        </p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {members.map((member) => (
          <MemberAvatar
            key={member.id}
            name={member.name}
            emoji={member.avatar_emoji}
            color={member.color}
            size="lg"
            showName
            selected={member.id === selectedMemberId}
            onClick={() => setSelectedMemberId(member.id)}
          />
        ))}
      </div>

      {selectedMember ? (
        <>
          {/* Stats */}
          <div className="flex items-center justify-between bg-white dark:bg-neutral-800 rounded-xl p-4 shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {selectedMember.name}'s Tasks
              </h2>
              <p className="text-sm text-gray-500 dark:text-neutral-400">
                {format(new Date(), "EEEE, MMMM d")}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  {memberBalance}
                </p>
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  total points
                </p>
              </div>
              <ProgressRing percent={progressPercent} size={56} />
            </div>
          </div>

          {/* Tasks */}
          {allMemberTasks.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-gray-500 dark:text-neutral-400">
                No tasks for {selectedMember.name} today
              </p>
              <button
                onClick={onOpenChores}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
              >
                <ClipboardList size={16} />
                Add Chores
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Personal tasks (everyone mode) */}
              {personalTasks.filter((t) => !t.completed).length > 0 && (
                <div className="space-y-3">
                  {personalTasks
                    .filter((t) => !t.completed)
                    .map((instance) => (
                      <TaskCard
                        key={instance.id}
                        instance={instance}
                        showAssignees={false}
                        onToggle={() =>
                          completeTask(instance.id, selectedMemberId!)
                        }
                      />
                    ))}
                </div>
              )}

              {/* Shared tasks (anyone mode) */}
              {sharedTasks.filter((t) => !t.completed).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <span>🏆</span> Race Tasks
                  </h3>
                  {sharedTasks
                    .filter((t) => !t.completed)
                    .map((instance) => (
                      <TaskCard
                        key={instance.id}
                        instance={instance}
                        showAssignees={true}
                        onToggle={() =>
                          completeTask(instance.id, selectedMemberId!)
                        }
                      />
                    ))}
                </div>
              )}

              {/* Completed tasks */}
              {allMemberTasks.filter((t) => t.completed).length > 0 && (
                <div className="pt-4 border-t border-gray-200 dark:border-neutral-700 space-y-3">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-neutral-400">
                    Completed
                  </h3>
                  {allMemberTasks
                    .filter((t) => t.completed)
                    .map((instance) => (
                      <TaskCard
                        key={instance.id}
                        instance={instance}
                        showAssignees={!instance.assigned_to}
                        onToggle={() => uncompleteTask(instance.id)}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-neutral-400">
              No family members yet
            </p>
            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">
              Add your family to start tracking tasks
            </p>
          </div>
          <button
            onClick={onOpenFamily}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Users size={18} />
            Add Family Members
          </button>
        </div>
      )}
    </div>
  );
}
