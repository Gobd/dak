import './calendar.css';
import { registerWidget } from '../../widget-registry.js';
import { getConfigSection, updateConfigSection } from '../../script.js';
import {
  getStoredAuth,
  getAuthUrl,
  handleOAuthCallback,
  clearAuth,
  isConfigured,
  getValidAccessToken,
  isDevMode,
  getDevAuthUrl,
  handleDevCallback,
} from './oauth.js';
import { getAllEvents, getEvent, createEvent, updateEvent, deleteEvent } from './api.js';
import { createHybridDateTimePicker, setWeekStart } from './wheel-picker.js';

// Calendar Widget - Month grid and list views

let calendars = [];
let events = [];
let hiddenCalendars = new Set(); // Calendar IDs to hide
let calendarNames = {}; // Custom display names for calendars
let accessToken = null;
let currentContainer = null;
let currentView = 'month'; // 'month' or 'list'
let gridStartDate = null; // Start date for grid view (most recent week start)
let weeksToShow = 4; // Configurable number of weeks
let weekStartsOn = 1; // 0 = Sunday, 1 = Monday (default Monday)
let isDarkMode = true; // Controlled by dashboard config
let showTime = false; // Show clock in header
let showSeconds = false; // Show seconds in clock
let timeIntervalId = null; // Interval for updating clock

// Load all calendar settings from dashboardConfig
function loadCalendarSettings() {
  const calendarConfig = getConfigSection('calendar', {});

  // Hidden calendars
  hiddenCalendars = new Set(calendarConfig.hidden || []);

  // Custom names
  calendarNames = calendarConfig.names || {};

  // View preference
  if (calendarConfig.view === 'month' || calendarConfig.view === 'list') {
    currentView = calendarConfig.view;
  }
}

// Save all calendar settings to dashboardConfig
async function saveCalendarSettings() {
  await updateConfigSection('calendar', {
    names: calendarNames,
    hidden: [...hiddenCalendars],
    view: currentView,
  });
}

// Get display name for a calendar (custom name or original)
function getCalendarDisplayName(calendarId, originalName) {
  return calendarNames[calendarId] || originalName;
}

// Parse RRULE to human-readable frequency
function parseRecurrenceRule(recurrence) {
  if (!recurrence || !recurrence.length) return null;

  const rule = recurrence[0];
  if (!rule.startsWith('RRULE:')) return 'Repeating';

  const parts = rule.substring(6).split(';');
  const ruleMap = {};
  parts.forEach((part) => {
    const [key, value] = part.split('=');
    ruleMap[key] = value;
  });

  const freq = ruleMap.FREQ;
  const byDay = ruleMap.BYDAY;

  if (freq === 'DAILY') return 'Daily';
  if (freq === 'WEEKLY') {
    if (byDay === 'MO,TU,WE,TH,FR') return 'Weekdays';
    if (byDay) {
      const dayNames = {
        SU: 'Sun',
        MO: 'Mon',
        TU: 'Tue',
        WE: 'Wed',
        TH: 'Thu',
        FR: 'Fri',
        SA: 'Sat',
      };
      const days = byDay.split(',').map((d) => dayNames[d] || d);
      return `Weekly on ${days.join(', ')}`;
    }
    return 'Weekly';
  }
  if (freq === 'MONTHLY') return 'Monthly';
  if (freq === 'YEARLY') return 'Yearly';

  return 'Repeating';
}

// Check if calendar is visible
function isCalendarVisible(calendarId) {
  return !hiddenCalendars.has(calendarId);
}

// Initialize grid start date
function initGridStartDate() {
  if (!gridStartDate) {
    gridStartDate = getMostRecentWeekStart();
  }
}

