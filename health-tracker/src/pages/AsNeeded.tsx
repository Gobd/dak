import { useEffect, useState, useCallback } from "react";
import { usePeopleStore } from "../stores/people-store";
import { usePrnStore } from "../stores/prn-store";
import { ConfirmModal } from "../components/ConfirmModal";
import { TimePicker } from "../components/TimePicker";
import {
  Plus,
  Clock,
  Undo2,
  Trash2,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  format,
  formatDistanceToNow,
  differenceInHours,
  differenceInMinutes,
  addHours,
} from "date-fns";

export function AsNeeded() {
  const { people, fetchPeople } = usePeopleStore();
  const { meds, logs, fetchMeds, addMed, deleteMed, giveMed, undoLastDose } =
    usePrnStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedPersons, setExpandedPersons] = useState<Set<string>>(
    new Set(),
  );
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
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [minHours, setMinHours] = useState<number | "">("");

  useEffect(() => {
    fetchPeople();
    fetchMeds();
  }, [fetchPeople, fetchMeds]);

  // Auto-refresh every minute to update countdowns
  useEffect(() => {
    const interval = setInterval(() => {
      // Force re-render to update time displays
      setShowAddForm((prev) => prev);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    await addMed({ person_id: personId, name, min_hours: Number(minHours) });
    setShowAddForm(false);
    setPersonId("");
    setName("");
    setMinHours("");
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
    const hoursSince = differenceInHours(
      new Date(),
      new Date(lastDose.given_at),
    );
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
    const isTodayDate =
      format(date, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");

    if (isTodayDate) {
      return `Today ${format(date, "h:mm a")}`;
    }
    return format(date, "MMM d h:mm a");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">As-Needed Tracking</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} />
          Add
        </button>
      </div>

      {confirmDelete && (
        <ConfirmModal
          message={`Delete ${meds.find((m) => m.id === confirmDelete)?.name}?`}
          onConfirm={() => {
            deleteMed(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Add Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add As-Needed</h2>
            <form onSubmit={handleAddMed} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                  Person
                </label>
                <select
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Ibuprofen, Tylenol, Zyrtec"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                  Minimum Hours Between Doses
                </label>
                <input
                  type="number"
                  value={minHours}
                  onChange={(e) =>
                    setMinHours(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  min={1}
                  max={72}
                  placeholder="6"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                  Common: Ibuprofen (6h), Tylenol (4h), Zyrtec (24h)
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Meds by Person */}
      {medsByPerson.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-neutral-400">
          No as-needed set up yet. Add one to start tracking.
        </div>
      ) : (
        <div className="space-y-3">
          {medsByPerson.map(({ person, meds: personMeds }) => {
            const isExpanded = expandedPersons.has(person.id);
            return (
              <div
                key={person.id}
                className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => togglePerson(person.id)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                >
                  <h2 className="font-semibold text-lg">{person.name}</h2>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-neutral-400">
                    <span className="text-sm">({personMeds.length})</span>
                    {isExpanded ? (
                      <ChevronDown size={20} />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="divide-y divide-gray-200 dark:divide-neutral-700">
                    {personMeds.map((med) => {
                      const lastDose = getLastDose(med.id);
                      const okToGive = canGive(med.id, med.min_hours);
                      const timeUntil = getTimeUntilNext(med.id, med.min_hours);

                      return (
                        <div key={med.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Clock className="text-gray-400" size={20} />
                              <div>
                                <div className="font-medium">{med.name}</div>
                                <div className="text-sm text-gray-500 dark:text-neutral-400">
                                  every {med.min_hours}h minimum
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setConfirmDelete(med.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between mt-3 p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg">
                            <div>
                              {lastDose ? (
                                <div className="text-sm">
                                  <span className="text-gray-500 dark:text-neutral-400">
                                    Last:
                                  </span>{" "}
                                  <span className="font-medium">
                                    {formatLastGiven(lastDose.given_at)}
                                  </span>
                                  <span className="text-gray-400 ml-2">
                                    (
                                    {formatDistanceToNow(
                                      new Date(lastDose.given_at),
                                      { addSuffix: true },
                                    )}
                                    )
                                  </span>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 dark:text-neutral-400">
                                  Never given
                                </div>
                              )}
                              {timeUntil && (
                                <div className="flex items-center gap-1 text-sm text-orange-600 mt-1">
                                  <AlertCircle size={14} />
                                  Wait {timeUntil}
                                </div>
                              )}
                              {okToGive && lastDose && (
                                <div className="flex items-center gap-1 text-sm text-green-600 mt-1">
                                  <Check size={14} />
                                  OK to give
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {lastDose && (
                                <button
                                  onClick={() => undoLastDose(med.id)}
                                  className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-700 dark:text-neutral-300"
                                  title="Undo last dose"
                                >
                                  <Undo2 size={16} />
                                  Undo
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (showTimeInput === med.id) {
                                    setShowTimeInput(null);
                                    setCustomTime(null);
                                  } else {
                                    setShowTimeInput(med.id);
                                    setCustomTime(null);
                                  }
                                }}
                                className={`text-sm px-3 py-1.5 rounded-full ${
                                  showTimeInput === med.id
                                    ? "bg-blue-600 text-white"
                                    : "bg-gray-200 dark:bg-neutral-600 text-gray-600 dark:text-neutral-300"
                                }`}
                              >
                                {showTimeInput === med.id
                                  ? "Custom time"
                                  : "Now"}
                              </button>
                              <button
                                onClick={() => {
                                  if (showTimeInput === med.id && customTime) {
                                    giveMed(med.id, customTime);
                                  } else {
                                    giveMed(med.id);
                                  }
                                  setShowTimeInput(null);
                                  setCustomTime(null);
                                }}
                                className={`px-4 py-2 rounded-lg font-medium ${
                                  okToGive
                                    ? "bg-green-600 text-white hover:bg-green-700"
                                    : "bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50"
                                }`}
                              >
                                Give
                              </button>
                            </div>
                          </div>
                          {showTimeInput === med.id && (
                            <div className="mt-3">
                              <TimePicker
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
              </div>
            );
          })}
        </div>
      )}

      {/* People without meds */}
      {people.filter((p) => !meds.some((m) => m.person_id === p.id)).length >
        0 &&
        medsByPerson.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-neutral-400 text-center">
            Add for:{" "}
            {people
              .filter((p) => !meds.some((m) => m.person_id === p.id))
              .map((p) => p.name)
              .join(", ")}
          </div>
        )}
    </div>
  );
}
