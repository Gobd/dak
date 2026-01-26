import { useState } from 'react';
import { Plus, Edit2, Trash2, Play, Trophy, User } from 'lucide-react';
import { Avatar, Modal, ConfirmModal, Button } from '@dak/ui';
import { useChoresStore } from '../../stores/chores-store';
import { useInstancesStore } from '../../stores/instances-store';
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
    assigneeIds: string[],
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
              className="bg-surface-raised rounded-xl border border-border overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Chore info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-text truncate">{chore.name}</h3>
                    <span className="px-2 py-0.5 bg-accent-light text-accent rounded text-xs font-medium">
                      {chore.points} pts
                    </span>
                    {chore.assignments.length > 1 && (
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          chore.assignment_type === 'anyone'
                            ? 'bg-warning-light/50 text-warning'
                            : 'bg-surface-sunken text-text-secondary text-text-muted'
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
                    <p className="text-sm text-text-muted">{getScheduleLabel(chore)}</p>
                    <span className="text-text-secondary">•</span>
                    <div className="flex -space-x-1">
                      {chore.assignments.slice(0, 3).map((a) => (
                        <Avatar
                          key={a.id}
                          name={a.member.name}
                          emoji={a.member.avatar_emoji}
                          color={a.member.color}
                          size="xs"
                        />
                      ))}
                      {chore.assignments.length > 3 && (
                        <span className="text-xs text-text-muted ml-1">
                          +{chore.assignments.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingChore(chore)}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteConfirm(chore.id)}
                    className="text-text-muted hover:text-danger hover:bg-danger-light"
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    onClick={() => setAssigningId(assigningId === chore.id ? null : chore.id)}
                    className="bg-accent-light text-accent"
                    title="Assign now"
                  >
                    <Play size={16} />
                  </Button>
                </div>
              </div>

              {/* Assign now expanded */}
              {assigningId === chore.id && (
                <div className="px-3 pb-3 pt-2 border-t border-border bg-surface-raised/50">
                  <p className="text-xs text-text-muted mb-2">Create task for today:</p>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={() => handleAssign(chore.id)}
                      disabled={assigning}
                      size="sm"
                      className="gap-1.5"
                    >
                      <Play size={14} />
                      All ({chore.assignments.length})
                    </Button>
                    {chore.assignments.map((a) => (
                      <Button
                        key={a.member.id}
                        variant="secondary"
                        size="sm"
                        onClick={() => handleAssign(chore.id, [a.member.id])}
                        disabled={assigning}
                        className="flex items-center gap-1.5"
                      >
                        <Avatar
                          name={a.member.name}
                          emoji={a.member.avatar_emoji}
                          color={a.member.color}
                          size="xs"
                        />
                        <span className="text-sm text-text">{a.member.name}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Inactive chores */}
          {inactiveChores.length > 0 && (
            <div className="pt-4">
              <p className="text-xs text-text-muted uppercase tracking-wide mb-2">Disabled</p>
              {inactiveChores.map((chore) => (
                <div
                  key={chore.id}
                  className="flex items-center gap-3 p-3 bg-surface rounded-xl border border-border opacity-60 mb-2"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-secondary text-text-muted truncate">
                      {chore.name}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleActive(chore.id)}
                    className="text-success hover:bg-success-light"
                  >
                    Enable
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setDeleteConfirm(chore.id)}
                    className="text-text-muted hover:text-danger hover:bg-danger-light"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          <Button
            variant="ghost"
            onClick={() => setIsAddingNew(true)}
            className="w-full p-4 border-2 border-dashed border-border"
          >
            <Plus size={20} /> Add Chore
          </Button>
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
