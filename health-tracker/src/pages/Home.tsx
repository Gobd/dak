import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePeopleStore } from '../stores/people-store';
import { useShotsStore } from '../stores/shots-store';
import { useMedicineStore } from '../stores/medicine-store';
import { usePrnStore } from '../stores/prn-store';
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  addDays,
  differenceInHours,
  addHours,
} from 'date-fns';
import { Syringe, Pill, AlertCircle, CheckCircle2, Clock, Check } from 'lucide-react';

export function Home() {
  const { people, fetchPeople } = usePeopleStore();
  const { schedules, fetchSchedules } = useShotsStore();
  const { courses, doses, fetchCourses, fetchDoses } = useMedicineStore();
  const { meds: prnMeds, logs: prnLogs, fetchMeds: fetchPrnMeds } = usePrnStore();

  useEffect(() => {
    fetchPeople();
    fetchSchedules();
    fetchCourses();
    fetchPrnMeds();
  }, [fetchPeople, fetchSchedules, fetchCourses, fetchPrnMeds]);

  // Fetch doses for active courses
  useEffect(() => {
    courses.forEach((course) => {
      const endDate = addDays(new Date(course.start_date + 'T00:00:00'), course.duration_days);
      if (endDate >= new Date()) {
        fetchDoses(course.id);
      }
    });
  }, [courses, fetchDoses]);

  // Get upcoming shots (hide if 3x overdue - likely discontinued)
  const upcomingShots = schedules
    .filter((s) => {
      if (!s.next_due) return false;
      const dueDate = new Date(s.next_due + 'T00:00:00');
      const now = new Date();
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      // Hide if more than 3x the interval has passed
      const maxOverdueDays = s.interval_days * 3;
      return daysPastDue <= maxOverdueDays;
    })
    .sort(
      (a, b) =>
        new Date(a.next_due + 'T00:00:00').getTime() - new Date(b.next_due + 'T00:00:00').getTime()
    );

  // Check if all doses are taken for a course
  const isAllDosesTaken = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    return courseDoses.length > 0 && courseDoses.every((d) => d.taken);
  };

  // Get active medicine courses (not date-ended AND not all doses taken)
  const activeCourses = courses.filter((c) => {
    const endDate = addDays(new Date(c.start_date + 'T00:00:00'), c.duration_days);
    const dateActive = endDate >= new Date();
    return dateActive && !isAllDosesTaken(c.id);
  });

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isPast(date) && !isToday(date)) return 'Overdue!';
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const getDueDateClass = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    if (isPast(date) && !isToday(date)) return 'text-red-600 font-bold';
    if (isToday(date)) return 'text-orange-600 font-bold';
    return 'text-gray-600';
  };

  // Get today's medicine doses
  const getTodayProgress = (courseId: string) => {
    const courseDoses = doses[courseId] || [];
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayDoses = courseDoses.filter((d) => d.scheduled_date === today);
    const taken = todayDoses.filter((d) => d.taken).length;
    return { taken, total: todayDoses.length };
  };

  // PRN meds with recent activity (last 48 hours)
  const recentPrnMeds = prnMeds.filter((med) => {
    const medLogs = prnLogs[med.id] || [];
    if (medLogs.length === 0) return false;
    const lastDose = medLogs[0];
    const hoursSince = differenceInHours(new Date(), new Date(lastDose.given_at));
    return hoursSince <= 48;
  });

  const getPrnStatus = (medId: string, minHours: number) => {
    const medLogs = prnLogs[medId] || [];
    if (medLogs.length === 0) return { canGive: true, timeUntil: null, lastGiven: null };
    const lastDose = medLogs[0];
    const hoursSince = differenceInHours(new Date(), new Date(lastDose.given_at));
    const canGive = hoursSince >= minHours;
    const nextTime = addHours(new Date(lastDose.given_at), minHours);
    const now = new Date();
    let timeUntil = null;
    if (!canGive) {
      const hoursLeft = Math.floor((nextTime.getTime() - now.getTime()) / (1000 * 60 * 60));
      const minsLeft = Math.floor(((nextTime.getTime() - now.getTime()) / (1000 * 60)) % 60);
      timeUntil = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;
    }
    const lastDate = new Date(lastDose.given_at);
    const lastGiven = isToday(lastDate)
      ? `Today ${format(lastDate, 'h:mm a')}`
      : format(lastDate, 'MMM d h:mm a');
    return { canGive, timeUntil, lastGiven };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Home</h1>

      {people.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-6 text-center">
          <p className="text-gray-500 dark:text-neutral-400 mb-4">
            Get started by adding family members
          </p>
          <Link
            to="/people"
            className="inline-block bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Add People
          </Link>
        </div>
      ) : (
        <>
          {/* Upcoming Shots - only show if there are shots */}
          {upcomingShots.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Syringe className="text-blue-600" size={20} />
                <h2 className="font-semibold">Upcoming Shots</h2>
              </div>
              <div className="space-y-3">
                {upcomingShots.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {schedule.person?.name} - {schedule.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-neutral-400">
                        {schedule.current_dose} • every {schedule.interval_days} days
                      </div>
                    </div>
                    <div className={getDueDateClass(schedule.next_due)}>
                      {formatDueDate(schedule.next_due)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Medicine - only show if there are active courses */}
          {activeCourses.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="text-green-600" size={20} />
                <h2 className="font-semibold">Active Medicine</h2>
              </div>
              <div className="space-y-3">
                {activeCourses.map((course) => {
                  const { taken, total } = getTodayProgress(course.id);
                  const allDone = total > 0 && taken === total;

                  return (
                    <div
                      key={course.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {course.person?.name} - {course.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-neutral-400">
                          {course.doses_per_day}x/day for {course.duration_days} days
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {total > 0 ? (
                          <>
                            {allDone ? (
                              <CheckCircle2 className="text-green-600" size={18} />
                            ) : (
                              <AlertCircle className="text-orange-500" size={18} />
                            )}
                            <span className={allDone ? 'text-green-600' : 'text-orange-600'}>
                              {taken}/{total} today
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500 dark:text-neutral-400 text-sm">
                            No doses today
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent As-Needed Meds - only show if there are recent doses */}
          {recentPrnMeds.length > 0 && (
            <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-purple-600" size={20} />
                <h2 className="font-semibold">As-Needed (Last 48h)</h2>
              </div>
              <div className="space-y-3">
                {recentPrnMeds.map((med) => {
                  const { canGive, timeUntil, lastGiven } = getPrnStatus(med.id, med.min_hours);
                  return (
                    <div
                      key={med.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800 rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {med.person?.name} - {med.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-neutral-400">
                          Last: {lastGiven} • every {med.min_hours}h
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canGive ? (
                          <>
                            <Check className="text-green-600" size={18} />
                            <span className="text-green-600">OK to give</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="text-orange-500" size={18} />
                            <span className="text-orange-600">Wait {timeUntil}</span>
                          </>
                        )}
                      </div>
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
