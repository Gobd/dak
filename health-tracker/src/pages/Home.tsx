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
import { Card } from '@dak/ui';

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
        new Date(a.next_due + 'T00:00:00').getTime() - new Date(b.next_due + 'T00:00:00').getTime(),
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
    if (isPast(date) && !isToday(date)) return 'text-danger font-bold';
    if (isToday(date)) return 'text-warning font-bold';
    return 'text-text-secondary';
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
        <Card padding="lg" className="text-center shadow-sm">
          <p className="text-text-muted mb-4">Get started by adding family members</p>
          <Link
            to="/people"
            className="inline-flex items-center justify-center px-4 py-2 text-base font-medium rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
          >
            Add People
          </Link>
        </Card>
      ) : (
        <>
          {/* Upcoming Shots - only show if there are shots */}
          {upcomingShots.length > 0 && (
            <Card className="shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Syringe className="text-accent" size={20} />
                <h2 className="font-semibold">Upcoming Shots</h2>
              </div>
              <div className="space-y-3">
                {upcomingShots.map((schedule) => (
                  <Link
                    key={schedule.id}
                    to="/shots"
                    className="flex items-center justify-between p-3 bg-surface-raised rounded-lg hover:bg-surface-sunken transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        {schedule.person?.name} - {schedule.name}
                      </div>
                      <div className="text-sm text-text-muted">
                        {schedule.current_dose} • every {schedule.interval_days} days
                      </div>
                    </div>
                    <div className={getDueDateClass(schedule.next_due)}>
                      {formatDueDate(schedule.next_due)}
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Active Medicine - only show if there are active courses */}
          {activeCourses.length > 0 && (
            <Card className="shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Pill className="text-success" size={20} />
                <h2 className="font-semibold">Active Medicine</h2>
              </div>
              <div className="space-y-3">
                {activeCourses.map((course) => {
                  const { taken, total } = getTodayProgress(course.id);
                  const allDone = total > 0 && taken === total;

                  return (
                    <Link
                      key={course.id}
                      to="/medicine"
                      className="flex items-center justify-between p-3 bg-surface-raised rounded-lg hover:bg-surface-sunken transition-colors"
                    >
                      <div>
                        <div className="font-medium">
                          {course.person?.name} - {course.name}
                        </div>
                        <div className="text-sm text-text-muted">
                          {course.doses_per_day}x/day for {course.duration_days} days
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {total > 0 ? (
                          <>
                            {allDone ? (
                              <CheckCircle2 className="text-success" size={18} />
                            ) : (
                              <AlertCircle className="text-warning" size={18} />
                            )}
                            <span className={allDone ? 'text-success' : 'text-warning'}>
                              {taken}/{total} today
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted text-sm">No doses today</span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Recent As-Needed Meds - only show if there are recent doses */}
          {recentPrnMeds.length > 0 && (
            <Card className="shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-accent" size={20} />
                <h2 className="font-semibold">As-Needed (Last 48h)</h2>
              </div>
              <div className="space-y-3">
                {recentPrnMeds.map((med) => {
                  const { canGive, timeUntil, lastGiven } = getPrnStatus(med.id, med.min_hours);
                  return (
                    <Link
                      key={med.id}
                      to="/prn"
                      className="flex items-center justify-between p-3 bg-surface-raised rounded-lg hover:bg-surface-sunken transition-colors"
                    >
                      <div>
                        <div className="font-medium">
                          {med.person?.name} - {med.name}
                        </div>
                        <div className="text-sm text-text-muted">
                          Last: {lastGiven} • every {med.min_hours}h
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canGive ? (
                          <>
                            <Check className="text-success" size={18} />
                            <span className="text-success">OK to give</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="text-warning" size={18} />
                            <span className="text-warning">Wait {timeUntil}</span>
                          </>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
