import { useMemo } from "react";
import { format } from "date-fns";
import { Users, ClipboardList, Target } from "lucide-react";
import { useInstancesStore } from "../../stores/instances-store";
import { useMembersStore } from "../../stores/members-store";
import { useGoalsStore } from "../../stores/goals-store";
import { TaskCard } from "../shared/TaskCard";
import { GoalCard } from "../shared/GoalCard";
import { MemberAvatar } from "../shared/MemberAvatar";
import { ProgressRing } from "../shared/ProgressRing";
import type { FamilyMember, ChoreInstanceWithDetails } from "../../types";

interface TodayViewProps {
  onSelectMemberForTask: (
    instanceId: string,
    assignees: FamilyMember[],
  ) => void;
  onOpenFamily: () => void;
  onOpenChores: () => void;
}

export function TodayView({
  onSelectMemberForTask,
  onOpenFamily,
  onOpenChores,
}: TodayViewProps) {
  const { instances, loading, completeTask, uncompleteTask } =
    useInstancesStore();
  const { members } = useMembersStore();
  const { progress: goalProgress, recordCompletion, removeLastCompletion } =
    useGoalsStore();

  // Group goals by period
  const { dailyGoals, weeklyGoals, monthlyGoals } = useMemo(() => {
    const daily = goalProgress.filter((p) => p.chore.goal_period === "daily");
    const weekly = goalProgress.filter((p) => p.chore.goal_period === "weekly");
    const monthly = goalProgress.filter(
      (p) => p.chore.goal_period === "monthly",
    );
    return { dailyGoals: daily, weeklyGoals: weekly, monthlyGoals: monthly };
  }, [goalProgress]);

  // Separate instances by type
  const { memberInstances, sharedInstances } = useMemo(() => {
    const memberInst: Record<string, ChoreInstanceWithDetails[]> = {};
    const sharedInst: ChoreInstanceWithDetails[] = [];

    // Initialize groups for all members
    members.forEach((m) => {
      memberInst[m.id] = [];
    });

    instances.forEach((instance) => {
      if (instance.assigned_to) {
        // "everyone" mode - assigned to specific person
        if (memberInst[instance.assigned_to]) {
          memberInst[instance.assigned_to].push(instance);
        }
      } else {
        // "anyone" mode - shared task
        sharedInst.push(instance);
      }
    });

    return { memberInstances: memberInst, sharedInstances: sharedInst };
  }, [instances, members]);

  // Overall progress
  const totalTasks = instances.length;
  const completedTasks = instances.filter((i) => i.completed).length;
  const progressPercent =
    totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500 dark:text-neutral-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header with date and progress */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            {format(new Date(), "EEEE")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-neutral-400">
            {format(new Date(), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {completedTasks}/{totalTasks}
            </p>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              tasks done
            </p>
          </div>
          <ProgressRing percent={progressPercent} size={56} />
        </div>
      </div>

      {members.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-neutral-400">
              No family members yet
            </p>
            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">
              Start by adding your family
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
      ) : totalTasks === 0 ? (
        <div className="text-center py-12 space-y-4">
          <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center">
            <ClipboardList className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
          </div>
          <div>
            <p className="text-gray-500 dark:text-neutral-400">
              No tasks scheduled for today
            </p>
            <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">
              Create chores and assign them to family members
            </p>
          </div>
          <button
            onClick={onOpenChores}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ClipboardList size={18} />
            Add Chores
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Shared tasks (anyone mode) */}
          {sharedInstances.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-4 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">🏆</span>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Shared Tasks
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    First to complete wins the points!
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {sharedInstances.map((instance) => (
                  <TaskCard
                    key={instance.id}
                    instance={instance}
                    showAssignees={true}
                    onToggle={() => {
                      if (instance.completed) {
                        uncompleteTask(instance.id);
                      } else {
                        // Show member picker for shared tasks
                        onSelectMemberForTask(instance.id, instance.assignees);
                      }
                    }}
                    onSelectMember={() =>
                      onSelectMemberForTask(instance.id, instance.assignees)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Member columns - responsive grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {members.map((member) => {
              const memberTasks = memberInstances[member.id] || [];
              if (memberTasks.length === 0) return null;

              const memberCompleted = memberTasks.filter(
                (t) => t.completed,
              ).length;
              const memberPercent =
                memberTasks.length > 0
                  ? (memberCompleted / memberTasks.length) * 100
                  : 0;

              return (
                <div
                  key={member.id}
                  className="bg-gray-50 dark:bg-neutral-900 rounded-2xl p-4"
                >
                  {/* Member header */}
                  <div className="flex items-center gap-3 mb-4">
                    <MemberAvatar
                      name={member.name}
                      emoji={member.avatar_emoji}
                      color={member.color}
                      size="lg"
                    />
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                        {member.name}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-neutral-400">
                        {memberCompleted}/{memberTasks.length} done
                      </p>
                    </div>
                    <ProgressRing
                      percent={memberPercent}
                      size={40}
                      strokeWidth={3}
                    />
                  </div>

                  {/* Tasks */}
                  <div className="space-y-3">
                    {memberTasks.map((instance) => (
                      <TaskCard
                        key={instance.id}
                        instance={instance}
                        showAssignees={false}
                        onToggle={() => {
                          if (instance.completed) {
                            uncompleteTask(instance.id);
                          } else {
                            // Direct complete - assigned to this member
                            completeTask(instance.id, member.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily Goals */}
          {dailyGoals.length > 0 && (
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    Daily Goals
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Complete these goals today
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {dailyGoals.map((progress) => (
                  <GoalCard
                    key={`${progress.chore.id}-${progress.member.id}`}
                    progress={progress}
                    onIncrement={() =>
                      recordCompletion(progress.chore.id, progress.member.id)
                    }
                    onDecrement={() =>
                      removeLastCompletion(progress.chore.id, progress.member.id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Weekly Goals */}
          {weeklyGoals.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    This Week
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Weekly goals to achieve
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {weeklyGoals.map((progress) => (
                  <GoalCard
                    key={`${progress.chore.id}-${progress.member.id}`}
                    progress={progress}
                    onIncrement={() =>
                      recordCompletion(progress.chore.id, progress.member.id)
                    }
                    onDecrement={() =>
                      removeLastCompletion(progress.chore.id, progress.member.id)
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Monthly Goals */}
          {monthlyGoals.length > 0 && (
            <div className="bg-teal-50 dark:bg-teal-900/20 rounded-2xl p-4 border border-teal-200 dark:border-teal-800">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    This Month
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">
                    Monthly goals to achieve
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {monthlyGoals.map((progress) => (
                  <GoalCard
                    key={`${progress.chore.id}-${progress.member.id}`}
                    progress={progress}
                    onIncrement={() =>
                      recordCompletion(progress.chore.id, progress.member.id)
                    }
                    onDecrement={() =>
                      removeLastCompletion(progress.chore.id, progress.member.id)
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