// Format date as YYYY-MM-DD in local timezone (NOT UTC)
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format date as YYYY-MM-DDTHH:MM:SS in local timezone (NOT UTC)
// Used for Google Calendar API when specifying timeZone
function formatLocalDateTime(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// Get local date string from event start/end (handles both dateTime and date formats)
function getEventLocalDate(dateTimeOrDate) {
  if (dateTimeOrDate.includes('T')) {
    // dateTime format - parse and get local date
    return formatLocalDate(new Date(dateTimeOrDate));
  } else {
    // date format (all-day event) - already in YYYY-MM-DD format, use as-is
    return dateTimeOrDate;
  }
}

function getEventsForDate(date) {
  const dateStr = formatLocalDate(date);
  return events
    .filter((event) => {
      // Filter by visible calendars
      if (!isCalendarVisible(event.calendarId)) return false;

      const startDate = getEventLocalDate(event.start.dateTime || event.start.date);
      const endDate = getEventLocalDate(event.end.dateTime || event.end.date);
      const isAllDay = !event.start.dateTime;

      // All-day events use exclusive end date (end date is day after)
      // Timed events use inclusive end date
      if (isAllDay) {
        return dateStr >= startDate && dateStr < endDate;
      } else {
        return dateStr >= startDate && dateStr <= endDate;
      }
    })
    .sort((a, b) => {
      // All-day events first, then sort by start time
      const aAllDay = !a.start.dateTime;
      const bAllDay = !b.start.dateTime;
      if (aAllDay && !bAllDay) return -1;
      if (!aAllDay && bAllDay) return 1;
      // Both timed or both all-day - sort by start
      const aStart = a.start.dateTime || a.start.date;
      const bStart = b.start.dateTime || b.start.date;
      return aStart.localeCompare(bStart);
    });
}

function formatTime(dateTime) {
  if (!dateTime.includes('T')) return 'All day';
  const date = new Date(dateTime);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Format time range like "3-4pm" or "3:30-4:15pm"
function formatTimeRange(startDateTime, endDateTime) {
  if (!startDateTime.includes('T')) return '';

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const startHours = start.getHours();
  const endHours = end.getHours();
  const startMinutes = start.getMinutes();
  const endMinutes = end.getMinutes();
  const startAmpm = startHours >= 12 ? 'pm' : 'am';
  const endAmpm = endHours >= 12 ? 'pm' : 'am';
  const startHour12 = startHours % 12 || 12;
  const endHour12 = endHours % 12 || 12;

  // Format start time
  let startStr =
    startMinutes === 0
      ? `${startHour12}`
      : `${startHour12}:${String(startMinutes).padStart(2, '0')}`;

  // Format end time
  let endStr =
    endMinutes === 0
      ? `${endHour12}${endAmpm}`
      : `${endHour12}:${String(endMinutes).padStart(2, '0')}${endAmpm}`;

  // Only show am/pm on start if different from end
  if (startAmpm !== endAmpm) {
    startStr += startAmpm;
  }

  return `${startStr}-${endStr}`;
}

// Format current time for clock display (12-hour with AM/PM)
function formatCurrentTime() {
  const now = new Date();
  const opts = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  if (showSeconds) {
    opts.second = '2-digit';
  }
  return now.toLocaleTimeString([], opts);
}

// Update the clock display
function updateClockDisplay() {
  const clockEl = currentContainer?.querySelector('.calendar-clock');
  if (clockEl) {
    clockEl.textContent = formatCurrentTime();
  }
}

function isToday(date) {
  const today = new Date();
  return formatLocalDate(date) === formatLocalDate(today);
}

function isPast(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  return dateOnly < today;
}

// Get the most recent week start (Monday or Sunday based on config)
function getMostRecentWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const daysBack = (day - weekStartsOn + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - daysBack);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

// Get day names based on week start
function getDayNames() {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  for (let i = 0; i < 7; i++) {
    result.push(days[(weekStartsOn + i) % 7]);
  }
  return result;
}

function renderMonthView(container) {
  initGridStartDate();

  // Format date range for header
  const endDate = new Date(gridStartDate);
  endDate.setDate(gridStartDate.getDate() + weeksToShow * 7 - 1);
  const startStr = gridStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const dateRange = `${startStr} - ${endStr}`;

  // Check if today is in the current view
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const viewStart = new Date(gridStartDate);
  const viewEnd = new Date(endDate);
  viewEnd.setHours(23, 59, 59, 999);
  const todayInView = today >= viewStart && today <= viewEnd;

  const dayNames = getDayNames();

  // Generate days for the configured number of weeks
  const totalDays = weeksToShow * 7;
  const days = [];
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(gridStartDate);
    date.setDate(gridStartDate.getDate() + i);
    days.push(date);
  }

  // Get visible calendars for legend
  const visibleCalendars = calendars.filter((cal) => isCalendarVisible(cal.id));

  const darkClass = isDarkMode ? 'dark' : '';
  container.innerHTML = `
    <div class="calendar-widget ${darkClass}">
      <div class="calendar-header">
        <button class="cal-nav-btn" data-action="prev-week">‹</button>
        <button class="cal-title" data-action="pick-date">${dateRange}</button>
        <button class="cal-nav-btn" data-action="next-week">›</button>
        <button class="cal-nav-btn cal-today-btn ${todayInView ? 'active' : ''}" data-action="today">Today</button>
        ${showTime ? `<span class="calendar-clock">${formatCurrentTime()}</span>` : ''}
        <button class="cal-nav-btn" data-action="settings" title="Settings">⚙</button>
        <button class="cal-nav-btn" data-action="add">+</button>
      </div>
      <div class="calendar-legend">
        ${visibleCalendars
          .map(
            (cal) => `
          <div class="calendar-legend-item">
            <span class="calendar-legend-dot" style="background: ${cal.backgroundColor}"></span>
            <span class="calendar-legend-name">${getCalendarDisplayName(cal.id, cal.summary)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="calendar-month-grid" style="--weeks: ${weeksToShow}">
        <div class="month-header">
          ${dayNames.map((day) => `<div class="month-day-name">${day}</div>`).join('')}
        </div>
        <div class="month-days">
          ${days
            .map((date) => {
              const dateStr = formatLocalDate(date);
              const dayEvents = getEventsForDate(date);
              const todayClass = isToday(date) ? 'today' : '';
              const pastClass = isPast(date) ? 'past' : '';

              return `
              <div class="month-day ${todayClass} ${pastClass}" data-date="${dateStr}">
                <div class="month-day-number">${date.getDate()}</div>
                <div class="month-day-events">
                  ${dayEvents
                    .slice(0, 3)
                    .map((event) => {
                      const isAllDay = !event.start.dateTime;
                      const timeStr = isAllDay
                        ? ''
                        : formatTimeRange(event.start.dateTime, event.end.dateTime);
                      const displayText = timeStr
                        ? `${timeStr} ${event.summary || '(No title)'}`
                        : event.summary || '(No title)';
                      return `
                    <div class="month-event" style="background: ${event.calendarColor || '#4285f4'}"
                         data-event-id="${event.id}" data-calendar-id="${event.calendarId}"
                         title="${event.summary || '(No title)'}">
                      ${displayText}
                    </div>
                  `;
                    })
                    .join('')}
                  ${dayEvents.length > 3 ? `<div class="month-more">+${dayEvents.length - 3} more</div>` : ''}
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  container.querySelectorAll('.calendar-header [data-action]').forEach((btn) => {
    btn.addEventListener('click', handleMonthHeaderClick);
  });
  container.querySelector('.month-days').addEventListener('click', handleMonthDayClick);
}

function renderListView(container) {
  // Show 6 weeks of dates starting from most recent week start
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysBack = (dayOfWeek - weekStartsOn + 7) % 7;
  const listStart = new Date(now);
  listStart.setDate(now.getDate() - daysBack - 7); // One week back
  listStart.setHours(0, 0, 0, 0);

  const days = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(listStart);
    date.setDate(listStart.getDate() + i);
    days.push(date);
  }

  const today = formatLocalDate(new Date());

  // Get visible calendars for legend
  const visibleCalendars = calendars.filter((cal) => isCalendarVisible(cal.id));

  const darkClass = isDarkMode ? 'dark' : '';

  container.innerHTML = `
    <div class="calendar-widget ${darkClass}">
      <div class="calendar-header">
        <button class="cal-nav-btn cal-today-btn" data-action="today">Today</button>
        <span class="cal-title">Calendar</span>
        ${showTime ? `<span class="calendar-clock">${formatCurrentTime()}</span>` : ''}
        <button class="cal-nav-btn" data-action="settings" title="Settings">⚙</button>
        <button class="cal-nav-btn" data-action="add">+</button>
      </div>
      <div class="calendar-legend">
        ${visibleCalendars
          .map(
            (cal) => `
          <div class="calendar-legend-item">
            <span class="calendar-legend-dot" style="background: ${cal.backgroundColor}"></span>
            <span class="calendar-legend-name">${getCalendarDisplayName(cal.id, cal.summary)}</span>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="calendar-scroll" id="calendar-scroll">
        ${days
          .map((date) => {
            const dateStr = formatLocalDate(date);
            const dayEvents = getEventsForDate(date);
            const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
            const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const todayClass = isToday(date) ? 'today' : '';
            const pastClass = isPast(date) ? 'past' : '';

            // Relative day label
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const dateOnly = new Date(date);
            dateOnly.setHours(0, 0, 0, 0);
            const diff = Math.floor((dateOnly - todayDate) / (1000 * 60 * 60 * 24));
            let relative = '';
            if (diff === 0) relative = 'Today';
            else if (diff === 1) relative = 'Tomorrow';
            else if (diff === -1) relative = 'Yesterday';

            return `
            <div class="calendar-date ${todayClass} ${pastClass}" data-date="${dateStr}" id="date-${dateStr}">
              <div class="date-header">
                <span class="date-day">${dayName}</span>
                <span class="date-month">${monthDay}</span>
                ${relative ? `<span class="date-relative">${relative}</span>` : ''}
              </div>
              <div class="date-events">
                ${dayEvents.length === 0 ? '<div class="no-events">No events</div>' : ''}
                ${dayEvents
                  .map(
                    (event) => `
                  <div class="calendar-event" style="border-left-color: ${event.calendarColor || '#4285f4'}"
                       data-event-id="${event.id}" data-calendar-id="${event.calendarId}">
                    <span class="event-time">${formatTime(event.start.dateTime || event.start.date)}</span>
                    <span class="event-title">${event.summary || '(No title)'}</span>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;

  // Scroll to today
  setTimeout(() => {
    const todayEl = container.querySelector(`#date-${today}`);
    if (todayEl) {
      const scrollContainer = container.querySelector('#calendar-scroll');
      scrollContainer.scrollTop = todayEl.offsetTop - 50;
    }
  }, 0);

  // Add event listeners
  container.querySelectorAll('.calendar-header [data-action]').forEach((btn) => {
    btn.addEventListener('click', handleListHeaderClick);
  });
  container.querySelector('.calendar-scroll').addEventListener('click', handleListDayClick);
}

function showDatePickerPopup(currentDate, onSelect) {
  let viewDate = new Date(currentDate);

  const overlay = document.createElement('div');
  overlay.className = 'mini-cal-overlay';

  function render() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = (firstDay.getDay() - weekStartsOn + 7) % 7;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const orderedDays = [];
    for (let i = 0; i < 7; i++) {
      orderedDays.push(dayNames[(weekStartsOn + i) % 7]);
    }

    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const today = formatLocalDate(new Date());
    const selected = formatLocalDate(currentDate);

    let daysHtml = '';
    // Always show 6 rows (42 cells) for consistent height
    const totalCells = 42;

    // Days from previous month
    const prevMonth = new Date(year, month, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      daysHtml += `<div class="mini-cal-day other-month" data-date="${formatLocalDate(new Date(year, month - 1, d))}">${d}</div>`;
    }

    // Days of current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = dateStr === today;
      const isSelected = dateStr === selected;
      daysHtml += `<div class="mini-cal-day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${dateStr}">${d}</div>`;
    }

    // Days from next month to fill remaining cells
    const cellsUsed = startOffset + lastDay.getDate();
    const remaining = totalCells - cellsUsed;
    for (let d = 1; d <= remaining; d++) {
      daysHtml += `<div class="mini-cal-day other-month" data-date="${formatLocalDate(new Date(year, month + 1, d))}">${d}</div>`;
    }

    overlay.innerHTML = `
      <div class="mini-cal-popup">
        <div class="mini-cal-header">
          <button class="mini-cal-nav" data-action="prev-year">‹‹</button>
          <button class="mini-cal-nav" data-action="prev-month">‹</button>
          <span class="mini-cal-title">${monthName}</span>
          <button class="mini-cal-nav" data-action="next-month">›</button>
          <button class="mini-cal-nav" data-action="next-year">››</button>
        </div>
        <div class="mini-cal-weekdays">
          ${orderedDays.map((d) => `<div>${d.substring(0, 2)}</div>`).join('')}
        </div>
        <div class="mini-cal-days">
          ${daysHtml}
        </div>
      </div>
    `;
  }

  render();

  overlay.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    const dateStr = e.target.dataset.date;

    if (e.target === overlay) {
      overlay.remove();
    } else if (action === 'prev-year') {
      viewDate.setFullYear(viewDate.getFullYear() - 1);
      render();
    } else if (action === 'next-year') {
      viewDate.setFullYear(viewDate.getFullYear() + 1);
      render();
    } else if (action === 'prev-month') {
      viewDate.setMonth(viewDate.getMonth() - 1);
      render();
    } else if (action === 'next-month') {
      viewDate.setMonth(viewDate.getMonth() + 1);
      render();
    } else if (dateStr) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const selectedDate = new Date(y, m - 1, d);
      overlay.remove();
      onSelect(selectedDate);
    }
  });

  document.body.appendChild(overlay);
}

function handleMonthHeaderClick(e) {
  const btn = e.target.closest('[data-action]') || e.currentTarget;
  const action = btn.dataset.action;

  if (action === 'prev-week') {
    gridStartDate.setDate(gridStartDate.getDate() - 7);
    refreshCalendar();
  } else if (action === 'next-week') {
    gridStartDate.setDate(gridStartDate.getDate() + 7);
    refreshCalendar();
  } else if (action === 'today') {
    gridStartDate = getMostRecentWeekStart();
    refreshCalendar();
  } else if (action === 'pick-date') {
    showDatePickerPopup(gridStartDate, (newDate) => {
      // Calculate the week start for the selected date
      const day = newDate.getDay();
      const daysBack = (day - weekStartsOn + 7) % 7;
      gridStartDate = new Date(newDate);
      gridStartDate.setDate(newDate.getDate() - daysBack);
      gridStartDate.setHours(0, 0, 0, 0);
      refreshCalendar();
    });
  } else if (action === 'settings') {
    showSettingsModal();
  } else if (action === 'add') {
    showAddEventModal(new Date());
  }
}

function handleListHeaderClick(e) {
  const btn = e.target.closest('[data-action]') || e.currentTarget;
  const action = btn.dataset.action;

  if (action === 'today') {
    const today = formatLocalDate(new Date());
    const todayEl = currentContainer?.querySelector(`#date-${today}`);
    if (todayEl) {
      const scrollContainer = currentContainer.querySelector('#calendar-scroll');
      scrollContainer.scrollTo({ top: todayEl.offsetTop - 50, behavior: 'smooth' });
    }
  } else if (action === 'settings') {
    showSettingsModal();
  } else if (action === 'add') {
    showAddEventModal(new Date());
  }
}

function handleMonthDayClick(e) {
  const eventEl = e.target.closest('.month-event');
  const dayEl = e.target.closest('.month-day');

  if (eventEl) {
    const eventId = eventEl.dataset.eventId;
    const calendarId = eventEl.dataset.calendarId;
    const event = events.find((ev) => ev.id === eventId && ev.calendarId === calendarId);
    if (event) {
      showEventModal(event);
    }
  } else if (dayEl) {
    const dateStr = dayEl.dataset.date;
    showAddEventModal(new Date(dateStr + 'T12:00:00'));
  }
}

function handleListDayClick(e) {
  const eventEl = e.target.closest('.calendar-event');
  const dateEl = e.target.closest('.calendar-date');

  if (eventEl) {
    const eventId = eventEl.dataset.eventId;
    const calendarId = eventEl.dataset.calendarId;
    const event = events.find((ev) => ev.id === eventId && ev.calendarId === calendarId);
    if (event) {
      showEventModal(event);
    }
  } else if (dateEl && !e.target.closest('.calendar-event')) {
    const dateStr = dateEl.dataset.date;
    showAddEventModal(new Date(dateStr + 'T12:00:00'));
  }
}

function refreshCalendar() {
  if (currentContainer) {
    if (currentView === 'month') {
      renderMonthView(currentContainer);
    } else {
      renderListView(currentContainer);
    }
  }
}

async function loadEvents() {
  try {
    // Get a valid token, auto-refreshing if needed
    accessToken = await getValidAccessToken();
    if (!accessToken) {
      renderSignIn(currentContainer);
      return;
    }

    // Load 3 months of events for month view navigation
    const start = new Date();
    start.setMonth(start.getMonth() - 1);
    const end = new Date();
    end.setMonth(end.getMonth() + 2);

    const data = await getAllEvents(accessToken, start, end);
    calendars = data.calendars;
    events = data.events;
    refreshCalendar();
  } catch (err) {
    if (err.message === 'AUTH_EXPIRED' || err.message === 'AUTH_REVOKED') {
      clearAuth();
      accessToken = null;
      renderSignIn(currentContainer);
    } else {
      console.error('Failed to load events:', err);
    }
  }
}

async function showEventModal(event) {
  const startTime = formatTime(event.start.dateTime || event.start.date);
  const endTime = formatTime(event.end.dateTime || event.end.date);
  const isAllDay = !event.start.dateTime;
  const isRecurring = !!event.recurringEventId;
  const eventDate = new Date(event.start.dateTime || event.start.date);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // Get recurrence frequency for recurring events
  let recurrenceText = '';
  if (isRecurring) {
    try {
      const masterEvent = await getEvent(accessToken, event.calendarId, event.recurringEventId);
      recurrenceText = parseRecurrenceRule(masterEvent.recurrence) || 'Repeating';
    } catch {
      recurrenceText = 'Repeating';
    }
  }

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>${event.summary || '(No title)'}</h3>
      <p class="event-date">${dateStr}${recurrenceText ? ` <span class="event-recurrence">${recurrenceText}</span>` : ''}</p>
      <p class="event-time">${isAllDay ? 'All day' : `${startTime} - ${endTime}`}</p>
      ${event.location ? `<p class="event-location">📍 ${event.location}</p>` : ''}
      <p class="event-calendar" style="color: ${event.calendarColor}">${event.calendarName}</p>
      ${event.description ? `<p class="event-desc">${event.description}</p>` : ''}
      <div class="cal-modal-actions">
        <button class="cal-btn danger" data-action="delete">Delete</button>
        <button class="cal-btn" data-action="close">Close</button>
        <button class="cal-btn primary" data-action="edit">Edit</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'close' || e.target === modal) {
      modal.remove();
    } else if (action === 'delete') {
      modal.remove();
      if (isRecurring) {
        showRecurringDeleteModal(event);
      } else {
        showDeleteConfirmModal(event);
      }
    } else if (action === 'edit') {
      modal.remove();
      if (isRecurring) {
        showRecurringEditModal(event);
      } else {
        showEditEventModal(event);
      }
    }
  });

  document.body.appendChild(modal);
}

