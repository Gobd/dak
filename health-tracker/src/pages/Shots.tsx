import { useEffect, useState, useCallback } from 'react';
import { useToggle } from '@dak/hooks';
import { usePeopleStore } from '../stores/people-store';
import { useShotsStore } from '../stores/shots-store';
import {
  ConfirmModal,
  Modal,
  DateTimePicker,
  DatePickerCompact,
  NumberPickerCompact,
  Input,
  Button,
  Card,
} from '@dak/ui';
import { Plus, Syringe, ChevronRight, ChevronLeft, History, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export function Shots() {
  const { people, fetchPeople } = usePeopleStore();
  const {
    schedules,
    logs,
    fetchSchedules,
    fetchLogs,
    addSchedule,
    logShot,
    pushNextDue,
    updateSchedule,
    deleteSchedule,
    deleteLog,
  } = useShotsStore();
  const showAddForm = useToggle(false);
  const [showLogForm, setShowLogForm] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmLogDelete, setConfirmLogDelete] = useState<{
    scheduleId: string;
    logId: string;
  } | null>(null);

  const [personId, setPersonId] = useState('');
  const [name, setName] = useState('');
  const [intervalDays, setIntervalDays] = useState(7);
  const [currentDose, setCurrentDose] = useState('');
  const [nextDue, setNextDue] = useState(new Date());
  const [logDose, setLogDose] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logTime, setLogTime] = useState<Date | null>(null);
  const useCustomTime = useToggle(false);

  useEffect(() => {
    fetchPeople();
    fetchSchedules();
  }, [fetchPeople, fetchSchedules]);

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await addSchedule({
      person_id: personId,
      name,
      interval_days: intervalDays,
      current_dose: currentDose,
      next_due: format(nextDue, 'yyyy-MM-dd'),
    });
    showAddForm.setFalse();
    setPersonId('');
    setName('');
    setIntervalDays(7);
    setCurrentDose('');
    setNextDue(new Date());
  };

  const handleLogShot = async (scheduleId: string) => {
    if (!logDose) return;
    const takenAt = useCustomTime.value && logTime ? logTime : undefined;
    await logShot(scheduleId, logDose, logNotes || undefined, takenAt);
    setShowLogForm(null);
    setLogDose('');
    setLogNotes('');
    setLogTime(null);
    useCustomTime.setFalse();
  };

  const handleTimeChange = useCallback((date: Date) => {
    setLogTime(date);
  }, []);

  const handleShowHistory = (scheduleId: string) => {
    fetchLogs(scheduleId);
    setShowHistory(showHistory === scheduleId ? null : scheduleId);
  };

  const handleUpdateSchedule = async (
    id: string,
    data: { interval_days?: number; current_dose?: string },
  ) => {
    await updateSchedule(id, data);
    setShowEditForm(null);
  };

  const inputClass =
    'w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text focus:outline-none focus:ring-2 focus:ring-accent';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shot Tracking</h1>
        <Button onClick={() => showAddForm.setTrue()}>
          <Plus size={18} /> Add
        </Button>
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        message="Delete this schedule?"
        onConfirm={() => {
          if (confirmDelete) deleteSchedule(confirmDelete);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={!!confirmLogDelete}
        message="Delete this history entry?"
        onConfirm={() => {
          if (confirmLogDelete) deleteLog(confirmLogDelete.scheduleId, confirmLogDelete.logId);
          setConfirmLogDelete(null);
        }}
        onClose={() => setConfirmLogDelete(null)}
      />

      <Modal
        open={showAddForm.value}
        onClose={() => showAddForm.setFalse()}
        title="New Shot Schedule"
        actions={
          <>
            <Button variant="secondary" onClick={() => showAddForm.setFalse()} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" form="add-schedule-form" className="flex-1">
              Create
            </Button>
          </>
        }
      >
        <form id="add-schedule-form" onSubmit={handleAddSchedule} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Person</label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Select person...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Medicine Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Ozempic, Mounjaro"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">
                Every X Days
              </label>
              <NumberPickerCompact
                value={intervalDays}
                onChange={setIntervalDays}
                min={1}
                max={90}
                suffix="days"
                zeroLabel=""
              />
            </div>
            <Input
              label="Starting Dose (optional)"
              value={currentDose}
              onChange={(e) => setCurrentDose(e.target.value)}
              placeholder="e.g., 0.5mg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Next Due Date
            </label>
            <DatePickerCompact value={nextDue} onChange={setNextDue} allowFuture={true} />
          </div>
        </form>
      </Modal>

      {schedules.length === 0 ? (
        <Card padding="lg" className="text-center text-text-muted">
          No shot schedules yet. Create one to start tracking.
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Syringe className="text-accent" size={24} />
                  <div>
                    <div className="font-semibold">{schedule.person?.name}</div>
                    <div className="text-text-muted">{schedule.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-text-muted">Next due</div>
                  <div className="font-bold text-lg">
                    {format(new Date(schedule.next_due + 'T00:00:00'), 'EEE, MMM d')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                <span>Every {schedule.interval_days} days</span>
                <span>•</span>
                <span>{schedule.current_dose}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setLogDose(schedule.current_dose);
                    setShowLogForm(schedule.id);
                  }}
                  className="bg-success hover:bg-success-hover"
                >
                  Log Shot
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pushNextDue(schedule.id, 1)}
                  className="gap-1"
                >
                  <ChevronRight size={16} />
                  +1 day
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => pushNextDue(schedule.id, -1)}
                  className="gap-1"
                >
                  <ChevronLeft size={16} />
                  -1 day
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleShowHistory(schedule.id)}
                  className="gap-1"
                >
                  <History size={16} />
                  History
                </Button>
                <Button variant="secondary" onClick={() => setShowEditForm(schedule.id)}>
                  Edit
                </Button>
                <Button variant="danger" onClick={() => setConfirmDelete(schedule.id)}>
                  Delete
                </Button>
              </div>

              {showHistory === schedule.id && (
                <div className="border-t border-border bg-surface-raised p-4">
                  <h3 className="font-medium mb-2">Shot History</h3>
                  {(logs[schedule.id] || []).length === 0 ? (
                    <p className="text-text-muted text-sm">No shots logged yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(logs[schedule.id] || []).map((log) => (
                        <div key={log.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span>{format(new Date(log.taken_at), 'MMM d, yyyy h:mm a')}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-text-muted">{log.dose}</span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setConfirmLogDelete({
                                    scheduleId: schedule.id,
                                    logId: log.id,
                                  })
                                }
                                className="text-danger hover:bg-danger-light"
                                title="Delete this entry"
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                          {log.notes && (
                            <p className="text-text-muted text-xs mt-1 ml-1">{log.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showLogForm === schedule.id && (
                <div className="border-t border-border bg-surface-raised p-4">
                  <h3 className="font-medium mb-3">Log Shot</h3>
                  <div className="space-y-3">
                    <Input
                      label="Dose"
                      value={logDose}
                      onChange={(e) => setLogDose(e.target.value)}
                    />
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-text-secondary">
                          Time
                        </label>
                        <Button
                          type="button"
                          variant={useCustomTime.value ? 'primary' : 'secondary'}
                          size="sm"
                          rounded
                          onClick={() => useCustomTime.toggle()}
                        >
                          {useCustomTime.value ? 'Custom time' : 'Now'}
                        </Button>
                      </div>
                      {useCustomTime.value && (
                        <DateTimePicker value={logTime} onChange={handleTimeChange} />
                      )}
                    </div>
                    <Input
                      label="Notes (optional)"
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="Any notes..."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowLogForm(null);
                          useCustomTime.setFalse();
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleLogShot(schedule.id)}
                        className="bg-success hover:bg-success-hover"
                      >
                        Log Shot
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {showEditForm === schedule.id && (
                <div className="border-t border-border bg-surface-raised p-4">
                  <h3 className="font-medium mb-3">Edit Schedule</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Interval (days)"
                        type="number"
                        defaultValue={schedule.interval_days}
                        id={`interval-${schedule.id}`}
                        min={1}
                      />
                      <Input
                        label="Current Dose"
                        defaultValue={schedule.current_dose}
                        id={`dose-${schedule.id}`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setShowEditForm(null)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          const interval = (
                            document.getElementById(`interval-${schedule.id}`) as HTMLInputElement
                          ).value;
                          const dose = (
                            document.getElementById(`dose-${schedule.id}`) as HTMLInputElement
                          ).value;
                          handleUpdateSchedule(schedule.id, {
                            interval_days: Number(interval),
                            current_dose: dose,
                          });
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
