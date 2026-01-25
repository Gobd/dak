import { useEffect, useState, useRef } from 'react';
import { usePeopleStore } from '../stores/people-store';
import { useMedicineStore } from '../stores/medicine-store';
import {
  ConfirmModal,
  Modal,
  DatePickerCompact,
  NumberPickerCompact,
  Input,
  Button,
  Card,
} from '@dak/ui';
import { Plus, Pill, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { format, addDays } from 'date-fns';

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

  const isAllDosesTaken = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    return courseDoses.length > 0 && courseDoses.every((d) => d.taken);
  };
  // Course is active until all doses are taken (ignore end date so missed doses can still be tracked)
  const activeCourses = courses.filter((c) => !isAllDosesTaken(c.id));
  const completedCourses = courses.filter((c) => isAllDosesTaken(c.id));

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses Tracking</h1>
        <Button onClick={() => setShowAddForm(true)}>
          <Plus size={18} /> Add
        </Button>
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
            <Button variant="secondary" onClick={() => setShowAddForm(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" form="add-course-form" className="flex-1">
              Create
            </Button>
          </>
        }
      >
        <form id="add-course-form" onSubmit={handleAddCourse} className="space-y-4">
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
            label="Medicine Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Amoxicillin"
            required
          />
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">Start Date</label>
            <DatePickerCompact value={startDate} onChange={setStartDate} allowFuture={true} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">
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
              <label className="block text-sm font-medium mb-1 text-text-secondary">
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
          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes..."
          />
        </form>
      </Modal>

      {activeCourses.length === 0 && completedCourses.length === 0 ? (
        <Card padding="lg" className="shadow-sm text-center text-text-muted">
          No medicine courses yet. Create one to start tracking.
        </Card>
      ) : (
        <>
          {activeCourses.map((course) => {
            const dosesByDate = getDosesByDate(course.id);
            const { taken, total } = getProgress(course.id);
            const dates = Object.keys(dosesByDate).sort();

            return (
              <Card key={course.id} padding="none" className="shadow-sm overflow-hidden">
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Pill className="text-success" size={24} />
                      <div>
                        <div className="font-semibold">{course.person?.name}</div>
                        <div className="text-text-muted">{course.name}</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmDelete(course.id)}
                      className="text-danger hover:bg-danger-light"
                    >
                      <Trash2 size={18} />
                    </Button>
                  </div>
                  <div className="mt-2 text-sm text-text-muted">
                    {course.doses_per_day}x/day for {course.duration_days} days • Started{' '}
                    {format(new Date(course.start_date + 'T00:00:00'), 'MMM d')}
                  </div>
                  {course.notes && (
                    <div className="mt-2 text-sm text-text-muted italic">{course.notes}</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 bg-surface-sunken rounded-full h-2">
                      <div
                        className="bg-success h-2 rounded-full transition-all"
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
                        className={`flex items-center gap-4 p-2 rounded-lg ${isToday ? 'bg-surface-sunken' : ''}`}
                      >
                        <div className="w-20 text-sm font-medium">
                          {format(new Date(date + 'T00:00:00'), 'MMM d')}
                          {isToday && <span className="text-accent ml-1">•</span>}
                        </div>
                        <div className="flex gap-3">
                          {dayDoses.map((dose) => (
                            <label key={dose.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={dose.taken}
                                onChange={() => toggleDose(dose.id, !dose.taken)}
                                className="w-5 h-5 rounded border-border text-success focus:ring-success bg-surface-sunken"
                              />
                              <span
                                className={`text-sm ${dose.taken ? 'text-text-muted line-through' : ''}`}
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
              </Card>
            );
          })}

          {completedCourses.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-text-muted mb-4">Completed</h2>
              <div className="space-y-2">
                {completedCourses.map((course) => {
                  const { taken, total } = getProgress(course.id);
                  const isExpanded = expandedCompleted.has(course.id);
                  const dosesByDate = getDosesByDate(course.id);
                  const dates = Object.keys(dosesByDate).sort();
                  return (
                    <Card key={course.id} padding="none" className="overflow-hidden">
                      <Button
                        variant="ghost"
                        onClick={() => toggleCompleted(course.id)}
                        className="w-full p-4 flex items-center justify-between h-auto"
                      >
                        <div className="text-left">
                          <div className="font-medium text-text-secondary">
                            {course.person?.name} - {course.name}
                          </div>
                          <div className="text-sm text-text-muted">
                            {format(new Date(course.start_date + 'T00:00:00'), 'MMM d')} -{' '}
                            {format(
                              addDays(
                                new Date(course.start_date + 'T00:00:00'),
                                course.duration_days - 1,
                              ),
                              'MMM d',
                            )}
                          </div>
                          {course.notes && (
                            <div className="text-xs text-text-muted italic mt-1">
                              {course.notes}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-text-muted">
                            {taken}/{total} doses
                          </span>
                          {isExpanded ? (
                            <ChevronDown size={20} className="text-text-muted" />
                          ) : (
                            <ChevronRight size={20} className="text-text-muted" />
                          )}
                        </div>
                      </Button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                          <div className="flex justify-end mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDelete(course.id)}
                              className="text-danger hover:bg-danger-light"
                            >
                              <Trash2 size={14} /> Delete
                            </Button>
                          </div>
                          {dates.map((date) => {
                            const dayDoses = dosesByDate[date];
                            return (
                              <div key={date} className="flex items-center gap-4 p-2 rounded-lg">
                                <div className="w-20 text-sm font-medium text-text-muted">
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
                                        className="w-5 h-5 rounded border-border text-success focus:ring-success bg-surface-sunken"
                                      />
                                      <span
                                        className={`text-sm ${dose.taken ? 'text-text-muted line-through' : ''}`}
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
                    </Card>
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
