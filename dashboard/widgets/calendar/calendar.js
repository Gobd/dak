import { registerWidget } from '../../script.js';
import {
  getStoredAuth,
  getAuthUrl,
  handleOAuthCallback,
  clearAuth,
  isConfigured,
} from './oauth.js';
import { getAllEvents, createEvent, updateEvent, deleteEvent } from './api.js';

// Calendar Widget - Month grid and list views

const HIDDEN_CALENDARS_KEY = 'calendar-hidden';

let calendars = [];
let events = [];
let hiddenCalendars = new Set(); // Calendar IDs to hide
let accessToken = null;
let currentContainer = null;
let currentView = 'month'; // 'month' or 'list'
let gridStartDate = null; // Start date for grid view (most recent week start)
let weeksToShow = 4; // Configurable number of weeks
let weekStartsOn = 1; // 0 = Sunday, 1 = Monday (default Monday)

// Load hidden calendars from localStorage
function loadHiddenCalendars() {
  try {
    const stored = localStorage.getItem(HIDDEN_CALENDARS_KEY);
    if (stored) {
      hiddenCalendars = new Set(JSON.parse(stored));
    }
  } catch {
    hiddenCalendars = new Set();
  }
}

// Save hidden calendars to localStorage
function saveHiddenCalendars() {
  localStorage.setItem(HIDDEN_CALENDARS_KEY, JSON.stringify([...hiddenCalendars]));
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

  container.innerHTML = `
    <div class="calendar-widget">
      <div class="calendar-header">
        <button class="cal-nav-btn" data-action="prev-week">‹</button>
        <span class="cal-title">${dateRange}</span>
        <button class="cal-nav-btn" data-action="next-week">›</button>
        <button class="cal-nav-btn cal-today-btn ${todayInView ? 'active' : ''}" data-action="today">Today</button>
        <div class="cal-view-toggle">
          <button class="cal-view-btn ${currentView === 'month' ? 'active' : ''}" data-view="month">Month</button>
          <button class="cal-view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list">List</button>
        </div>
        <button class="cal-nav-btn" data-action="filter" title="Filter calendars">☰</button>
        <button class="cal-nav-btn" data-action="add">+</button>
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
  container.querySelectorAll('.calendar-header [data-view]').forEach((btn) => {
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

  container.innerHTML = `
    <div class="calendar-widget">
      <div class="calendar-header">
        <button class="cal-nav-btn cal-today-btn" data-action="today">Today</button>
        <span class="cal-title">Calendar</span>
        <div class="cal-view-toggle">
          <button class="cal-view-btn ${currentView === 'month' ? 'active' : ''}" data-view="month">Month</button>
          <button class="cal-view-btn ${currentView === 'list' ? 'active' : ''}" data-view="list">List</button>
        </div>
        <button class="cal-nav-btn" data-action="filter" title="Filter calendars">☰</button>
        <button class="cal-nav-btn" data-action="add">+</button>
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
  container.querySelectorAll('.calendar-header [data-view]').forEach((btn) => {
    btn.addEventListener('click', handleListHeaderClick);
  });
  container.querySelector('.calendar-scroll').addEventListener('click', handleListDayClick);
}

function handleMonthHeaderClick(e) {
  const btn = e.target.closest('[data-action], [data-view]') || e.currentTarget;
  const action = btn.dataset.action;
  const view = btn.dataset.view;

  if (view) {
    currentView = view;
    refreshCalendar();
  } else if (action === 'prev-week') {
    gridStartDate.setDate(gridStartDate.getDate() - 7);
    refreshCalendar();
  } else if (action === 'next-week') {
    gridStartDate.setDate(gridStartDate.getDate() + 7);
    refreshCalendar();
  } else if (action === 'today') {
    gridStartDate = getMostRecentWeekStart();
    refreshCalendar();
  } else if (action === 'filter') {
    showCalendarFilterModal();
  } else if (action === 'add') {
    showAddEventModal(new Date());
  }
}

