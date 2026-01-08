// Google Calendar API wrapper

const BASE_URL = 'https://www.googleapis.com/calendar/v3';

async function apiRequest(endpoint, accessToken, options = {}) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function listCalendars(accessToken) {
  const data = await apiRequest('/users/me/calendarList', accessToken);
  return data.items || [];
}

export async function listEvents(accessToken, calendarId, timeMin, timeMax) {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  const data = await apiRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    accessToken
  );
  return data.items || [];
}

export async function getEvent(accessToken, calendarId, eventId) {
  return apiRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken
  );
}

export async function createEvent(accessToken, calendarId, event) {
  return apiRequest(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
    method: 'POST',
    body: JSON.stringify(event),
  });
}

export async function updateEvent(accessToken, calendarId, eventId, event) {
  return apiRequest(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify(event),
    }
  );
}

export async function deleteEvent(accessToken, calendarId, eventId) {
  const response = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 204) {
    if (response.status === 401) {
      throw new Error('AUTH_EXPIRED');
    }
    throw new Error(`API error: ${response.status}`);
  }
}

// Get all events from all calendars for a date range
export async function getAllEvents(accessToken, timeMin, timeMax) {
  const calendars = await listCalendars(accessToken);

  // Fetch events from all calendars in parallel
  const eventPromises = calendars
    .filter((cal) => cal.selected !== false) // Only selected calendars
    .map(async (cal) => {
      try {
        const events = await listEvents(accessToken, cal.id, timeMin, timeMax);
        return events.map((event) => ({
          ...event,
          calendarId: cal.id,
          calendarColor: cal.backgroundColor,
          calendarName: cal.summary,
        }));
      } catch (e) {
        console.warn(`Failed to fetch events from ${cal.summary}:`, e);
        return [];
      }
    });

  const results = await Promise.all(eventPromises);
  const allEvents = results.flat();

  // Sort by start time
  allEvents.sort((a, b) => {
    const aStart = a.start.dateTime || a.start.date;
    const bStart = b.start.dateTime || b.start.date;
    return new Date(aStart) - new Date(bStart);
  });

  return { calendars, events: allEvents };
}
