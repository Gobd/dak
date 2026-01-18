import { useEffect, useState, useCallback } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { useShotsStore } from '../stores/shots-store';
import { ConfirmModal } from '../components/ConfirmModal';
import { TimePicker } from '../components/TimePicker';
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
  const [intervalDays, setIntervalDays] = useState<number | ''>('');
  const [currentDose, setCurrentDose] = useState('');
  const [nextDue, setNextDue] = useState(format(new Date(), 'yyyy-MM-dd'));
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
      interval_days: Number(intervalDays),
      current_dose: currentDose,
      next_due: nextDue,
    });
    setShowAddForm(false);
    setPersonId('');
    setName('');
    setIntervalDays('');
    setCurrentDose('');
    setNextDue(format(new Date(), 'yyyy-MM-dd'));
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
    data: { interval_days?: number; current_dose?: string }
  ) => {
    await updateSchedule(id, data);
    setShowEditForm(null);
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const btnSecondary =
    'px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-neutral-300';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shot Tracking</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message="Delete this schedule?"
          onConfirm={() => {
            deleteSchedule(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmLogDelete && (
        <ConfirmModal
          message="Delete this history entry?"
          onConfirm={() => {
            deleteLog(confirmLogDelete.scheduleId, confirmLogDelete.logId);
            setConfirmLogDelete(null);
          }}
          onCancel={() => setConfirmLogDelete(null)}
        />
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">New Shot Schedule</h2>
            <form onSubmit={handleAddSchedule} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                  Person
                </label>
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
                <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                  <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                    Every X Days
                  </label>
                  <input
                    type="number"
                    value={intervalDays}
                    onChange={(e) =>
                      setIntervalDays(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    min={1}
                    placeholder="7"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                  Next Due Date
                </label>
                <input
                  type="date"
                  value={nextDue}
                  onChange={(e) => setNextDue(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className={`flex-1 ${btnSecondary}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {schedules.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-neutral-400">
          No shot schedules yet. Create one to start tracking.
        </div>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Syringe className="text-blue-600" size={24} />
                    <div>
                      <div className="font-semibold">{schedule.person?.name}</div>
                      <div className="text-gray-600 dark:text-neutral-400">{schedule.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-neutral-400">Next due</div>
                    <div className="font-bold text-lg">
                      {format(new Date(schedule.next_due + 'T00:00:00'), 'EEE, MMM d')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-neutral-400 mb-4">
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
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
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
                    className="px-3 py-2 text-red-600 border border-red-300 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {showHistory === schedule.id && (
                <div className="border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 p-4">
                  <h3 className="font-medium mb-2">Shot History</h3>
                  {(logs[schedule.id] || []).length === 0 ? (
                    <p className="text-gray-500 dark:text-neutral-400 text-sm">
                      No shots logged yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(logs[schedule.id] || []).map((log) => (
                        <div key={log.id} className="text-sm">
                          <div className="flex items-center justify-between">
                            <span>{format(new Date(log.taken_at), 'MMM d, yyyy h:mm a')}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-gray-600 dark:text-neutral-400">
                                {log.dose}
                              </span>
                              <button
                                onClick={() =>
                                  setConfirmLogDelete({
                                    scheduleId: schedule.id,
                                    logId: log.id,
                                  })
                                }
                                className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                                title="Delete this entry"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          {log.notes && (
                            <p className="text-gray-500 dark:text-neutral-500 text-xs mt-1 ml-1">
                              {log.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showLogForm === schedule.id && (
                <div className="border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4">
                  <h3 className="font-medium mb-3">Log Shot</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                        <label className="block text-sm font-medium dark:text-neutral-300">
                          Time
                        </label>
                        <button
                          type="button"
                          onClick={() => setUseCustomTime(!useCustomTime)}
                          className={`text-sm px-3 py-1 rounded-full ${useCustomTime ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-neutral-600 text-gray-600 dark:text-neutral-300'}`}
                        >
                          {useCustomTime ? 'Custom time' : 'Now'}
                        </button>
                      </div>
                      {useCustomTime && <TimePicker value={logTime} onChange={handleTimeChange} />}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                      >
                        Log Shot
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {showEditForm === schedule.id && (
                <div className="border-t border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4">
                  <h3 className="font-medium mb-3">Edit Schedule</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                        <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
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
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
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