function handleListHeaderClick(e) {
  const btn = e.target.closest('[data-action], [data-view]') || e.currentTarget;
  const action = btn.dataset.action;
  const view = btn.dataset.view;

  if (view) {
    currentView = view;
    if (view === 'month') {
      gridStartDate = getMostRecentWeekStart(); // Reset to current week when switching
    }
    refreshCalendar();
  } else if (action === 'today') {
    const today = formatLocalDate(new Date());
    const todayEl = currentContainer?.querySelector(`#date-${today}`);
    if (todayEl) {
      const scrollContainer = currentContainer.querySelector('#calendar-scroll');
      scrollContainer.scrollTo({ top: todayEl.offsetTop - 50, behavior: 'smooth' });
    }
  } else if (action === 'filter') {
    showCalendarFilterModal();
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
  if (!accessToken) return;

  try {
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
    if (err.message === 'AUTH_EXPIRED') {
      clearAuth();
      accessToken = null;
      renderSignIn(currentContainer);
    } else {
      console.error('Failed to load events:', err);
    }
  }
}

function showEventModal(event) {
  const startTime = formatTime(event.start.dateTime || event.start.date);
  const endTime = formatTime(event.end.dateTime || event.end.date);
  const isAllDay = !event.start.dateTime;
  const eventDate = new Date(event.start.dateTime || event.start.date);
  const dateStr = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>${event.summary || '(No title)'}</h3>
      <p class="event-date">${dateStr}</p>
      <p class="event-time">${isAllDay ? 'All day' : `${startTime} - ${endTime}`}</p>
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
      if (confirm('Delete this event?')) {
        try {
          await deleteEvent(accessToken, event.calendarId, event.id);
          modal.remove();
          await loadEvents();
        } catch {
          alert('Failed to delete event');
        }
      }
    } else if (action === 'edit') {
      modal.remove();
      showEditEventModal(event);
    }
  });

  document.body.appendChild(modal);
}

function showAddEventModal(date) {
  const dateStr = formatLocalDate(date);
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
    <div class="cal-modal-content">
      <h3>Add Event</h3>
      <label>
        Title
        <input type="text" id="event-title" placeholder="Event title">
      </label>
      <label>
        Date
        <input type="date" id="event-date" value="${dateStr}">
      </label>
      <div class="time-row">
        <label>
          Start
          <input type="time" id="event-start" value="09:00">
        </label>
        <label>
          End
          <input type="time" id="event-end" value="10:00">
        </label>
      </div>
      <label>
        <input type="checkbox" id="event-allday"> All day
      </label>
      <label>
        Calendar
        <select id="event-calendar">${calendarOptions}</select>
      </label>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="cancel">Cancel</button>
        <button class="cal-btn primary" data-action="save">Save</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'save') {
      const title = modal.querySelector('#event-title').value;
      const date = modal.querySelector('#event-date').value;
      const startTime = modal.querySelector('#event-start').value;
      const endTime = modal.querySelector('#event-end').value;
      const allDay = modal.querySelector('#event-allday').checked;
      const calendarId = modal.querySelector('#event-calendar').value;

      const event = {
        summary: title || '(No title)',
      };

      if (allDay) {
        event.start = { date };
        event.end = { date };
      } else {
        event.start = {
          dateTime: `${date}T${startTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        event.end = {
          dateTime: `${date}T${endTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      try {
        await createEvent(accessToken, calendarId, event);
        modal.remove();
        await loadEvents();
      } catch {
        alert('Failed to create event');
      }
    }
  });

  document.body.appendChild(modal);
  modal.querySelector('#event-title').focus();
}