function showDeleteConfirmModal(event) {
  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Delete event</h3>
      <p>Delete "${event.summary || '(No title)'}"?</p>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="cancel">Cancel</button>
        <button class="cal-btn danger" data-action="confirm">Delete</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'confirm') {
      try {
        await deleteEvent(accessToken, event.calendarId, event.id);
        modal.remove();
        await loadEvents();
      } catch {
        showErrorModal('Failed to delete event');
      }
    }
  });

  document.body.appendChild(modal);
}

function showRecurringDeleteModal(event) {
  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Delete recurring event</h3>
      <p>This is a recurring event. What would you like to delete?</p>
      <div class="cal-modal-actions" style="flex-direction: column; gap: 8px;">
        <button class="cal-btn" data-action="this" style="width: 100%;">This event only</button>
        <button class="cal-btn danger" data-action="all" style="width: 100%;">All events in series</button>
        <button class="cal-btn" data-action="cancel" style="width: 100%;">Cancel</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'this') {
      try {
        await deleteEvent(accessToken, event.calendarId, event.id);
        modal.remove();
        await loadEvents();
      } catch {
        showErrorModal('Failed to delete event');
      }
    } else if (action === 'all') {
      try {
        // Delete the master recurring event
        await deleteEvent(accessToken, event.calendarId, event.recurringEventId);
        modal.remove();
        await loadEvents();
      } catch {
        showErrorModal('Failed to delete series');
      }
    }
  });

  document.body.appendChild(modal);
}

