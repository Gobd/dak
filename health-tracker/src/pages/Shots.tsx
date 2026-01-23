import { useEffect, useState, useCallback } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { useShotsStore } from '../stores/shots-store';
import {
  ConfirmModal,
  Modal,
  DateTimePicker,
  DatePickerCompact,
  NumberPickerCompact,
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
  const [showAddForm, setShowAddForm] = useState(false);
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
  const [useCustomTime, setUseCustomTime] = useState(false);

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
    setShowAddForm(false);
    setPersonId('');
    setName('');
    setIntervalDays(7);
    setCurrentDose('');
    setNextDue(new Date());
  };

  const handleLogShot = async (scheduleId: string) => {
    if (!logDose) return;
    const takenAt = useCustomTime && logTime ? logTime : undefined;
    await logShot(scheduleId, logDose, logNotes || undefined, takenAt);
    setShowLogForm(null);
    setLogDose('');
    setLogNotes('');
    setLogTime(null);
    setUseCustomTime(false);
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
  const btnSecondary =
    'px-3 py-2 border border-border rounded-lg hover:bg-surface-sunken text-text-secondary';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shot Tracking</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-accent text-text px-4 py-2 rounded-lg hover:bg-accent-hover"
        >
          <Plus size={18} /> Add
        </button>
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
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="New Shot Schedule"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={`flex-1 ${btnSecondary}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-schedule-form"
              className="flex-1 bg-accent text-text px-4 py-2 rounded-lg hover:bg-accent-hover"
            >
              Create
            </button>
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
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Medicine Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ozempic, Mounjaro"
              className={inputClass}
              required
            />
          </div>
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
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">
                Starting Dose (optional)
              </label>
              <input
                type="text"
                value={currentDose}
                onChange={(e) => setCurrentDose(e.target.value)}
                placeholder="e.g., 0.5mg"
                className={inputClass}
              />
            </div>
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
        <div className="bg-surface rounded-xl shadow-sm p-6 text-center text-text-muted">
          No shot schedules yet. Create one to start tracking.
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="bg-surface rounded-xl shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Syringe className="text-accent" size={24} />
                    <div>
                      <div className="font-semibold">{schedule.person?.name}</div>
                      <div className="text-text-secondary text-text-muted">{schedule.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-text-muted">Next due</div>
                    <div className="font-bold text-lg">
                      {format(new Date(schedule.next_due + 'T00:00:00'), 'EEE, MMM d')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-text-secondary text-text-muted mb-4">
                  <span>Every {schedule.interval_days} days</span>
                  <span>•</span>
                  <span>{schedule.current_dose}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setLogDose(schedule.current_dose);
                      setShowLogForm(schedule.id);
                    }}
                    className="bg-success text-text px-4 py-2 rounded-lg hover:bg-success-hover font-medium"
                  >
                    Log Shot
                  </button>
                  <button
                    onClick={() => pushNextDue(schedule.id, 1)}
                    className={`flex items-center gap-1 ${btnSecondary}`}
                  >
                    <ChevronRight size={16} />
                    +1 day
                  </button>
                  <button
                    onClick={() => pushNextDue(schedule.id, -1)}
                    className={`flex items-center gap-1 ${btnSecondary}`}
                  >
                    <ChevronLeft size={16} />
                    -1 day
                  </button>
                  <button
                    onClick={() => handleShowHistory(schedule.id)}
                    className={`flex items-center gap-1 ${btnSecondary}`}
                  >
                    <History size={16} />
                    History
                  </button>
                  <button onClick={() => setShowEditForm(schedule.id)} className={btnSecondary}>
                    Edit
                  </button>
                  <button
                    onClick={() => setConfirmDelete(schedule.id)}
                    className="px-3 py-2 text-danger border border-danger rounded-lg hover:bg-danger-light dark:hover:bg-danger-light"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {showHistory === schedule.id && (
                <div className="border-t border-border bg-surface p-4">
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
                              <span className="text-text-secondary text-text-muted">
                                {log.dose}
                              </span>
                              <button
                                onClick={() =>
                                  setConfirmLogDelete({
                                    scheduleId: schedule.id,
                                    logId: log.id,
                                  })
                                }
                                className="p-1 text-danger hover:bg-danger-light dark:hover:bg-danger-light rounded"
                                title="Delete this entry"
                              >
                                <Trash2 size={14} />
                              </button>
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
                    <div>
                      <label className="block text-sm font-medium mb-1 text-text-secondary">
                        Dose
                      </label>
                      <input
                        type="text"
                        value={logDose}
                        onChange={(e) => setLogDose(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-text-secondary">
                          Time
                        </label>
                        <button
                          type="button"
                          onClick={() => setUseCustomTime(!useCustomTime)}
                          className={`text-sm px-3 py-1 rounded-full ${useCustomTime ? 'bg-accent text-text' : 'bg-surface-sunken text-text-secondary'}`}
                        >
                          {useCustomTime ? 'Custom time' : 'Now'}
                        </button>
                      </div>
                      {useCustomTime && (
                        <DateTimePicker value={logTime} onChange={handleTimeChange} />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-text-secondary">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={logNotes}
                        onChange={(e) => setLogNotes(e.target.value)}
                        placeholder="Any notes..."
                        className={inputClass}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setShowLogForm(null);
                          setUseCustomTime(false);
                        }}
                        className={btnSecondary}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleLogShot(schedule.id)}
                        className="bg-success text-text px-4 py-2 rounded-lg hover:bg-success-hover"
                      >
                        Log Shot
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showEditForm === schedule.id && (
                <div className="border-t border-border bg-surface-raised p-4">
                  <h3 className="font-medium mb-3">Edit Schedule</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1 text-text-secondary">
                          Interval (days)
                        </label>
                        <input
                          type="number"
                          defaultValue={schedule.interval_days}
                          id={`interval-${schedule.id}`}
                          min={1}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1 text-text-secondary">
                          Current Dose
                        </label>
                        <input
                          type="text"
                          defaultValue={schedule.current_dose}
                          id={`dose-${schedule.id}`}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setShowEditForm(null)} className={btnSecondary}>
                        Cancel
                      </button>
                      <button
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
                        className="bg-accent text-text px-4 py-2 rounded-lg hover:bg-accent-hover"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