function showEditEventModal(event) {
  const startDate = (event.start.dateTime || event.start.date).split('T')[0];
  const startTime = event.start.dateTime
    ? event.start.dateTime.split('T')[1].substring(0, 5)
    : '09:00';
  const endTime = event.end.dateTime ? event.end.dateTime.split('T')[1].substring(0, 5) : '10:00';
  const isAllDay = !event.start.dateTime;

  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Edit Event</h3>
      <label>
        Title
        <input type="text" id="event-title" value="${event.summary || ''}">
      </label>
      <label>
        Date
        <input type="date" id="event-date" value="${startDate}">
      </label>
      <div class="time-row">
        <label>
          Start
          <input type="time" id="event-start" value="${startTime}">
        </label>
        <label>
          End
          <input type="time" id="event-end" value="${endTime}">
        </label>
      </div>
      <label>
        <input type="checkbox" id="event-allday" ${isAllDay ? 'checked' : ''}> All day
      </label>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="cancel">Cancel</button>
        <button class="cal-btn primary" data-action="save">Save</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (action === 'cancel' || e.target === modal) {
      modal.remove();
    } else if (action === 'save') {
      const title = modal.querySelector('#event-title').value;
      const date = modal.querySelector('#event-date').value;
      const startTime = modal.querySelector('#event-start').value;
      const endTime = modal.querySelector('#event-end').value;
      const allDay = modal.querySelector('#event-allday').checked;

      const updatedEvent = {
        ...event,
        summary: title || '(No title)',
      };

      if (allDay) {
        updatedEvent.start = { date };
        updatedEvent.end = { date };
      } else {
        updatedEvent.start = {
          dateTime: `${date}T${startTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
        updatedEvent.end = {
          dateTime: `${date}T${endTime}:00`,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      try {
        await updateEvent(accessToken, event.calendarId, event.id, updatedEvent);
        modal.remove();
        await loadEvents();
      } catch {
        alert('Failed to update event');
      }
    }
  });

  document.body.appendChild(modal);
}

function showCalendarFilterModal() {
  const modal = document.createElement('div');
  modal.className = 'cal-modal open';
  modal.innerHTML = `
    <div class="cal-modal-content">
      <h3>Filter Calendars</h3>
      <div class="calendar-filter-list">
        ${calendars
          .map(
            (cal) => `
          <label class="calendar-filter-item">
            <input type="checkbox" data-calendar-id="${cal.id}"
                   ${isCalendarVisible(cal.id) ? 'checked' : ''}>
            <span class="calendar-color-dot" style="background: ${cal.backgroundColor}"></span>
            <span class="calendar-name">${cal.summary}</span>
          </label>
        `
          )
          .join('')}
      </div>
      <div class="cal-modal-actions">
        <button class="cal-btn" data-action="close">Close</button>
        <button class="cal-btn primary" data-action="apply">Apply</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'close' || e.target === modal) {
      modal.remove();
    } else if (action === 'apply') {
      // Update hidden calendars based on checkboxes
      hiddenCalendars.clear();
      modal.querySelectorAll('input[data-calendar-id]').forEach((checkbox) => {
        if (!checkbox.checked) {
          hiddenCalendars.add(checkbox.dataset.calendarId);
        }
      });
      saveHiddenCalendars();
      modal.remove();
      refreshCalendar();
    }
  });

  document.body.appendChild(modal);
}

function renderSignIn(container) {
  if (!isConfigured()) {
    container.innerHTML = `
      <div class="calendar-widget calendar-setup">
        <div class="setup-message">
          <h3>Calendar Setup Required</h3>
          <p>Add your Google OAuth Client ID to:</p>
          <code>widgets/calendar/oauth.js</code>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="calendar-widget calendar-signin">
      <div class="signin-message">
        <h3>Google Calendar</h3>
        <p>Sign in to view and manage your calendars</p>
        <button class="cal-btn primary signin-btn">Sign in with Google</button>
      </div>
    </div>
  `;

  container.querySelector('.signin-btn').addEventListener('click', () => {
    window.location.href = getAuthUrl();
  });
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="calendar-widget calendar-loading">
      <div class="loading-message">Loading calendar...</div>
    </div>
  `;
}

// Main widget render function
// Options: args.view ('month' or 'list'), args.weekStart ('sunday' or 'monday'), args.weeks (number)
function renderCalendarWidget(container, panel, { refreshIntervals, parseDuration }) {
  currentContainer = container;

  // Load hidden calendars preference
  loadHiddenCalendars();

  // Apply config options
  if (panel.args?.view === 'list') {
    currentView = 'list';
  } else {
    currentView = 'month';
  }

  if (panel.args?.weekStart === 'sunday') {
    weekStartsOn = 0;
  } else {
    weekStartsOn = 1; // Default to Monday
  }

  if (panel.args?.weeks && typeof panel.args.weeks === 'number') {
    weeksToShow = panel.args.weeks;
  } else {
    weeksToShow = 4; // Default 4 weeks
  }

  // Reset grid start date when widget is initialized
  gridStartDate = null;

  // Check for OAuth callback first
  const callbackAuth = handleOAuthCallback();
  if (callbackAuth) {
    accessToken = callbackAuth.accessToken;
  }

  // Check for stored auth
  const storedAuth = getStoredAuth();
  if (storedAuth) {
    accessToken = storedAuth.accessToken;
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
