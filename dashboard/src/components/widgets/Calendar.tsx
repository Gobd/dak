import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings, RefreshCw, LogOut } from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { useRefreshInterval, useSyncedClock } from '../../hooks/useRefreshInterval';
import { useGoogleAuth, fetchCalendarApi } from '../../hooks/useGoogleAuth';
import { Modal, Button } from '../shared/Modal';
import { TimePickerCompact } from '../shared/TimePicker';
import { DatePicker, DatePickerCompact } from '../shared/DatePicker';
import type { WidgetComponentProps } from './index';

// Sync tokens for incremental calendar sync
const SYNC_TOKENS_KEY = 'calendar-sync-tokens';

interface SyncTokens {
  [calendarId: string]: string;
}

function getSyncTokens(): SyncTokens {
  try {
    return JSON.parse(localStorage.getItem(SYNC_TOKENS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveSyncToken(calendarId: string, token: string): void {
  try {
    const tokens = getSyncTokens();
    tokens[calendarId] = token;
    localStorage.setItem(SYNC_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Ignore
  }
}

function clearSyncToken(calendarId: string): void {
  try {
    const tokens = getSyncTokens();
    delete tokens[calendarId];
    localStorage.setItem(SYNC_TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Ignore
  }
}

interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  calendarColor?: string;
  calendarName?: string;
  recurringEventId?: string;
}

interface GoogleCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
  accessRole: string;
}

// Format helpers
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(dateTime: string): string {
  if (!dateTime.includes('T')) return 'All day';
  const date = new Date(dateTime);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatTimeRange(start: string, end: string): string {
  if (!start.includes('T')) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startH = startDate.getHours() % 12 || 12;
  const endH = endDate.getHours() % 12 || 12;
  const startM = startDate.getMinutes();
  const endM = endDate.getMinutes();
  const endAmpm = endDate.getHours() >= 12 ? 'pm' : 'am';

  const startStr = startM === 0 ? `${startH}` : `${startH}:${String(startM).padStart(2, '0')}`;
  const endStr =
    endM === 0 ? `${endH}${endAmpm}` : `${endH}:${String(endM).padStart(2, '0')}${endAmpm}`;

  return `${startStr}-${endStr}`;
}

function isToday(date: Date): boolean {
  return formatLocalDate(date) === formatLocalDate(new Date());
}

function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function getMostRecentWeekStart(weekStartsOn: number): Date {
  const now = new Date();
  const day = now.getDay();
  const daysBack = (day - weekStartsOn + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysBack);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getDayNames(weekStartsOn: number): string[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  for (let i = 0; i < 7; i++) {
    result.push(days[(weekStartsOn + i) % 7]);
  }
  return result;
}

export default function Calendar({ panel, dark }: WidgetComponentProps) {
  const calendarConfig = useConfigStore((s) => s.calendar);
  const updateCalendar = useConfigStore((s) => s.updateCalendar);

  const viewPreference = calendarConfig?.view ?? 'month';
  const hiddenCalendarIds = useMemo(() => calendarConfig?.hidden ?? [], [calendarConfig?.hidden]);
  const calendarNames = calendarConfig?.names ?? {};
  const weekStartsOn = (panel.args?.weekStart === 'sunday' ? 0 : 1) as number;
  const weeksToShow = (panel.args?.weeks as number) ?? 4;
  const showTime = panel.args?.showTime === true;
  const showSeconds = panel.args?.showSeconds === true;

  // Google OAuth
  const {
    isSignedIn,
    accessToken,
    loading: authLoading,
    error: authError,
    signIn,
    signOut,
  } = useGoogleAuth();

  const [view, setView] = useState<'month' | 'list'>(viewPreference);
  const [gridStartDate, setGridStartDate] = useState(getMostRecentWeekStart(weekStartsOn));
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({
    summary: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    calendarId: '',
    location: '',
    description: '',
  });
  const [addingEvent, setAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editForm, setEditForm] = useState({
    summary: '',
    startTime: '',
    endTime: '',
    allDay: false,
    location: '',
    description: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recurringChoice, setRecurringChoice] = useState<{
    event: CalendarEvent;
    action: 'edit' | 'delete';
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showJumpToDate, setShowJumpToDate] = useState(false);

  // Clock update
  useSyncedClock(() => setCurrentTime(new Date()), showSeconds);

  // Ref to current events for use in callback without causing re-renders
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  });

  // Load calendars and events from Google Calendar API (uses sync tokens for efficiency)
  const loadEvents = useCallback(async () => {
    if (!isSignedIn || !accessToken) return;

    // Only show loading spinner on initial load
    if (eventsRef.current.length === 0) {
      setLoading(true);
    }

    try {
      // Fetch calendar list (always fresh, it's cheap)
      const calendarListResponse = await fetchCalendarApi<{
        items: Array<{
          id: string;
          summary: string;
          backgroundColor: string;
          accessRole: string;
        }>;
      }>('/users/me/calendarList', accessToken);

      const fetchedCalendars: GoogleCalendar[] = calendarListResponse.items.map((cal) => ({
        id: cal.id,
        summary: cal.summary,
        backgroundColor: cal.backgroundColor || '#4285f4',
        accessRole: cal.accessRole,
      }));
      setCalendars(fetchedCalendars);

      // Get sync tokens
      const syncTokens = getSyncTokens();
      let updatedEvents = [...eventsRef.current];

      for (const cal of fetchedCalendars) {
        if (hiddenCalendarIds.includes(cal.id)) continue;

        let syncToken: string | undefined = syncTokens[cal.id];

        // If we have a sync token but no events for this calendar, clear it to force full fetch
        // This handles the case where the page was refreshed and state is empty
        const hasEventsForCalendar = updatedEvents.some((e) => e.calendarId === cal.id);
        if (syncToken && !hasEventsForCalendar) {
          clearSyncToken(cal.id);
          syncToken = undefined;
        }

        try {
          // Build query params - use sync token if available AND we have cached events, otherwise full fetch
          const params: Record<string, string> = syncToken
            ? { syncToken }
            : {
                timeMin: new Date(gridStartDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                timeMax: new Date(
                  gridStartDate.getTime() + (weeksToShow * 7 + 7) * 24 * 60 * 60 * 1000
                ).toISOString(),
                singleEvents: 'true',
                maxResults: '250',
              };

          const eventsResponse = await fetchCalendarApi<{
            items?: Array<{
              id: string;
              status?: string;
              summary?: string;
              start?: { dateTime?: string; date?: string };
              end?: { dateTime?: string; date?: string };
              location?: string;
              description?: string;
              recurringEventId?: string;
            }>;
            nextSyncToken?: string;
          }>(
            `/calendars/${encodeURIComponent(cal.id)}/events?` + new URLSearchParams(params),
            accessToken
          );

          // Save the new sync token
          if (eventsResponse.nextSyncToken) {
            saveSyncToken(cal.id, eventsResponse.nextSyncToken);
          }

          // Process events - handle additions, updates, and deletions
          for (const event of eventsResponse.items || []) {
            // Remove existing event with same ID (will re-add if not cancelled)
            updatedEvents = updatedEvents.filter(
              (e) => !(e.id === event.id && e.calendarId === cal.id)
            );

            // Add event if not cancelled/deleted
            if (event.status !== 'cancelled' && event.start && event.end) {
              updatedEvents.push({
                id: event.id,
                calendarId: cal.id,
                summary: event.summary || '(No title)',
                start: event.start,
                end: event.end,
                location: event.location,
                description: event.description,
                calendarColor: cal.backgroundColor,
                calendarName: cal.summary,
                recurringEventId: event.recurringEventId,
              });
            }
          }
        } catch (err) {
          // If sync token is invalid (410 Gone), clear it and we'll do full sync next time
          if (err instanceof Error && err.message.includes('410')) {
            console.log(`Sync token expired for ${cal.summary}, will do full sync`);
            clearSyncToken(cal.id);
          } else {
            console.warn(`Failed to fetch events from calendar: ${cal.summary}`, err);
          }
        }
      }

      setEvents(updatedEvents);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, accessToken, gridStartDate, weeksToShow, hiddenCalendarIds]);

  // Load events when signed in (only on auth change, not on every loadEvents change)
  const loadEventsRef = useRef(loadEvents);
  useEffect(() => {
    loadEventsRef.current = loadEvents;
  });

  useEffect(() => {
    if (isSignedIn && accessToken) {
      loadEventsRef.current();
    }
  }, [isSignedIn, accessToken]);

  // Auto-refresh events
  useRefreshInterval(loadEvents, panel.refresh, { immediate: false });

  // Filter events for a specific date
  function getEventsForDate(date: Date): CalendarEvent[] {
    const dateStr = formatLocalDate(date);
    return events
      .filter((event) => {
        if (hiddenCalendarIds.includes(event.calendarId)) return false;

        const startDate = event.start.dateTime?.split('T')[0] ?? event.start.date ?? '';
        const endDate = event.end.dateTime?.split('T')[0] ?? event.end.date ?? '';
        const isAllDay = !event.start.dateTime;

        if (isAllDay) {
          return dateStr >= startDate && dateStr < endDate;
        }
        return dateStr >= startDate && dateStr <= endDate;
      })
      .sort((a, b) => {
        const aStart = a.start.dateTime || a.start.date || '';
        const bStart = b.start.dateTime || b.start.date || '';
        return aStart.localeCompare(bStart);
      });
  }

  // Get calendar display name
  function getCalendarDisplayName(id: string, original: string): string {
    return calendarNames[id] || original;
  }

  // Create a new event
  async function handleCreateEvent() {
    if (!accessToken || !selectedDate || !newEvent.summary.trim()) return;

    const targetCalendarId =
      newEvent.calendarId ||
      calendars.find((c) => c.accessRole === 'owner')?.id ||
      calendars[0]?.id;
    if (!targetCalendarId) return;

    setAddingEvent(true);

    try {
      const dateStr = formatLocalDate(selectedDate);

      let eventBody: {
        summary: string;
        start: { date?: string; dateTime?: string; timeZone?: string };
        end: { date?: string; dateTime?: string; timeZone?: string };
        location?: string;
        description?: string;
      };

      if (newEvent.allDay) {
        // All-day event
        const endDate = new Date(selectedDate);
        endDate.setDate(endDate.getDate() + 1);
        eventBody = {
          summary: newEvent.summary.trim(),
          start: { date: dateStr },
          end: { date: formatLocalDate(endDate) },
        };
      } else {
        // Timed event
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        eventBody = {
          summary: newEvent.summary.trim(),
          start: { dateTime: `${dateStr}T${newEvent.startTime}:00`, timeZone },
          end: { dateTime: `${dateStr}T${newEvent.endTime}:00`, timeZone },
        };
      }

      // Add optional fields
      if (newEvent.location.trim()) {
        eventBody.location = newEvent.location.trim();
      }
      if (newEvent.description.trim()) {
        eventBody.description = newEvent.description.trim();
      }

      await fetchCalendarApi(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(eventBody),
        }
      );

      // Clear sync token for this calendar to force refresh
      clearSyncToken(targetCalendarId);

      // Refresh events
      loadEventsRef.current();

      // Close modal and reset form
      setShowAddEvent(false);
      setSelectedDate(null);
      setNewEvent({
        summary: '',
        startTime: '09:00',
        endTime: '10:00',
        allDay: false,
        calendarId: '',
        location: '',
        description: '',
      });
    } catch (err) {
      console.error('Failed to create event:', err);
      setErrorMessage('Failed to create event. Please try again.');
    } finally {
      setAddingEvent(false);
    }
  }

  // Start editing an event
  function handleStartEdit(event: CalendarEvent) {
    // Check if recurring - if so, ask which to edit
    if (event.recurringEventId) {
      setRecurringChoice({ event, action: 'edit' });
      return;
    }
    openEditForm(event);
  }

  function openEditForm(event: CalendarEvent) {
    const isAllDay = !event.start.dateTime;
    let startTime = '09:00';
    let endTime = '10:00';

    if (!isAllDay && event.start.dateTime && event.end.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    }

    setEditForm({
      summary: event.summary,
      startTime,
      endTime,
      allDay: isAllDay,
      location: event.location || '',
      description: event.description || '',
    });
    setEditingEvent(event);
    setSelectedEvent(null);
  }

  // Save edited event
  async function handleSaveEdit(editAll: boolean = false) {
    if (!accessToken || !editingEvent) return;

    setSavingEdit(true);

    try {
      // Determine the event ID to edit
      const eventId =
        editAll && editingEvent.recurringEventId ? editingEvent.recurringEventId : editingEvent.id;

      // Get the event's date
      const eventDate = editingEvent.start.dateTime
        ? editingEvent.start.dateTime.split('T')[0]
        : editingEvent.start.date;

      let eventBody: {
        summary: string;
        start: { date?: string; dateTime?: string; timeZone?: string };
        end: { date?: string; dateTime?: string; timeZone?: string };
        location?: string;
        description?: string;
      };

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (editForm.allDay) {
        const endDate = new Date(eventDate!);
        endDate.setDate(endDate.getDate() + 1);
        eventBody = {
          summary: editForm.summary.trim(),
          start: { date: eventDate! },
          end: { date: formatLocalDate(endDate) },
        };
      } else {
        eventBody = {
          summary: editForm.summary.trim(),
          start: { dateTime: `${eventDate}T${editForm.startTime}:00`, timeZone },
          end: { dateTime: `${eventDate}T${editForm.endTime}:00`, timeZone },
        };
      }

      // Add location and description
      eventBody.location = editForm.location.trim() || undefined;
      eventBody.description = editForm.description.trim() || undefined;

      await fetchCalendarApi(
        `/calendars/${encodeURIComponent(editingEvent.calendarId)}/events/${encodeURIComponent(eventId)}`,
        accessToken,
        {
          method: 'PATCH',
          body: JSON.stringify(eventBody),
        }
      );

      clearSyncToken(editingEvent.calendarId);
      loadEventsRef.current();
      setEditingEvent(null);
      setRecurringChoice(null);
    } catch (err) {
      console.error('Failed to update event:', err);
      setErrorMessage('Failed to update event. Please try again.');
    } finally {
      setSavingEdit(false);
    }
  }

  // Start delete flow
  function handleStartDelete(event: CalendarEvent) {
    if (event.recurringEventId) {
      setRecurringChoice({ event, action: 'delete' });
      setSelectedEvent(null);
      return;
    }
    setDeleteConfirm(event);
    setSelectedEvent(null);
  }

  // Delete an event
  async function handleDeleteEvent(deleteAll: boolean = false) {
    const event = deleteConfirm || recurringChoice?.event;
    if (!accessToken || !event) return;

    setDeleting(true);

    try {
      const eventId = deleteAll && event.recurringEventId ? event.recurringEventId : event.id;

      await fetchCalendarApi(
        `/calendars/${encodeURIComponent(event.calendarId)}/events/${encodeURIComponent(eventId)}`,
        accessToken,
        { method: 'DELETE' }
      );

      clearSyncToken(event.calendarId);
      loadEventsRef.current();
      setDeleteConfirm(null);
      setRecurringChoice(null);
    } catch (err) {
      console.error('Failed to delete event:', err);
      setErrorMessage('Failed to delete event. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  // Navigation
  function handlePrevWeek() {
    const newDate = new Date(gridStartDate);
    newDate.setDate(newDate.getDate() - 7);
    setGridStartDate(newDate);
  }

  function handleNextWeek() {
    const newDate = new Date(gridStartDate);
    newDate.setDate(newDate.getDate() + 7);
    setGridStartDate(newDate);
  }

  function handleToday() {
    setGridStartDate(getMostRecentWeekStart(weekStartsOn));
  }

  function handleJumpToDate(date: Date) {
    // Find the week start for the selected date
    const day = date.getDay();
    const daysBack = (day - weekStartsOn + 7) % 7;
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysBack);
    weekStart.setHours(0, 0, 0, 0);
    setGridStartDate(weekStart);
    setShowJumpToDate(false);
  }

  // Save view preference
  function handleViewChange(newView: 'month' | 'list') {
    setView(newView);
    updateCalendar({ view: newView });
  }

  // Generate days for month view
  const monthDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < weeksToShow * 7; i++) {
      const date = new Date(gridStartDate);
      date.setDate(gridStartDate.getDate() + i);
      days.push(date);
    }
    return days;
  }, [gridStartDate, weeksToShow]);

  // Format date range for header
  const dateRange = useMemo(() => {
    const endDate = new Date(gridStartDate);
    endDate.setDate(gridStartDate.getDate() + weeksToShow * 7 - 1);
    const startStr = gridStartDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const endStr = endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startStr} - ${endStr}`;
  }, [gridStartDate, weeksToShow]);

  // Check if today is in view
  const todayInView = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(gridStartDate);
    endDate.setDate(gridStartDate.getDate() + weeksToShow * 7);
    return today >= gridStartDate && today < endDate;
  }, [gridStartDate, weeksToShow]);

  const dayNames = getDayNames(weekStartsOn);
  const visibleCalendars = calendars.filter((c) => !hiddenCalendarIds.includes(c.id));

  // Sign in screen
  if (!isSignedIn) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center p-4 ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
      >
        <h3 className="text-lg font-medium mb-2">Google Calendar</h3>
        <p className="text-sm text-neutral-500 mb-4 text-center">
          Sign in to view and manage your calendars
        </p>
        {authError && <p className="text-sm text-red-500 mb-4 text-center">{authError}</p>}
        <Button onClick={signIn} variant="primary" disabled={authLoading}>
          {authLoading ? 'Signing in...' : 'Sign in with Google'}
        </Button>
      </div>
    );
  }

  // Loading
  if (loading && events.length === 0) {
    return (
      <div
        className={`w-full h-full flex items-center justify-center ${dark ? 'bg-black' : 'bg-white'}`}
      >
        <RefreshCw size={20} className="animate-spin text-neutral-500" />
      </div>
    );
  }

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden ${dark ? 'bg-black text-white' : 'bg-white text-neutral-900'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700">
        <div className="flex items-center gap-1">
          <button onClick={handlePrevWeek} className="p-1 rounded hover:bg-neutral-700/50">
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setShowJumpToDate(true)}
            className={`px-2 py-1 text-sm rounded ${
              todayInView ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-neutral-700/50'
            }`}
            title="Jump to date"
          >
            {dateRange}
          </button>
          <button onClick={handleNextWeek} className="p-1 rounded hover:bg-neutral-700/50">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleToday}
            className={`ml-1 px-2 py-1 text-xs rounded ${
              todayInView ? 'bg-blue-600 text-white' : 'hover:bg-neutral-700/50'
            }`}
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-1">
          {showTime && (
            <span className="text-sm text-neutral-400 mr-2">
              {currentTime.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
                ...(showSeconds && { second: '2-digit' }),
              })}
            </span>
          )}
          <button
            onClick={() => setShowSettings(true)}
            className="p-1 rounded hover:bg-neutral-700/50"
            title="Settings"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={() => {
              setSelectedDate(new Date());
              setShowAddEvent(true);
            }}
            className="p-1 rounded hover:bg-neutral-700/50"
            title="Add event"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Calendar legend */}
      {visibleCalendars.length > 0 && (
        <div className="flex gap-2 px-3 py-1.5 text-xs overflow-x-auto border-b border-neutral-700">
          {visibleCalendars.map((cal) => (
            <div key={cal.id} className="flex items-center gap-1 shrink-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="text-neutral-400">
                {getCalendarDisplayName(cal.id, cal.summary)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Month Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Day names */}
        <div className="grid grid-cols-7 border-b border-neutral-700">
          {dayNames.map((name) => (
            <div key={name} className="px-1 py-1 text-xs text-center text-neutral-500">
              {name}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div
          className="flex-1 grid grid-cols-7 overflow-y-auto"
          style={{ gridTemplateRows: `repeat(${weeksToShow}, 1fr)` }}
        >
          {monthDays.map((date) => {
            const dateStr = formatLocalDate(date);
            const dayEvents = getEventsForDate(date);
            const isTodayDate = isToday(date);
            const isPastDate = isPast(date);

            return (
              <div
                key={dateStr}
                className={`border-r border-b border-neutral-700 p-1 min-h-0 overflow-hidden cursor-pointer
                           hover:bg-neutral-700/30 ${isPastDate ? 'opacity-50' : ''}`}
                onClick={() => {
                  setSelectedDate(date);
                  setShowAddEvent(true);
                }}
              >
                <div
                  className={`text-xs font-medium mb-0.5 ${
                    isTodayDate
                      ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center'
                      : 'text-neutral-400'
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((event) => {
                    const isAllDay = !event.start.dateTime;
                    const timeRange = isAllDay
                      ? ''
                      : formatTimeRange(event.start.dateTime!, event.end.dateTime!);

                    return (
                      <div
                        key={event.id}
                        className="text-[10px] truncate px-1 rounded"
                        style={{
                          backgroundColor: (event.calendarColor || '#4285f4') + '40',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        title={event.summary}
                      >
                        {timeRange && <span className="text-neutral-400">{timeRange} </span>}
                        {event.summary || '(No title)'}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-neutral-500">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Modal */}
      <Modal open={showSettings} onClose={() => setShowSettings(false)} title="Calendar Settings">
        <div className="space-y-4">
          {/* View toggle */}
          <div>
            <label className="block text-sm font-medium mb-2">View</label>
            <div className="flex gap-2">
              <button
                onClick={() => handleViewChange('month')}
                className={`px-3 py-1.5 rounded text-sm ${
                  view === 'month' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => handleViewChange('list')}
                className={`px-3 py-1.5 rounded text-sm ${
                  view === 'list' ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Calendars */}
          {calendars.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Calendars</label>
              <div className="space-y-3">
                {calendars.map((cal) => (
                  <div key={cal.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!hiddenCalendarIds.includes(cal.id)}
                      onChange={(e) => {
                        const newHidden = new Set(hiddenCalendarIds);
                        if (e.target.checked) {
                          newHidden.delete(cal.id);
                        } else {
                          newHidden.add(cal.id);
                        }
                        updateCalendar({ hidden: [...newHidden] });
                      }}
                      className="rounded shrink-0"
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <input
                      type="text"
                      value={calendarNames[cal.id] ?? ''}
                      onChange={(e) => {
                        const newNames = { ...calendarNames };
                        if (e.target.value) {
                          newNames[cal.id] = e.target.value;
                        } else {
                          delete newNames[cal.id];
                        }
                        updateCalendar({ names: newNames });
                      }}
                      placeholder={cal.summary}
                      className="flex-1 px-2 py-1 text-sm rounded bg-neutral-700 border border-neutral-600 placeholder:text-neutral-500"
                      title={`Alias for ${cal.summary}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-neutral-700">
            <Button onClick={() => window.location.reload()}>Reload Widget</Button>
            <Button onClick={signOut} variant="danger">
              <LogOut size={14} className="mr-1" /> Sign Out
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        open={showAddEvent}
        onClose={() => {
          setShowAddEvent(false);
          setSelectedDate(null);
          setNewEvent({
            summary: '',
            startTime: '09:00',
            endTime: '10:00',
            allDay: false,
            calendarId: '',
            location: '',
            description: '',
          });
        }}
        title="Add Event"
      >
        <div className="space-y-3">
          {/* Event title */}
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={newEvent.summary}
              onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
              placeholder="Event title"
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
              autoFocus
            />
          </div>

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            {selectedDate && <DatePickerCompact value={selectedDate} onChange={setSelectedDate} />}
          </div>

          {/* All day toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={newEvent.allDay}
              onChange={(e) => setNewEvent({ ...newEvent, allDay: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">All day</span>
          </label>

          {/* Time inputs (hidden if all day) */}
          {!newEvent.allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Start</label>
                <TimePickerCompact
                  value={newEvent.startTime}
                  onChange={(v) => setNewEvent({ ...newEvent, startTime: v })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">End</label>
                <TimePickerCompact
                  value={newEvent.endTime}
                  onChange={(v) => setNewEvent({ ...newEvent, endTime: v })}
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={newEvent.location}
              onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              placeholder="Add location"
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Add description"
              rows={2}
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600 resize-none"
            />
          </div>

          {/* Calendar picker */}
          {calendars.filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer').length >
            1 && (
            <div>
              <label className="block text-sm font-medium mb-1">Calendar</label>
              <select
                value={newEvent.calendarId}
                onChange={(e) => setNewEvent({ ...newEvent, calendarId: e.target.value })}
                className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
              >
                <option value="">Default</option>
                {calendars
                  .filter((c) => c.accessRole === 'owner' || c.accessRole === 'writer')
                  .map((cal) => (
                    <option key={cal.id} value={cal.id}>
                      {getCalendarDisplayName(cal.id, cal.summary)}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => {
              setShowAddEvent(false);
              setSelectedDate(null);
              setNewEvent({
                summary: '',
                startTime: '09:00',
                endTime: '10:00',
                allDay: false,
                calendarId: '',
                location: '',
                description: '',
              });
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateEvent}
            disabled={addingEvent || !newEvent.summary.trim()}
          >
            {addingEvent ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* Event Detail Modal */}
      <Modal
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent?.summary || '(No title)'}
      >
        {selectedEvent && (
          <div className="space-y-3">
            <p>
              {formatTime(selectedEvent.start.dateTime || selectedEvent.start.date || '')}
              {selectedEvent.end && (
                <>
                  {' - '}
                  {formatTime(selectedEvent.end.dateTime || selectedEvent.end.date || '')}
                </>
              )}
            </p>
            {selectedEvent.calendarName && (
              <p className="text-sm text-neutral-400">
                {getCalendarDisplayName(selectedEvent.calendarId, selectedEvent.calendarName)}
              </p>
            )}
            {selectedEvent.location && <p>📍 {selectedEvent.location}</p>}
            {selectedEvent.description && (
              <p className="text-sm text-neutral-400">{selectedEvent.description}</p>
            )}
            {selectedEvent.recurringEventId && (
              <p className="text-xs text-neutral-500">🔁 Recurring event</p>
            )}
          </div>
        )}
        {selectedEvent && (
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setSelectedEvent(null)}>Close</Button>
            <Button onClick={() => handleStartEdit(selectedEvent)}>Edit</Button>
            <Button variant="danger" onClick={() => handleStartDelete(selectedEvent)}>
              Delete
            </Button>
          </div>
        )}
      </Modal>

      {/* Edit Event Modal */}
      <Modal open={!!editingEvent} onClose={() => setEditingEvent(null)} title="Edit Event">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={editForm.summary}
              onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editForm.allDay}
              onChange={(e) => setEditForm({ ...editForm, allDay: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">All day</span>
          </label>

          {!editForm.allDay && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Start</label>
                <TimePickerCompact
                  value={editForm.startTime}
                  onChange={(v) => setEditForm({ ...editForm, startTime: v })}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">End</label>
                <TimePickerCompact
                  value={editForm.endTime}
                  onChange={(v) => setEditForm({ ...editForm, endTime: v })}
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1">Location</label>
            <input
              type="text"
              value={editForm.location}
              onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
              placeholder="Add location"
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Add description"
              rows={2}
              className="w-full p-2 rounded bg-neutral-700 border border-neutral-600 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => setEditingEvent(null)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => handleSaveEdit(false)}
            disabled={savingEdit || !editForm.summary.trim()}
          >
            {savingEdit ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Event">
        <p>Are you sure you want to delete "{deleteConfirm?.summary}"?</p>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDeleteEvent(false)} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>

      {/* Recurring Event Choice Modal */}
      <Modal
        open={!!recurringChoice}
        onClose={() => setRecurringChoice(null)}
        title={
          recurringChoice?.action === 'edit' ? 'Edit Recurring Event' : 'Delete Recurring Event'
        }
      >
        <p className="mb-4">
          This is a recurring event. What would you like to {recurringChoice?.action}?
        </p>
        <div className="flex flex-col gap-2">
          <Button
            onClick={() => {
              if (recurringChoice?.action === 'edit') {
                openEditForm(recurringChoice.event);
              } else {
                setDeleteConfirm(recurringChoice?.event ?? null);
                setRecurringChoice(null);
              }
            }}
          >
            Just this event
          </Button>
          <Button
            onClick={() => {
              if (recurringChoice?.action === 'edit') {
                openEditForm(recurringChoice.event);
                // Will pass true to handleSaveEdit
              } else {
                handleDeleteEvent(true);
              }
            }}
          >
            All events in series
          </Button>
          <Button onClick={() => setRecurringChoice(null)}>Cancel</Button>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal open={!!errorMessage} onClose={() => setErrorMessage(null)} title="Error">
        <p className="text-red-400">{errorMessage}</p>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setErrorMessage(null)}>OK</Button>
        </div>
      </Modal>

      {/* Jump to Date Modal */}
      <Modal open={showJumpToDate} onClose={() => setShowJumpToDate(false)} title="Jump to Date">
        <DatePicker value={gridStartDate} onChange={handleJumpToDate} />
      </Modal>
    </div>
  );
}
