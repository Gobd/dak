import { useState, useEffect } from 'react';
import { format, startOfWeek, addDays, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useChoresStore } from '../../stores/chores-store';
import { useMembersStore } from '../../stores/members-store';
import { MemberAvatar } from '../shared/MemberAvatar';
import type { ChoreInstance } from '../../types';

export function WeeklyView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [instances, setInstances] = useState<ChoreInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { chores } = useChoresStore();
  const { members } = useMembersStore();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Fetch instances for the week
  useEffect(() => {
    async function fetchWeekInstances() {
      setLoading(true);
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(addDays(weekStart, 6), 'yyyy-MM-dd');

      const { data } = await supabase
        .from('chore_instances')
        .select('*')
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate);

      setInstances(data ?? []);
      setLoading(false);
    }

    fetchWeekInstances();
  }, [weekStart]);

  const goToPrevWeek = () => setWeekStart((d) => addDays(d, -7));
  const goToNextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));

  // Get instances for a specific day
  const getInstancesForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return instances.filter((i) => i.scheduled_date === dateStr);
  };

  // Get member by ID
  const getMember = (memberId: string | null) => {
    if (!memberId) return null;
    return members.find((m) => m.id === memberId);
  };

  // Get chore by ID
  const getChore = (choreId: string) => {
    return chores.find((c) => c.id === choreId);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPrevWeek}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <ChevronLeft size={24} />
        </button>

        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {format(weekStart, 'MMMM yyyy')}
          </h2>
          <button onClick={goToThisWeek} className="text-sm text-blue-600 hover:underline">
            Today
          </button>
        </div>

        <button
          onClick={goToNextWeek}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="text-gray-500 dark:text-neutral-400">Loading...</div>
        </div>
      ) : (
        /* Week grid */
        <div className="grid grid-cols-7 gap-2">
          {/* Day headers */}
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={`text-center p-2 rounded-lg ${
                isToday(day) ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-50 dark:bg-neutral-900'
              }`}
            >
              <p className="text-xs text-gray-500 dark:text-neutral-400">{format(day, 'EEE')}</p>
              <p
                className={`text-lg font-semibold ${
                  isToday(day) ? 'text-blue-600' : 'text-gray-900 dark:text-white'
                }`}
              >
                {format(day, 'd')}
              </p>
            </div>
          ))}

          {/* Day content */}
          {weekDays.map((day) => {
            const dayInstances = getInstancesForDay(day);
            const completed = dayInstances.filter((i) => i.completed).length;
            const total = dayInstances.length;

            return (
              <button
                key={`content-${day.toISOString()}`}
                onClick={() => setSelectedDay(day)}
                className={`min-h-[100px] p-2 rounded-lg border text-left transition-all hover:ring-2 hover:ring-blue-300 dark:hover:ring-blue-700 ${
                  isToday(day)
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                    : 'border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800'
                }`}
              >
                {total > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500 dark:text-neutral-400">
                        {completed}/{total}
                      </span>
                      {completed === total && total > 0 && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </div>
                    {dayInstances.slice(0, 3).map((instance) => {
                      const chore = chores.find((c) => c.id === instance.chore_id);
                      return (
                        <div
                          key={instance.id}
                          className={`text-xs p-1 rounded truncate ${
                            instance.completed
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 line-through'
                              : 'bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-neutral-300'
                          }`}
                        >
                          {chore?.name ?? 'Unknown'}
                        </div>
                      );
                    })}
                    {dayInstances.length > 3 && (
                      <p className="text-xs text-gray-400 dark:text-neutral-500">
                        +{dayInstances.length - 3} more
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-neutral-500 text-center mt-4">
                    No tasks
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Day detail modal */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-neutral-700">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {format(selectedDay, 'EEEE')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-neutral-400">
                  {format(selectedDay, 'MMMM d, yyyy')}
                </p>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {getInstancesForDay(selectedDay).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-neutral-400 py-8">
                  No tasks scheduled for this day
                </p>
              ) : (
                getInstancesForDay(selectedDay).map((instance) => {
                  const chore = getChore(instance.chore_id);
                  const assignedMember = getMember(instance.assigned_to);
                  const completedByMember = getMember(instance.completed_by);

                  return (
                    <div
                      key={instance.id}
                      className={`p-3 rounded-xl border ${
                        instance.completed
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          : 'bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Completion indicator */}
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            instance.completed
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 dark:bg-neutral-700'
                          }`}
                        >
                          {instance.completed && <Check size={18} strokeWidth={3} />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3
                              className={`font-medium ${
                                instance.completed
                                  ? 'text-gray-500 dark:text-neutral-500 line-through'
                                  : 'text-gray-900 dark:text-white'
                              }`}
                            >
                              {chore?.name ?? 'Unknown chore'}
                            </h3>
                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs">
                              {instance.points_awarded ?? chore?.points ?? 0} pts
                            </span>
                          </div>

                          {/* Assignment info */}
                          <div className="flex items-center gap-2 mt-2">
                            {instance.completed && completedByMember ? (
                              <>
                                <MemberAvatar
                                  name={completedByMember.name}
                                  emoji={completedByMember.avatar_emoji}
                                  color={completedByMember.color}
                                  size="xs"
                                />
                                <span className="text-sm text-gray-500 dark:text-neutral-400">
                                  {completedByMember.name}
                                  {instance.completed_at && (
                                    <> at {format(new Date(instance.completed_at), 'h:mm a')}</>
                                  )}
                                </span>
                              </>
                            ) : assignedMember ? (
                              <>
                                <MemberAvatar
                                  name={assignedMember.name}
                                  emoji={assignedMember.avatar_emoji}
                                  color={assignedMember.color}
                                  size="xs"
                                />
                                <span className="text-sm text-gray-500 dark:text-neutral-400">
                                  Assigned to {assignedMember.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-amber-600 dark:text-amber-400">
                                Race - anyone can complete
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
