import { useEffect, useState, useRef } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { useMedicineStore } from '../stores/medicine-store';
import { ConfirmModal, Modal, DatePickerCompact, NumberPickerCompact } from '@dak/ui';
import { Plus, Pill, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { format, addDays, isAfter } from 'date-fns';

export function Courses() {
  const { people, fetchPeople } = usePeopleStore();
  const { courses, doses, fetchCourses, fetchDoses, addCourse, deleteCourse, toggleDose } =
    useMedicineStore();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const toggleCompleted = (courseId: string) => {
    setExpandedCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const [personId, setPersonId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [durationDays, setDurationDays] = useState(7);
  const [dosesPerDay, setDosesPerDay] = useState(2);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchPeople();
    fetchCourses();
  }, [fetchPeople, fetchCourses]);
  useEffect(() => {
    courses.forEach((course) => fetchDoses(course.id));
  }, [courses, fetchDoses]);

  // Track previous completion state to detect transitions
  const prevCompletionState = useRef<Record<string, boolean>>({});

  // Auto-collapse when a course transitions to fully completed
  useEffect(() => {
    courses.forEach((course) => {
      const courseDoses = doses[course.id] || [];
      const allTaken = courseDoses.length > 0 && courseDoses.every((d) => d.taken);
      const wasCompleted = prevCompletionState.current[course.id] ?? false;

      // Only collapse if transitioning from not-completed to completed
      if (allTaken && !wasCompleted) {
        setExpandedCompleted((prev) => {
          const next = new Set(prev);
          next.delete(course.id);
          return next;
        });
      }

      prevCompletionState.current[course.id] = allTaken;
    });
  }, [doses, courses]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCourse({
      person_id: personId,
      name,
      start_date: format(startDate, 'yyyy-MM-dd'),
      duration_days: durationDays,
      doses_per_day: dosesPerDay,
      notes: notes || undefined,
    });
    setShowAddForm(false);
    setPersonId('');
    setName('');
    setStartDate(new Date());
    setDurationDays(7);
    setDosesPerDay(2);
    setNotes('');
  };

  const now = new Date();
  const isAllDosesTaken = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    return courseDoses.length > 0 && courseDoses.every((d) => d.taken);
  };
  const activeCourses = courses.filter((c) => {
    const endDate = addDays(new Date(c.start_date + 'T00:00:00'), c.duration_days);
    const dateActive =
      isAfter(endDate, now) || format(endDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
    return dateActive && !isAllDosesTaken(c.id);
  });
  const completedCourses = courses.filter((c) => {
    const endDate = addDays(new Date(c.start_date + 'T00:00:00'), c.duration_days);
    const dateEnded =
      !isAfter(endDate, now) && format(endDate, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd');
    return dateEnded || isAllDosesTaken(c.id);
  });

  const getDosesByDate = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    const grouped: Record<string, typeof courseDoses> = {};
    courseDoses.forEach((dose) => {
      if (!grouped[dose.scheduled_date]) grouped[dose.scheduled_date] = [];
      grouped[dose.scheduled_date].push(dose);
    });
    return grouped;
  };

  const getProgress = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    return {
      taken: courseDoses.filter((d) => d.taken).length,
      total: courseDoses.length,
    };
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  const btnSecondary =
    'flex-1 px-4 py-2 border border-gray-300 dark:border-neutral-600 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-700 dark:text-neutral-300';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses Tracking</h1>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={18} /> Add
        </button>
      </div>

      <ConfirmModal
        open={!!confirmDelete}
        message="Delete this course?"
        onConfirm={() => {
          if (confirmDelete) deleteCourse(confirmDelete);
          setConfirmDelete(null);
        }}
        onClose={() => setConfirmDelete(null)}
      />

      <Modal
        open={showAddForm}
        onClose={() => setShowAddForm(false)}
        title="New Medicine Course"
        actions={
          <>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-course-form"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create
            </button>
          </>
        }
      >
        <form id="add-course-form" onSubmit={handleAddCourse} className="space-y-4">
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
              placeholder="e.g., Amoxicillin"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
              Start Date
            </label>
            <DatePickerCompact
              value={startDate}
              onChange={setStartDate}
              allowFuture={true}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                Duration (days)
              </label>
              <NumberPickerCompact
                value={durationDays}
                onChange={setDurationDays}
                min={1}
                max={30}
                suffix="days"
                zeroLabel=""
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
                Doses per day
              </label>
              <NumberPickerCompact
                value={dosesPerDay}
                onChange={setDosesPerDay}
                min={1}
                max={10}
                suffix="doses"
                zeroLabel=""
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-neutral-300">
              Notes (optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes..."
              className={inputClass}
            />
          </div>
        </form>
      </Modal>

      {activeCourses.length === 0 && completedCourses.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 text-center text-gray-500 dark:text-neutral-400">
          No medicine courses yet. Create one to start tracking.
        </div>
      ) : (
        <>
          {activeCourses.map((course) => {
            const dosesByDate = getDosesByDate(course.id);
            const { taken, total } = getProgress(course.id);
            const dates = Object.keys(dosesByDate).sort();

            return (
              <div
                key={course.id}
                className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm overflow-hidden"
              >
                <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Pill className="text-green-600" size={24} />
                      <div>
                        <div className="font-semibold">{course.person?.name}</div>
                        <div className="text-gray-600 dark:text-neutral-400">{course.name}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setConfirmDelete(course.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-neutral-400">
                    {course.doses_per_day}x/day for {course.duration_days} days • Started{' '}
                    {format(new Date(course.start_date + 'T00:00:00'), 'MMM d')}
                  </div>
                  {course.notes && (
                    <div className="mt-2 text-sm text-gray-500 dark:text-neutral-500 italic">
                      {course.notes}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: total > 0 ? `${(taken / total) * 100}%` : '0%',
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {taken}/{total}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  {dates.map((date) => {
                    const dayDoses = dosesByDate[date];
                    const isToday = date === format(new Date(), 'yyyy-MM-dd');
                    return (
                      <div
                        key={date}
                        className={`flex items-center gap-4 p-2 rounded-lg ${isToday ? 'bg-gray-100 dark:bg-neutral-800' : ''}`}
                      >
                        <div className="w-20 text-sm font-medium">
                          {format(new Date(date + 'T00:00:00'), 'MMM d')}
                          {isToday && <span className="text-blue-600 ml-1">•</span>}
                        </div>
                        <div className="flex gap-3">
                          {dayDoses.map((dose) => (
                            <label key={dose.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={dose.taken}
                                onChange={() => toggleDose(dose.id, !dose.taken)}
                                className="w-5 h-5 rounded border-gray-300 dark:border-neutral-600 text-green-600 focus:ring-green-500 dark:bg-neutral-700"
                              />
                              <span
                                className={`text-sm ${dose.taken ? 'text-gray-400 line-through' : ''}`}
                              >
                                Dose {dose.dose_number}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {completedCourses.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-500 dark:text-neutral-400 mb-4">
                Completed
              </h2>
              <div className="space-y-2">
                {completedCourses.map((course) => {
                  const { taken, total } = getProgress(course.id);
                  const isExpanded = expandedCompleted.has(course.id);
                  const dosesByDate = getDosesByDate(course.id);
                  const dates = Object.keys(dosesByDate).sort();
                  return (
                    <div
                      key={course.id}
                      className="bg-gray-100 dark:bg-neutral-900 rounded-lg overflow-hidden"
                    >
                      <button
                        onClick={() => toggleCompleted(course.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <div className="text-left">
                          <div className="font-medium text-gray-700 dark:text-neutral-300">
                            {course.person?.name} - {course.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-neutral-400">
                            {format(new Date(course.start_date + 'T00:00:00'), 'MMM d')} -{' '}
                            {format(
                              addDays(
                                new Date(course.start_date + 'T00:00:00'),
                                course.duration_days - 1
                              ),
                              'MMM d'
                            )}
                          </div>
                          {course.notes && (
                            <div className="text-xs text-gray-500 dark:text-neutral-500 italic mt-1">
                              {course.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-500 dark:text-neutral-400">
                            {taken}/{total} doses
                          </span>
                          {isExpanded ? (
                            <ChevronDown size={20} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-400" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 border-t border-gray-200 dark:border-neutral-700 pt-3">
                          <div className="flex justify-end mb-2">
                            <button
                              onClick={() => setConfirmDelete(course.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-sm flex items-center gap-1"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                          {dates.map((date) => {
                            const dayDoses = dosesByDate[date];
                            return (
                              <div key={date} className="flex items-center gap-4 p-2 rounded-lg">
                                <div className="w-20 text-sm font-medium text-gray-600 dark:text-neutral-400">
                                  {format(new Date(date + 'T00:00:00'), 'MMM d')}
                                </div>
                                <div className="flex gap-3">
                                  {dayDoses.map((dose) => (
                                    <label
                                      key={dose.id}
                                      className="flex items-center gap-2 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={dose.taken}
                                        onChange={() => toggleDose(dose.id, !dose.taken)}
                                        className="w-5 h-5 rounded border-gray-300 dark:border-neutral-600 text-green-600 focus:ring-green-500 dark:bg-neutral-700"
                                      />
                                      <span
                                        className={`text-sm ${dose.taken ? 'text-gray-400 line-through' : ''}`}
                                      >
                                        Dose {dose.dose_number}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
