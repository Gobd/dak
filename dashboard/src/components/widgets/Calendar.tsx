import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Settings,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { useConfigStore } from '../../stores/config-store';
import { useRefreshInterval } from '../../hooks/useRefreshInterval';
import { useGoogleAuth, fetchCalendarApi } from '../../hooks/useGoogleAuth';
import {
  Modal,
  Button,
  DatePicker,
  DatePickerCompact,
  TimePickerCompact,
  Spinner,
  Toggle,
  Input,
  Slider,
} from '@dak/ui';
import type { WidgetComponentProps } from './index';

// Sync tokens for incremental calendar sync
const SYNC_TOKENS_KEY = 'calendar-sync-tokens';
const FETCHED_RANGES_KEY = 'calendar-fetched-ranges';

interface SyncTokens {
  [calendarId: string]: string;
}

interface FetchedRange {
  min: number; // timestamp
  max: number; // timestamp
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

function getFetchedRange(calendarId: string): FetchedRange | null {
  try {
    const ranges = JSON.parse(localStorage.getItem(FETCHED_RANGES_KEY) || '{}');
    return ranges[calendarId] || null;
  } catch {
    return null;
  }
}

function saveFetchedRange(calendarId: string, min: number, max: number): void {
  try {
    const ranges = JSON.parse(localStorage.getItem(FETCHED_RANGES_KEY) || '{}');
    const existing = ranges[calendarId];
    // Expand the range if we already have one
    if (existing) {
      ranges[calendarId] = {
        min: Math.min(existing.min, min),
        max: Math.max(existing.max, max),
      };
    } else {
      ranges[calendarId] = { min, max };
    }
    localStorage.setItem(FETCHED_RANGES_KEY, JSON.stringify(ranges));
  } catch {
    // Ignore
  }
}

function clearFetchedRange(calendarId: string): void {
  try {
    const ranges = JSON.parse(localStorage.getItem(FETCHED_RANGES_KEY) || '{}');
    delete ranges[calendarId];
    localStorage.setItem(FETCHED_RANGES_KEY, JSON.stringify(ranges));
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

// Determine if a hex color is light (returns true) or dark (returns false)
function isLightColor(hex: string): boolean {
  const color = hex.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
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

export default function Calendar({ panel }: WidgetComponentProps) {
  const calendarConfig = useConfigStore((s) => s.calendar);
  const updateCalendar = useConfigStore((s) => s.updateCalendar);

  const hiddenCalendarIds = useMemo(() => calendarConfig?.hidden ?? [], [calendarConfig?.hidden]);
  const calendarNames = calendarConfig?.names ?? {};
  const weekStartsOn = (panel.args?.weekStart === 'sunday' ? 0 : 1) as number;
  const weeksToShow = (panel.args?.weeks as number) ?? 4;
  const headerHeight = calendarConfig?.headerHeight ?? 0; // Extra height in pixels for header section

  // Google OAuth
  const {
    isSignedIn,
    accessToken,
    loading: authLoading,
    error: authError,
    signIn,
    signOut,
    isImplicitFlow,
  } = useGoogleAuth();

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
    date: null as Date | null,
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
  const [showJumpToDate, setShowJumpToDate] = useState(false);

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

      // Calculate the time range we need to display (once, shared by all calendars)
      const viewTimeMin = gridStartDate.getTime() - 7 * 24 * 60 * 60 * 1000;
      const viewTimeMax = gridStartDate.getTime() + (weeksToShow * 7 + 7) * 24 * 60 * 60 * 1000;

      // Get sync tokens
      const syncTokens = getSyncTokens();
      const currentEvents = [...eventsRef.current];

      // Fetch all calendars in parallel for faster loading
      const calendarResults = await Promise.all(
        fetchedCalendars
          .filter((cal) => !hiddenCalendarIds.includes(cal.id))
          .map(async (cal) => {
            let syncToken: string | undefined = syncTokens[cal.id];

            // If we have a sync token but no events for this calendar, clear it to force full fetch
            const hasEventsForCalendar = currentEvents.some((e) => e.calendarId === cal.id);
            if (syncToken && !hasEventsForCalendar) {
              clearSyncToken(cal.id);
              clearFetchedRange(cal.id);
              syncToken = undefined;
            }

            // Check if we've already fetched events for this range
            const fetchedRange = getFetchedRange(cal.id);
            const needsRangeFetch =
              !fetchedRange || viewTimeMin < fetchedRange.min || viewTimeMax > fetchedRange.max;

            // If we have a sync token but navigated outside the fetched range, we need a full fetch
            if (syncToken && needsRangeFetch) {
              console.log(`Navigated outside fetched range for ${cal.summary}, fetching new range`);
            }

            try {
              // Build query params - use sync token ONLY if we don't need a new range fetch
              const useSyncToken = syncToken && !needsRangeFetch;
              const isFullFetch = !useSyncToken;
              const params: Record<string, string> = useSyncToken
                ? { syncToken: syncToken! }
                : {
                    timeMin: new Date(viewTimeMin).toISOString(),
                    timeMax: new Date(viewTimeMax).toISOString(),
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
                accessToken,
              );

              // Save the new sync token and update fetched range
              if (eventsResponse.nextSyncToken) {
                saveSyncToken(cal.id, eventsResponse.nextSyncToken);
              }
              if (isFullFetch) {
                saveFetchedRange(cal.id, viewTimeMin, viewTimeMax);
              }

              // Process events into CalendarEvent objects
              const newEvents: CalendarEvent[] = [];
              const removedEventIds = new Set<string>();

              for (const event of eventsResponse.items || []) {
                removedEventIds.add(event.id);

                if (event.status !== 'cancelled' && event.start && event.end) {
                  newEvents.push({
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

              return { cal, isFullFetch, newEvents, removedEventIds, error: null };
            } catch (err) {
              // If sync token is invalid (410 Gone), clear it and we'll do full sync next time
              if (err instanceof Error && err.message.includes('410')) {
                console.log(`Sync token expired for ${cal.summary}, will do full sync`);
                clearSyncToken(cal.id);
                clearFetchedRange(cal.id);
              } else {
                console.warn(`Failed to fetch events from calendar: ${cal.summary}`, err);
              }
              return {
                cal,
                isFullFetch: false,
                newEvents: [],
                removedEventIds: new Set<string>(),
                error: err,
              };
            }
          }),
      );

      // Merge results from all calendars
      let updatedEvents = [...currentEvents];
      const fetchTimeMin = new Date(viewTimeMin);
      const fetchTimeMax = new Date(viewTimeMax);

      for (const result of calendarResults) {
        if (result.error) continue;

        const { cal, isFullFetch, newEvents, removedEventIds } = result;

        // For full fetch, clear existing events for this calendar in the fetched time range
        if (isFullFetch) {
          updatedEvents = updatedEvents.filter((e) => {
            if (e.calendarId !== cal.id) return true;
            const eventStart = new Date(e.start.dateTime || e.start.date || '');
            return eventStart < fetchTimeMin || eventStart > fetchTimeMax;
          });
        }

        // Remove events that were updated/deleted
        updatedEvents = updatedEvents.filter(
          (e) => !(e.calendarId === cal.id && removedEventIds.has(e.id)),
        );

        // Add new events
        updatedEvents.push(...newEvents);
      }

      setEvents(updatedEvents);
    } catch (err) {
      console.error('Failed to load calendar data:', err);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, accessToken, gridStartDate, weeksToShow, hiddenCalendarIds]);

  // Load events when signed in or when grid date changes
  const loadEventsRef = useRef(loadEvents);
  useEffect(() => {
    loadEventsRef.current = loadEvents;
  });

  useEffect(() => {
    if (isSignedIn && accessToken) {
      loadEventsRef.current();
    }
  }, [isSignedIn, accessToken, gridStartDate]);

  // Auto-refresh events
  useRefreshInterval(loadEvents, '5m', { immediate: false });

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

      console.debug('Creating event:', eventBody);

      await fetchCalendarApi(
        `/calendars/${encodeURIComponent(targetCalendarId)}/events`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(eventBody),
        },
      );

      // Clear sync token and fetched range for this calendar to force refresh
      clearSyncToken(targetCalendarId);
      clearFetchedRange(targetCalendarId);

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

    // Parse the event date
    const eventDateStr = event.start.dateTime?.split('T')[0] || event.start.date || '';
    const [year, month, day] = eventDateStr.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day);

    if (!isAllDay && event.start.dateTime && event.end.dateTime) {
      const start = new Date(event.start.dateTime);
      const end = new Date(event.end.dateTime);
      startTime = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
      endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    }

    setEditForm({
      summary: event.summary,
      date: eventDate,
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
    if (!accessToken || !editingEvent || !editForm.date) return;

    setSavingEdit(true);

    try {
      // Determine the event ID to edit
      const eventId =
        editAll && editingEvent.recurringEventId ? editingEvent.recurringEventId : editingEvent.id;

      // Get the date from the form
      const eventDate = formatLocalDate(editForm.date);

      let eventBody: {
        summary: string;
        start: { date?: string; dateTime?: string; timeZone?: string };
        end: { date?: string; dateTime?: string; timeZone?: string };
        location?: string;
        description?: string;
      };

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      if (editForm.allDay) {
        const endDate = new Date(editForm.date);
        endDate.setDate(endDate.getDate() + 1);
        eventBody = {
          summary: editForm.summary.trim(),
          start: { date: eventDate },
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
        },
      );

      clearSyncToken(editingEvent.calendarId);
      clearFetchedRange(editingEvent.calendarId);
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
        { method: 'DELETE' },
      );

      clearSyncToken(event.calendarId);
      clearFetchedRange(event.calendarId);
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

  function handlePrevMonth() {
    const newDate = new Date(gridStartDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setGridStartDate(newDate);
  }

  function handleNextMonth() {
    const newDate = new Date(gridStartDate);
    newDate.setMonth(newDate.getMonth() + 1);
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
        className={`w-full h-full flex flex-col items-center justify-center p-4 bg-surface text-text`}
      >
        <h3 className="text-lg font-medium mb-2">Google Calendar</h3>
        <p className="text-sm text-text-muted mb-4 text-center">
          Sign in to view and manage your calendars
        </p>
        {authError && <p className="text-sm text-danger mb-4 text-center">{authError}</p>}
        <Button onClick={signIn} variant="primary" disabled={authLoading}>
          {authLoading ? 'Signing in...' : `Sign in with Google${isImplicitFlow ? ' (dev)' : ''}`}
        </Button>
      </div>
    );
  }

  // Loading
  if (loading && events.length === 0) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-surface`}>
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden bg-surface text-text`}>
      {/* Header */}
      <div
        className="flex items-start justify-between px-3 py-2 border-b border-border"
        style={headerHeight > 0 ? { minHeight: `${headerHeight}px` } : undefined}
      >
        <div className="flex items-center gap-0.5">
          {/* Month navigation - separated with gap */}
          <Button variant="ghost" size="icon-sm" onClick={handlePrevMonth} title="Previous month">
            <ChevronsLeft size={18} />
          </Button>
          <div className="w-2" /> {/* Spacer between month and week buttons */}
          {/* Week navigation */}
          <Button variant="ghost" size="icon-sm" onClick={handlePrevWeek} title="Previous week">
            <ChevronLeft size={18} />
          </Button>
          <Button
            variant={todayInView ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setShowJumpToDate(true)}
            className={todayInView ? 'bg-accent/30 text-accent' : ''}
            title="Jump to date"
          >
            {dateRange}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={handleNextWeek} title="Next week">
            <ChevronRight size={18} />
          </Button>
          <div className="w-2" /> {/* Spacer between week and month buttons */}
          <Button variant="ghost" size="icon-sm" onClick={handleNextMonth} title="Next month">
            <ChevronsRight size={18} />
          </Button>
          <Button
            variant={todayInView ? 'primary' : 'ghost'}
            size="sm"
            onClick={handleToday}
            className="ml-2"
          >
            Today
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings size={14} className="text-text-muted" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setSelectedDate(new Date());
              setShowAddEvent(true);
            }}
            title="Add event"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      {/* Calendar legend */}
      {visibleCalendars.length > 0 && (
        <div className="flex gap-2 px-3 py-1.5 text-xs overflow-x-auto border-b border-border">
          {visibleCalendars.map((cal) => (
            <div key={cal.id} className="flex items-center gap-1 shrink-0">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: cal.backgroundColor }}
              />
              <span className="text-text-muted">{getCalendarDisplayName(cal.id, cal.summary)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Month Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Day names */}
        <div className="grid grid-cols-7 border-b border-border">
          {dayNames.map((name) => (
            <div key={name} className="px-1 py-1 text-xs text-center text-text-muted">
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
                className={`border-r border-b border-border p-1 min-h-0 overflow-hidden cursor-pointer
                           hover:bg-surface-sunken/30 ${isPastDate ? 'opacity-50' : ''}`}
                onClick={() => {
                  setSelectedDate(date);
                  setShowAddEvent(true);
                }}
              >
                <div
                  className={`text-xs font-medium mb-0.5 ${
                    isTodayDate
                      ? 'w-5 h-5 rounded-full bg-accent text-text flex items-center justify-center'
                      : 'text-text-muted'
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
                    const bgColor = event.calendarColor || '#4285f4';
                    const textColor = isLightColor(bgColor) ? '#000000' : '#ffffff';

                    return (
                      <div
                        key={event.id}
                        className="text-[11px] line-clamp-2 px-1 rounded"
                        style={{
                          backgroundColor: bgColor,
                          color: textColor,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        title={event.summary}
                      >
                        {timeRange && <span>{timeRange} · </span>}
                        {event.summary || '(No title)'}
                      </div>
                    );
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-text-muted">+{dayEvents.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Calendar Settings"
        actions={
          <Button onClick={() => setShowSettings(false)} variant="primary">
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Header height */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Header Height: {headerHeight}px
            </label>
            <Slider
              min={0}
              max={200}
              step={10}
              value={headerHeight}
              onChange={(value) => updateCalendar({ headerHeight: value })}
            />
            <p className="text-xs text-text-muted mt-1">
              Extra space in header for overlaying other widgets
            </p>
          </div>

          {/* Calendars */}
          {calendars.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Calendars</label>
              <div className="space-y-3">
                {calendars.map((cal) => (
                  <div key={cal.id} className="flex items-center gap-2">
                    <Toggle
                      size="sm"
                      checked={!hiddenCalendarIds.includes(cal.id)}
                      onChange={(checked) => {
                        const newHidden = new Set(hiddenCalendarIds);
                        if (checked) {
                          newHidden.delete(cal.id);
                        } else {
                          newHidden.add(cal.id);
                        }
                        updateCalendar({ hidden: [...newHidden] });
                      }}
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cal.backgroundColor }}
                    />
                    <div className="flex-1 min-w-0">
                      <Input
                        size="sm"
                        inline
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
                        placeholder="Custom name"
                      />
                      <div className="text-xs text-text-muted mt-0.5 truncate">{cal.summary}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border space-y-2">
            {isImplicitFlow && (
              <div className="text-xs text-warning bg-warning/10 px-2 py-1 rounded">
                Local dev mode (implicit auth flow - no refresh token)
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => loadEvents()}>
                <RefreshCw size={14} className="mr-1" /> Refresh
              </Button>
              <Button onClick={signOut} variant="danger">
                <LogOut size={14} className="mr-1" /> Sign Out
              </Button>
            </div>
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
          <Input
            label="Title"
            value={newEvent.summary}
            onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
            placeholder="Event title"
            autoFocus
          />

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            {selectedDate && <DatePickerCompact value={selectedDate} onChange={setSelectedDate} />}
          </div>

          {/* All day toggle */}
          <Toggle
            checked={newEvent.allDay}
            onChange={(checked) => setNewEvent({ ...newEvent, allDay: checked })}
            label="All day"
          />

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
          <Input
            label="Location"
            value={newEvent.location}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
            placeholder="Add location"
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={newEvent.description}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Add description"
              rows={2}
              className="w-full p-2 rounded bg-surface-sunken border border-border resize-none"
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
                className="w-full p-2 rounded bg-surface-sunken border border-border"
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
              <p className="text-sm text-text-muted">
                {getCalendarDisplayName(selectedEvent.calendarId, selectedEvent.calendarName)}
              </p>
            )}
            {selectedEvent.location && <p>📍 {selectedEvent.location}</p>}
            {selectedEvent.description && (
              <p className="text-sm text-text-muted">{selectedEvent.description}</p>
            )}
            {selectedEvent.recurringEventId && (
              <p className="text-xs text-text-muted">🔁 Recurring event</p>
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
          <Input
            label="Title"
            value={editForm.summary}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
          />

          {/* Date picker */}
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            {editForm.date && (
              <DatePickerCompact
                value={editForm.date}
                onChange={(d) => setEditForm({ ...editForm, date: d })}
              />
            )}
          </div>

          <Toggle
            checked={editForm.allDay}
            onChange={(checked) => setEditForm({ ...editForm, allDay: checked })}
            label="All day"
          />

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
          <Input
            label="Location"
            value={editForm.location}
            onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
            placeholder="Add location"
          />

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              placeholder="Add description"
              rows={2}
              className="w-full p-2 rounded bg-surface-sunken border border-border resize-none"
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
        <p className="text-danger">{errorMessage}</p>
        <div className="flex gap-2 mt-4">
          <Button onClick={() => setErrorMessage(null)}>OK</Button>
        </div>
      </Modal>

      {/* Jump to Date Modal */}
      <Modal
        open={showJumpToDate}
        onClose={() => setShowJumpToDate(false)}
        title="Jump to Date"
        fit
      >
        <DatePicker value={gridStartDate} onChange={handleJumpToDate} />
      </Modal>
    </div>
  );
}
