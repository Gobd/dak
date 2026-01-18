import { useState } from 'react';
import { Plus, Edit2, Trash2, Play, Trophy, User } from 'lucide-react';
import { Modal, ConfirmModal } from '@dak/ui';
import { useChoresStore } from '../../stores/chores-store';
import { useInstancesStore } from '../../stores/instances-store';
import { MemberAvatar } from '../shared/MemberAvatar';
import { ChoreEditModal } from './ChoreEditModal';
import type { ChoreWithAssignments } from '../../types';

interface ChoresModalProps {
  onClose: () => void;
}

export function ChoresModal({ onClose }: ChoresModalProps) {
  const { chores, addChore, updateChore, deleteChore, toggleActive } = useChoresStore();
  const { assignChoreNow } = useInstancesStore();

  const [editingChore, setEditingChore] = useState<ChoreWithAssignments | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const getScheduleLabel = (chore: ChoreWithAssignments) => {
    switch (chore.schedule_type) {
      case 'daily':
        return 'Daily';
      case 'every_x_days':
        return `Every ${chore.interval_days} days`;
      case 'weekly': {
        const days = chore.weekly_days ?? [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.map((d) => dayNames[d]).join(', ');
      }
      case 'monthly':
        return chore.monthly_day === -1
          ? 'Last day of month'
          : `${chore.monthly_day}${chore.monthly_day === 1 ? 'st' : chore.monthly_day === 2 ? 'nd' : chore.monthly_day === 3 ? 'rd' : 'th'} of month`;
      case 'as_needed':
        return 'As needed';
      default:
        return '';
    }
  };

  const handleSave = async (
    data: {
      name: string;
      description?: string;
      points: number;
      schedule_type: string;
      interval_days?: number;
      weekly_days?: number[];
      monthly_day?: number;
      assignment_type: 'anyone' | 'everyone';
    },
    assigneeIds: string[]
  ) => {
    if (editingChore) {
      await updateChore(editingChore.id, data as Parameters<typeof updateChore>[1], assigneeIds);
    } else {
      await addChore(data as Parameters<typeof addChore>[0], assigneeIds);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteChore(deleteConfirm);
    setDeleteConfirm(null);
  };

  const handleAssign = async (choreId: string, memberIds?: string[]) => {
    setAssigning(true);
    await assignChoreNow(choreId, memberIds);
    setAssigning(false);
    setAssigningId(null);
  };

  const activeChores = chores.filter((c) => c.is_active);
  const inactiveChores = chores.filter((c) => !c.is_active);

  return (
    <>
      <Modal open={true} onClose={onClose} title="Chores" wide>
        <div className="space-y-3">
          {/* Active chores */}
          {activeChores.map((chore) => (
            <div
              key={chore.id}
              className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Chore info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-gray-900 dark:text-white truncate">
                      {chore.name}
                    </h3>
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                      {chore.points} pts
                    </span>
                    {chore.assignments.length > 1 && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          chore.assignment_type === 'anyone'
                            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-neutral-700 text-gray-600 dark:text-neutral-400'
                        }`}
                      >
                        {chore.assignment_type === 'anyone' ? (
                          <>
                            <Trophy size={10} />
                            Race
                          </>
                        ) : (
                          <>
                            <User size={10} />
                            Each
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                      {getScheduleLabel(chore)}
                    </p>
                    <span className="text-gray-300 dark:text-neutral-600">•</span>
                    <div className="flex -space-x-1">
                      {chore.assignments.slice(0, 3).map((a) => (
                        <MemberAvatar
                          key={a.id}
                          name={a.member.name}
                          emoji={a.member.avatar_emoji}
                          color={a.member.color}
                          size="xs"
                        />
                      ))}
                      {chore.assignments.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-neutral-400 ml-1">
                          +{chore.assignments.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingChore(chore)}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-500 dark:text-neutral-400"
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(chore.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-neutral-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setAssigningId(assigningId === chore.id ? null : chore.id)}
                    className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                    title="Assign now"
                  >
                    <Play size={16} />
                  </button>
                </div>
              </div>

              {/* Assign now expanded */}
              {assigningId === chore.id && (
                <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/50">
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2">
                    Create task for today:
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => handleAssign(chore.id)}
                      disabled={assigning}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Play size={14} />
                      All ({chore.assignments.length})
                    </button>
                    {chore.assignments.map((a) => (
                      <button
                        key={a.member.id}
                        onClick={() => handleAssign(chore.id, [a.member.id])}
                        disabled={assigning}
                        className="flex items-center gap-1.5 px-2 py-1.5 bg-white dark:bg-neutral-700 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-600 disabled:opacity-50"
                      >
                        <MemberAvatar
                          name={a.member.name}
                          emoji={a.member.avatar_emoji}
                          color={a.member.color}
                          size="xs"
                        />
                        <span className="text-sm dark:text-white">{a.member.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Inactive chores */}
          {inactiveChores.length > 0 && (
            <div className="pt-4">
              <p className="text-xs text-gray-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
                Disabled
              </p>
              {inactiveChores.map((chore) => (
                <div
                  key={chore.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-100 dark:border-neutral-800 opacity-60 mb-2"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-600 dark:text-neutral-400 truncate">
                      {chore.name}
                    </h3>
                  </div>
                  <button
                    onClick={() => toggleActive(chore.id)}
                    className="px-3 py-1 text-sm text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg"
                  >
                    Enable
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(chore.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          <button
            onClick={() => setIsAddingNew(true)}
            className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-xl text-gray-500 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus size={20} /> Add Chore
          </button>
        </div>
      </Modal>

      {/* Edit/Add Modal */}
      {(editingChore || isAddingNew) && (
        <ChoreEditModal
          chore={editingChore ?? undefined}
          onSave={handleSave}
          onClose={() => {
            setEditingChore(null);
            setIsAddingNew(false);
          }}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteConfirm}
        message="Delete this chore? Task history will be preserved."
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirm(null)}
      />
    </>
  );
}