function showRecurringEditModal(event) {
  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Edit recurring event</h3>
      <p>This is a recurring event. What would you like to edit?</p>
      <div class="cal-modal-actions" style="flex-direction: column; gap: 8px;">
        <button class="cal-btn primary" data-action="this" style="width: 100%;">This event only</button>
        <button class="cal-btn" data-action="all" style="width: 100%;">All events in series</button>
        <button class="cal-btn" data-action="cancel" style="width: 100%;">Cancel</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'this') {
      modal.remove();
      showEditEventModal(event, false); // Edit this instance only
    } else if (action === 'all') {
      // Fetch the master event and edit that
      try {
        const masterEvent = await getEvent(accessToken, event.calendarId, event.recurringEventId);
        masterEvent.calendarId = event.calendarId;
        masterEvent.calendarColor = event.calendarColor;
        masterEvent.calendarName = event.calendarName;
        modal.remove();
        showEditEventModal(masterEvent, true); // Edit master (all in series)
      } catch {
        showErrorModal('Failed to load recurring event');
      }
    }
  });

  document.body.appendChild(modal);
}

function showAddEventModal(date) {
  const calendarOptions = calendars
    .filter((cal) => cal.accessRole === 'owner' || cal.accessRole === 'writer')
    .map(
      (cal) =>
        `<option value="${cal.id}" style="color: ${cal.backgroundColor}">${cal.summary}</option>`
    )
    .join('');

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content wide">
      <div class="cal-form-grid">
        <label class="full-width">
          Title
          <input type="text" id="event-title" placeholder="Event title">
        </label>
        <label style="margin-bottom: 8px;">
          <input type="checkbox" id="event-allday"> All day
        </label>
        <div></div>
        <div id="start-picker-container"></div>
        <div id="end-picker-container"></div>
        <label>
          Location
          <input type="text" id="event-location" placeholder="Add location">
        </label>
        <label>
          Calendar
          <select id="event-calendar">${calendarOptions}</select>
        </label>
        <label>
          Repeat
          <select id="event-recurrence">
            <option value="">Does not repeat</option>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="YEARLY">Yearly</option>
            <option value="WEEKDAYS">Every weekday (Mon-Fri)</option>
          </select>
        </label>
        <div></div>
        <label class="full-width">
          Description
          <textarea id="event-description" placeholder="Add description" rows="2" style="resize: vertical;"></textarea>
        </label>
      </div>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="cancel">Cancel</button>
        <button class="cal-btn primary" data-action="save">Save</button>
      </div>
    </div>
  `;

  // Set up initial dates
  const startDate = new Date(date);
  startDate.setHours(9, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(10, 0, 0, 0);

  let selectedStart = startDate;
  let selectedEnd = endDate;
  let isAllDay = false;
  let lastStartDate = new Date(startDate); // Track for sync

  // Create start picker (hybrid: mini calendar + wheel time)
  const startContainer = modal.querySelector('#start-picker-container');
  const startPicker = createHybridDateTimePicker(
    startDate,
    (newDate) => {
      // Calculate date difference and apply to end date (sync dates)
      const startDateOnly = new Date(
        lastStartDate.getFullYear(),
        lastStartDate.getMonth(),
        lastStartDate.getDate()
      );
      const newStartDateOnly = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate()
      );
      const dayDiff = Math.round((newStartDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));

      if (dayDiff !== 0) {
        // Move end date by same amount
        const newEndDate = new Date(selectedEnd);
        newEndDate.setDate(newEndDate.getDate() + dayDiff);
        selectedEnd = newEndDate;
        endPicker.setDate(newEndDate);
      }

      selectedStart = newDate;
      lastStartDate = new Date(newDate);

      // Ensure end is after start
      if (selectedEnd <= selectedStart) {
        selectedEnd = new Date(selectedStart.getTime() + 60 * 60 * 1000);
        endPicker.setDate(selectedEnd);
      }
    },
    { allowFuture: true, label: 'Start' }
  );
  startContainer.appendChild(startPicker);

  // Create end picker (hybrid: mini calendar + wheel time)
  const endContainer = modal.querySelector('#end-picker-container');
  const endPicker = createHybridDateTimePicker(
    endDate,
    (newDate) => {
      // End date changes independently (for multi-day events)
      selectedEnd = newDate;
    },
    { allowFuture: true, label: 'End' }
  );
  endContainer.appendChild(endPicker);

  // All day toggle
  const allDayCheckbox = modal.querySelector('#event-allday');
  allDayCheckbox.addEventListener('change', () => {
    isAllDay = allDayCheckbox.checked;
    // Hide/show time using the exposed method
    startPicker.setShowTime(!isAllDay);
    endPicker.setShowTime(!isAllDay);
    endContainer.style.display = isAllDay ? 'none' : '';
  });

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'save') {
      const title = modal.querySelector('#event-title').value;
      const location = modal.querySelector('#event-location').value;
      const description = modal.querySelector('#event-description').value;
      const calendarId = modal.querySelector('#event-calendar').value;
      const recurrence = modal.querySelector('#event-recurrence').value;

      const event = {
        summary: title || '(No title)',
      };

      if (location) event.location = location;
      if (description) event.description = description;

      if (isAllDay) {
        const dateStr = formatLocalDate(selectedStart);
        event.start = { date: dateStr };
        event.end = { date: dateStr };
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const startStr = formatLocalDateTime(selectedStart);
        const endStr = formatLocalDateTime(selectedEnd);
        event.start = {
          dateTime: startStr,
          timeZone: tz,
        };
        event.end = {
          dateTime: endStr,
          timeZone: tz,
        };
      }

      // Add recurrence rule if selected
      if (recurrence) {
        const dayOfWeek = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][selectedStart.getDay()];
        const recurrenceRules = {
          DAILY: 'RRULE:FREQ=DAILY',
          WEEKLY: `RRULE:FREQ=WEEKLY;BYDAY=${dayOfWeek}`,
          MONTHLY: 'RRULE:FREQ=MONTHLY',
          YEARLY: 'RRULE:FREQ=YEARLY',
          WEEKDAYS: 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
        };
        event.recurrence = [recurrenceRules[recurrence]];
      }

      try {
        await createEvent(accessToken, calendarId, event);
        modal.remove();
        await loadEvents();
      } catch {
        showErrorModal('Failed to create event');
      }
    }
  });

  document.body.appendChild(modal);
  modal.querySelector('#event-title').focus();
}

function showEditEventModal(event, _editAll = false) {
  const eventIsAllDay = !event.start.dateTime;
  const eventStart = new Date(event.start.dateTime || event.start.date + 'T09:00:00');
  const eventEnd = new Date(event.end.dateTime || event.end.date + 'T10:00:00');
  const escapeHtml = (str) => (str ? str.replace(/"/g, '&quot;').replace(/</g, '&lt;') : '');

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content wide">
      <div class="cal-form-grid">
        <label class="full-width">
          Title
          <input type="text" id="event-title" value="${escapeHtml(event.summary)}">
        </label>
        <label style="margin-bottom: 8px;">
          <input type="checkbox" id="event-allday" ${eventIsAllDay ? 'checked' : ''}> All day
        </label>
        <div></div>
        <div id="start-picker-container"></div>
        <div id="end-picker-container" ${eventIsAllDay ? 'style="display: none;"' : ''}></div>
        <label class="full-width">
          Location
          <input type="text" id="event-location" value="${escapeHtml(event.location)}">
        </label>
        <label class="full-width">
          Description
          <textarea id="event-description" rows="2" style="resize: vertical;">${escapeHtml(event.description)}</textarea>
        </label>
      </div>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="cancel">Cancel</button>
        <button class="cal-btn primary" data-action="save">Save</button>
      </div>
    </div>
  `;

  let selectedStart = eventStart;
  let selectedEnd = eventEnd;
  let isAllDay = eventIsAllDay;
  let lastStartDate = new Date(eventStart); // Track for sync

  // Create start picker (hybrid: mini calendar + wheel time)
  const startContainer = modal.querySelector('#start-picker-container');
  const startPicker = createHybridDateTimePicker(
    eventStart,
    (newDate) => {
      // Calculate date difference and apply to end date (sync dates)
      const startDateOnly = new Date(
        lastStartDate.getFullYear(),
        lastStartDate.getMonth(),
        lastStartDate.getDate()
      );
      const newStartDateOnly = new Date(
        newDate.getFullYear(),
        newDate.getMonth(),
        newDate.getDate()
      );
      const dayDiff = Math.round((newStartDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));

      if (dayDiff !== 0) {
        // Move end date by same amount
        const newEndDate = new Date(selectedEnd);
        newEndDate.setDate(newEndDate.getDate() + dayDiff);
        selectedEnd = newEndDate;
        endPicker.setDate(newEndDate);
      }

      selectedStart = newDate;
      lastStartDate = new Date(newDate);

      // Ensure end is after start
      if (selectedEnd <= selectedStart) {
        selectedEnd = new Date(selectedStart.getTime() + 60 * 60 * 1000);
        endPicker.setDate(selectedEnd);
      }
    },
    { allowFuture: true, label: 'Start' }
  );
  startContainer.appendChild(startPicker);

  // Create end picker (hybrid: mini calendar + wheel time)
  const endContainer = modal.querySelector('#end-picker-container');
  const endPicker = createHybridDateTimePicker(
    eventEnd,
    (newDate) => {
      // End date changes independently (for multi-day events)
      selectedEnd = newDate;
    },
    { allowFuture: true, label: 'End' }
  );
  endContainer.appendChild(endPicker);

  // Hide time elements if all day
  if (eventIsAllDay) {
    startPicker.setShowTime(false);
    endPicker.setShowTime(false);
  }

  // All day toggle
  const allDayCheckbox = modal.querySelector('#event-allday');
  allDayCheckbox.addEventListener('change', () => {
    isAllDay = allDayCheckbox.checked;
    startPicker.setShowTime(!isAllDay);
    endPicker.setShowTime(!isAllDay);
    endContainer.style.display = isAllDay ? 'none' : '';
  });

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'save') {
      const title = modal.querySelector('#event-title').value;
      const location = modal.querySelector('#event-location').value;
      const description = modal.querySelector('#event-description').value;

      const updatedEvent = {
        ...event,
        summary: title || '(No title)',
        location: location || null,
        description: description || null,
      };

      if (isAllDay) {
        const dateStr = formatLocalDate(selectedStart);
        updatedEvent.start = { date: dateStr };
        updatedEvent.end = { date: dateStr };
      } else {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const startStr = formatLocalDateTime(selectedStart);
        const endStr = formatLocalDateTime(selectedEnd);
        updatedEvent.start = {
          dateTime: startStr,
          timeZone: tz,
        };
        updatedEvent.end = {
          dateTime: endStr,
          timeZone: tz,
        };
      }

      try {
        await updateEvent(accessToken, event.calendarId, event.id, updatedEvent);
        modal.remove();
        await loadEvents();
      } catch {
        showErrorModal('Failed to update event');
      }
    }
  });

  document.body.appendChild(modal);
}

