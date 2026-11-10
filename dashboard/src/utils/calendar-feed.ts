import { publishCalendarSnapshot, type CalendarFeedEvent } from '@dak/api-client';
import { fetchCalendarApi } from '../hooks/useGoogleAuth';

interface FeedCalendar {
  id: string;
  summary: string;
  backgroundColor: string;
}

interface GooglePage {
  items?: {
    id: string;
    summary?: string;
    status?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }[];
  nextPageToken?: string;
}

const shortText = (text: string) => [...text].slice(0, 160).join('');

// Fetch a small, independent window so browsing another month doesn't erase today's feed.
// Nothing is published until every selected calendar/page has succeeded.
export async function publishCalendarFeed(
  accessToken: string,
  calendars: FeedCalendar[],
  names: Record<string, string>,
  relayUrl: string,
  publishKey: string,
  externalSignal: AbortSignal,
): Promise<void> {
  if (calendars.length > 100) throw new Error('Calendar feed exceeds 100 calendars.');
  const now = new Date();
  const start = new Date(now.getTime() - 86400000);
  const end = new Date(now.getTime() + 2 * 86400000);
  const events: CalendarFeedEvent[] = [];
  const signal = AbortSignal.any([externalSignal, AbortSignal.timeout(30000)]);
  for (const calendar of calendars) {
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const params = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await fetchCalendarApi<GooglePage>(
        `/calendars/${encodeURIComponent(calendar.id)}/events?${params}`,
        accessToken,
        { signal },
      );
      for (const event of page.items ?? []) {
        if (event.status === 'cancelled' || !event.start || !event.end) continue;
        const from = event.start.dateTime ?? event.start.date;
        const to = event.end.dateTime ?? event.end.date;
        if (!from || !to || from === to) continue;
        events.push({
          id: event.id,
          calendar_id: calendar.id,
          calendar_name: shortText(names[calendar.id] ?? calendar.summary),
          title: shortText(event.summary ?? '(No title)'),
          start: from,
          end: to,
          all_day: !event.start.dateTime,
          color: /^#[0-9a-f]{6}$/i.test(calendar.backgroundColor) ? calendar.backgroundColor : null,
        });
        if (events.length > 1000)
          throw new Error('Calendar feed exceeds 1000 events; select fewer calendars.');
      }
      pageToken = page.nextPageToken;
      pages++;
      if (pageToken && pages >= 10)
        throw new Error('Calendar feed pagination limit reached; select fewer calendars.');
    } while (pageToken);
  }
  const { response } = await publishCalendarSnapshot({
    baseUrl: relayUrl,
    headers: { authorization: `Bearer ${publishKey}` },
    body: {
      window_start: start.toISOString(),
      window_end: end.toISOString(),
      events,
      calendars: calendars.map((calendar) => ({
        id: calendar.id,
        name: shortText(names[calendar.id] ?? calendar.summary),
        color: /^#[0-9a-f]{6}$/i.test(calendar.backgroundColor) ? calendar.backgroundColor : null,
      })),
    },
    signal,
    referrerPolicy: 'no-referrer',
  });
  if (!response?.ok)
    throw new Error(`Calendar relay rejected snapshot (${response?.status ?? 'network error'}).`);
}
