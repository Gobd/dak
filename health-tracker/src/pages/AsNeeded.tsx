import { useEffect, useState, useCallback } from 'react';
import { useInterval } from '@dak/hooks';
import { usePeopleStore } from '../stores/people-store';
import { usePrnStore } from '../stores/prn-store';
import { useToastStore } from '@dak/ui';
import {
  ConfirmModal,
  Modal,
  DateTimePicker,
  NumberPickerCompact,
  Input,
  Button,
  Card,
} from '@dak/ui';
import {
  Plus,
  Clock,
  Undo2,
  Trash2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  format,
  formatDistanceToNow,
  differenceInHours,
  differenceInMinutes,
  addHours,
} from 'date-fns';

export function AsNeeded() {
  const { people, fetchPeople } = usePeopleStore();
  const { meds, logs, fetchMeds, addMed, deleteMed, giveMed, undoLastDose } = usePrnStore();
  const { showToast } = useToastStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showTimeInput, setShowTimeInput] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState<Date | null>(null);

  const handleCustomTimeChange = useCallback((date: Date) => {
    setCustomTime(date);
  }, []);

  const togglePerson = (personId: string) => {
    setExpandedPersons((prev) => {
      const next = new Set(prev);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  };

  // Form state
  const [personId, setPersonId] = useState('');
  const [name, setName] = useState('');
  const [minHours, setMinHours] = useState(6);

  useEffect(() => {
    fetchPeople();
    fetchMeds();
  }, [fetchPeople, fetchMeds]);

  // Force re-render for relative timestamps
  const [, setTick] = useState(0);

  // Auto-refresh every minute to update countdowns
  useInterval(() => setTick((t) => t + 1), 60000);

  // Refresh immediately when returning from background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTick((t) => t + 1);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMed({ person_id: personId, name, min_hours: minHours });
    setShowAddForm(false);
    setPersonId('');
    setName('');
    setMinHours(6);
  };

  // Group meds by person
  const medsByPerson = people
    .map((person) => ({
      person,
      meds: meds.filter((m) => m.person_id === person.id),
    }))
    .filter((group) => group.meds.length > 0);

  const getLastDose = (medId: string) => {
    const medLogs = logs[medId] || [];
    return medLogs[0] || null;
  };

  const canGive = (medId: string, minHours: number) => {
    const lastDose = getLastDose(medId);
    if (!lastDose) return true;
    const hoursSince = differenceInHours(new Date(), new Date(lastDose.given_at));
    return hoursSince >= minHours;
  };

  const getTimeUntilNext = (medId: string, minHours: number) => {
    const lastDose = getLastDose(medId);
    if (!lastDose) return null;
    const nextTime = addHours(new Date(lastDose.given_at), minHours);
    const now = new Date();
    if (nextTime <= now) return null;

    const hoursLeft = differenceInHours(nextTime, now);
    const minutesLeft = differenceInMinutes(nextTime, now) % 60;

    if (hoursLeft > 0) {
      return `${hoursLeft}h ${minutesLeft}m`;
    }
    return `${minutesLeft}m`;
  };

  const formatLastGiven = (givenAt: string) => {
    const date = new Date(givenAt);
    const now = new Date();
    const isTodayDate = format(date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');

    if (isTodayDate) {
      return `Today ${format(date, 'h:mm a')}`;
    }
    return format(date, 'MMM d h:mm a');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">As-Needed Tracking</h1>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          Add
        </Button>
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        message={`Delete ${meds.find((m) => m.id === confirmDelete)?.name}?`}
        onConfirm={() => {
          if (confirmDelete) deleteMed(confirmDelete);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />

      {/* Add Form Modal */}
      <Modal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="Add As-Needed"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowAddForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" form="add-med-form" className="flex-1">
              Add
            </Button>
          </>
        }
      >
        <form id="add-med-form" onSubmit={handleAddMed} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Person</label>
            <select
              value={personId}
              onChange={(e) => setPersonId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg bg-surface-sunken text-text focus:outline-none focus:ring-2 focus:ring-accent"
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
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Ibuprofen, Tylenol, Zyrtec"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Minimum Hours Between Doses
            </label>
            <NumberPickerCompact
              value={minHours}
              onChange={setMinHours}
              min={1}
              max={72}
              suffix="hours"
              zeroLabel=""
            />
            <p className="text-sm text-text-muted mt-1">
              Common: Ibuprofen (6h), Tylenol (4h), Zyrtec (24h)
            </p>
          </div>
        </form>
      </Modal>

      {/* Meds by Person */}
      {medsByPerson.length === 0 ? (
        <Card padding="lg" className="text-center text-text-muted shadow-sm">
          No as-needed set up yet. Add one to start tracking.
        </Card>
      ) : (
        <div className="space-y-3">
          {medsByPerson.map(({ person, meds: personMeds }) => {
            const isExpanded = expandedPersons.has(person.id);
            return (
              <Card key={person.id} padding="none" className="shadow-sm overflow-hidden">
                <Button
                  variant="ghost"
                  onClick={() => togglePerson(person.id)}
                  className="w-full flex items-center justify-between px-4 py-3 h-auto"
                >
                  <h2 className="font-semibold text-lg">{person.name}</h2>
                  <div className="flex items-center gap-2 text-text-muted">
                    <span className="text-sm">({personMeds.length})</span>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  </div>
                </Button>
                {isExpanded && (
                  <div className="divide-y divide-border dark:divide-border">
                    {personMeds.map((med) => {
                      const lastDose = getLastDose(med.id);
                      const okToGive = canGive(med.id, med.min_hours);
                      const timeUntil = getTimeUntilNext(med.id, med.min_hours);

                      return (
                        <div key={med.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Clock className="text-text-muted" size={20} />
                              <div>
                                <div className="font-medium">{med.name}</div>
                                <div className="text-sm text-text-muted">
                                  every {med.min_hours}h minimum
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setConfirmDelete(med.id)}
                              className="text-danger hover:bg-danger-light"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>

                          <div className="flex items-center justify-between mt-3 p-3 bg-surface-raised rounded-lg">
                            <div>
                              {lastDose ? (
                                <div className="text-sm">
                                  <span className="text-text-muted">Last:</span>{' '}
                                  <span className="font-medium">
                                    {formatLastGiven(lastDose.given_at)}
                                  </span>
                                  <span className="text-text-muted ml-2">
                                    (
                                    {formatDistanceToNow(new Date(lastDose.given_at), {
                                      addSuffix: true,
                                    })}
                                    )
                                  </span>
                                </div>
                              ) : (
                                <div className="text-sm text-text-muted">Not given in last 48h</div>
                              )}
                              {timeUntil && (
                                <div className="flex items-center gap-1 text-sm text-warning mt-1">
                                  <AlertCircle size={14} />
                                  Wait {timeUntil}
                                </div>
                              )}
                              {okToGive && lastDose && (
                                <div className="flex items-center gap-1 text-sm text-success mt-1">
                                  <Check size={14} />
                                  OK to give
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {lastDose && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={async () => {
                                    const success = await undoLastDose(med.id);
                                    if (success) {
                                      showToast('Dose undone', 'success');
                                    } else {
                                      showToast('Failed to undo', 'error');
                                    }
                                  }}
                                  title="Undo last dose"
                                >
                                  <Undo2 size={16} />
                                  Undo
                                </Button>
                              )}
                              <Button
                                variant={showTimeInput === med.id ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => {
                                  if (showTimeInput === med.id) {
                                    setShowTimeInput(null);
                                    setCustomTime(null);
                                  } else {
                                    setShowTimeInput(med.id);
                                    setCustomTime(null);
                                  }
                                }}
                                className="rounded-full"
                              >
                                {showTimeInput === med.id ? 'Custom time' : 'Now'}
                              </Button>
                              <Button
                                variant={okToGive ? 'primary' : 'danger'}
                                onClick={async () => {
                                  const success =
                                    showTimeInput === med.id && customTime
                                      ? await giveMed(med.id, customTime)
                                      : await giveMed(med.id);
                                  if (success) {
                                    showToast(`${med.name} given`, 'success');
                                  } else {
                                    showToast('Failed to log dose', 'error');
                                  }
                                  setShowTimeInput(null);
                                  setCustomTime(null);
                                }}
                                className={
                                  okToGive
                                    ? 'bg-success hover:bg-success-hover'
                                    : 'bg-danger-light text-danger'
                                }
                              >
                                Give
                              </Button>
                            </div>
                          </div>
                          {showTimeInput === med.id && (
                            <div className="mt-3">
                              <DateTimePicker
                                value={customTime}
                                onChange={handleCustomTimeChange}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* People without meds */}
      {people.filter((p) => !meds.some((m) => m.person_id === p.id)).length > 0 &&
        medsByPerson.length > 0 && (
          <div className="text-sm text-text-muted text-center">
            Add for:{' '}
            {people
              .filter((p) => !meds.some((m) => m.person_id === p.id))
              .map((p) => p.name)
              .join(', ')}
          </div>
        )}
    </div>
  );
}