function showErrorModal(message) {
  const darkClass = isDarkMode ? 'dark' : '';
  const modal = document.createElement('div');
  modal.className = `cal-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Error</h3>
      <p>${message}</p>
      <div class="cal-modal-actions">
        <button class="cal-btn primary" data-action="close">OK</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close' || e.target === modal) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

function showSettingsModal() {
  const escapeHtml = (str) => (str ? str.replace(/"/g, '&quot;').replace(/</g, '&lt;') : '');

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Settings</h3>

      <div class="settings-section">
        <div class="settings-section-title">View</div>
        <div class="settings-view-toggle">
          <button class="settings-view-btn ${currentView === 'month' ? 'active' : ''}" data-view="month">Month</button>
          <button class="settings-view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list">List</button>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Calendars</div>
        <div class="calendar-settings-list">
          ${calendars
            .map(
              (cal) => `
            <div class="calendar-settings-item">
              <div class="calendar-settings-row">
                <input type="checkbox" data-calendar-id="${cal.id}"
                       ${isCalendarVisible(cal.id) ? 'checked' : ''}>
                <span class="calendar-color-dot" style="background: ${cal.backgroundColor}"></span>
                <span class="calendar-original-name">${cal.summary}</span>
              </div>
              <div class="calendar-rename-row">
                <input type="text" class="calendar-name-input" data-calendar-id="${cal.id}"
                       value="${escapeHtml(calendarNames[cal.id] || '')}"
                       placeholder="Display name (optional)">
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Refresh</div>
        <button class="cal-btn" data-action="refresh" style="width: 100%;">Reload Widget</button>
      </div>

      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="close">Close</button>
        <button class="cal-btn primary" data-action="apply">Apply</button>
      </div>
    </div>
  `;

  // View toggle handlers
  modal.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('[data-view]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  modal.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'close' || e.target === modal) {
      modal.remove();
    } else if (action === 'refresh') {
      window.location.reload();
    } else if (action === 'apply') {
      // Update view
      const activeViewBtn = modal.querySelector('[data-view].active');
      if (activeViewBtn) {
        currentView = activeViewBtn.dataset.view;
      }

      // Update hidden calendars based on checkboxes
      hiddenCalendars.clear();
      modal.querySelectorAll('input[type="checkbox"][data-calendar-id]').forEach((checkbox) => {
        if (!checkbox.checked) {
          hiddenCalendars.add(checkbox.dataset.calendarId);
        }
      });

      // Update custom calendar names
      modal.querySelectorAll('.calendar-name-input').forEach((input) => {
        const calId = input.dataset.calendarId;
        const customName = input.value.trim();
        if (customName) {
          calendarNames[calId] = customName;
        } else {
          delete calendarNames[calId];
        }
      });

      // Save all settings at once
      saveCalendarSettings();

      modal.remove();
      refreshCalendar();
    }
  });

  document.body.appendChild(modal);
}

function renderSignIn(container) {
  const darkClass = isDarkMode ? 'dark' : '';
  if (!isConfigured()) {
    container.innerHTML = `
      <div class="calendar-widget calendar-setup ${darkClass}">
        <div class="setup-message">
          <h3>Calendar Setup Required</h3>
          <p>Add your Google OAuth Client ID to:</p>
          <code>widgets/calendar/oauth.js</code>
        </div>
      </div>
    `;
    return;
  }

  // Dev mode: use implicit flow (one-click, no server needed)
  if (isDevMode()) {
    container.innerHTML = `
      <div class="calendar-widget calendar-signin ${darkClass}">
        <div class="signin-message">
          <h3>Dev Mode</h3>
          <p>Sign in with Google (implicit flow)</p>
          <button class="cal-btn primary signin-btn">Sign in with Google</button>
        </div>
      </div>
    `;

    container.querySelector('.signin-btn').addEventListener('click', () => {
      window.location.href = getDevAuthUrl();
    });
    return;
  }

  container.innerHTML = `
    <div class="calendar-widget calendar-signin ${darkClass}">
      <div class="signin-message">
        <h3>Google Calendar</h3>
        <p>Sign in to view and manage your calendars</p>
        <button class="cal-btn primary signin-btn">Sign in with Google</button>
      </div>
    </div>
  `;

  container.querySelector('.signin-btn').addEventListener('click', async () => {
    window.location.href = await getAuthUrl();
  });
}

function renderLoading(container) {
  const darkClass = isDarkMode ? 'dark' : '';
  container.innerHTML = `
    <div class="calendar-widget calendar-loading ${darkClass}">
      <div class="loading-message">Loading calendar...</div>
    </div>
  `;
}

// Main widget render function
// Options: args.view ('month' or 'list'), args.weekStart ('sunday' or 'monday'), args.weeks (number)
async function renderCalendarWidget(
  container,
  panel,
  { refreshIntervals, parseDuration, dark = true }
) {
  currentContainer = container;
  isDarkMode = dark;

  // Load preferences from dashboardConfig
  loadCalendarSettings();

  // Apply config options (only if explicitly set, otherwise use stored preference)
  if (panel.args?.view === 'list') {
    currentView = 'list';
  } else if (panel.args?.view === 'month') {
    currentView = 'month';
  }
  // If no panel.args.view, keep the loaded preference

  if (panel.args?.weekStart === 'sunday') {
    weekStartsOn = 0;
  } else {
    weekStartsOn = 1; // Default to Monday
  }
  setWeekStart(weekStartsOn); // Sync with wheel-picker mini calendar

  if (panel.args?.weeks && typeof panel.args.weeks === 'number') {
    weeksToShow = panel.args.weeks;
  } else {
    weeksToShow = 4; // Default 4 weeks
  }

  // Time display options (always 12-hour format with AM/PM)
  showTime = panel.args?.showTime === true;
  showSeconds = panel.args?.showSeconds === true;

  // Clear any existing clock interval
  if (timeIntervalId) {
    clearInterval(timeIntervalId);
    timeIntervalId = null;
  }

  // Set up clock update interval if showing time
  if (showTime) {
    // Helper to sync clock to second boundary
    const syncToSecond = () => {
      const now = new Date();
      const msUntilNextSecond = 1000 - now.getMilliseconds();
      const syncTimeout = setTimeout(() => {
        updateClockDisplay();
        timeIntervalId = setInterval(updateClockDisplay, 1000);
        refreshIntervals.push(timeIntervalId);
      }, msUntilNextSecond);
      refreshIntervals.push(syncTimeout);
    };

    // Helper to sync clock to minute boundary
    const syncToMinute = () => {
      const now = new Date();
      const msUntilNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      const syncTimeout = setTimeout(() => {
        updateClockDisplay();
        timeIntervalId = setInterval(updateClockDisplay, 60000);
        refreshIntervals.push(timeIntervalId);
      }, msUntilNextMinute);
      refreshIntervals.push(syncTimeout);
    };

    const syncFn = showSeconds ? syncToSecond : syncToMinute;
    syncFn();

    // Re-sync every hour to prevent drift
    const resyncId = setInterval(() => {
      clearInterval(timeIntervalId);
      syncFn();
    }, 3600000);
    refreshIntervals.push(resyncId);
  }

  // Reset grid start date when widget is initialized
  gridStartDate = null;

  // Check for dev mode callback first (implicit flow - token in hash)
  const devAuth = handleDevCallback();
  if (devAuth) {
    accessToken = devAuth.accessToken;
  }

  // Check for OAuth callback (async - exchanges code for tokens)
  if (!accessToken) {
    const callbackAuth = await handleOAuthCallback();
    if (callbackAuth) {
      accessToken = callbackAuth.accessToken;
    }
  }

  // Check for stored auth if no callback
  if (!accessToken) {
    const storedAuth = getStoredAuth();
    if (storedAuth) {
      accessToken = storedAuth.accessToken;
    }
  }

  if (accessToken) {
    renderLoading(container);
    loadEvents();
  } else {
    renderSignIn(container);
  }

  // Set up refresh if configured
  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadEvents, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

// Register the widget
registerWidget('calendar', renderCalendarWidget);
