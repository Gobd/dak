import { useEffect, useMemo, useState } from 'react';
import { Maximize, Moon, Settings as SettingsIcon, Sun, Sunrise, Sunset } from 'lucide-react';
import { useDarkMode, useInterval, useLocalStorage } from '@dak/hooks';
import { Button } from '@dak/ui';
import ClockCanvas from './components/ClockCanvas';
import Settings from './components/Settings';
import Weather from './components/Weather';
import { DEFAULT_SETTINGS, normalizeSettings } from './lib/settings';
import { formatClockDate } from './lib/date';
import { clockColorStyles } from './lib/colors';
import { dayFraction, dayKey, getSolarDay } from './lib/solar';
import { displayUrl, settingsFromParams } from './lib/url';
import useCalendarFeed from './hooks/useCalendarFeed';
import { calendarsFromEvents, eventsForDay, MAX_EVENT_LANES } from './lib/events';

const solarTime = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export default function App() {
  const [stored, saveSettings] = useLocalStorage('clock-settings', DEFAULT_SETTINGS);
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const [urlSettings, setUrlSettings] = useState(() => settingsFromParams(params));
  const settings = useMemo(
    () => normalizeSettings({ ...normalizeSettings(stored), ...urlSettings }),
    [stored, urlSettings],
  );
  const kiosk =
    params.get('f') === '1' || params.get('kiosk') === '1' || params.get('fullscreen') === '1';
  const [dark, setDark] = useDarkMode('clock-dark-mode');
  useEffect(() => {
    const theme = params.get('theme');
    if (theme === 'dark' || theme === 'light') setDark(theme === 'dark');
  }, [params, setDark]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [visible, setVisible] = useState(!document.hidden);
  const [fullscreenError, setFullscreenError] = useState('');
  useInterval(() => setNow(new Date()), visible ? (settings.seconds ? 1000 : 10000) : null);
  useEffect(() => {
    const refresh = () => {
      setVisible(!document.hidden);
      if (!document.hidden) setNow(new Date());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  const { snapshot, error: calendarError } = useCalendarFeed(settings, visible);
  const key = dayKey(now);
  const expired = snapshot?.expires_at
    ? new Date(snapshot.expires_at).getTime() <= now.getTime()
    : false;
  const dailyEvents = useMemo(
    () =>
      snapshot && !expired
        ? eventsForDay(snapshot.events, new Date(), settings.calendarIds, settings.calendarFilter)
        : [],
    [snapshot, expired, key, settings.calendarIds, settings.calendarFilter],
  );
  const availableCalendars = useMemo(
    () =>
      snapshot
        ? snapshot.calendars?.length
          ? snapshot.calendars.map((calendar) => ({
              id: calendar.id,
              name: calendar.name,
              color: calendar.color ?? null,
            }))
          : calendarsFromEvents(snapshot.events)
        : [],
    [snapshot],
  );
  const legendCalendars = availableCalendars.filter((calendar) =>
    dailyEvents.some((event) => event.calendarId === calendar.id),
  );
  const overflowingEvents = dailyEvents.filter((event) => event.lane >= MAX_EVENT_LANES).length;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const covered =
    snapshot?.window_start &&
    snapshot.window_end &&
    new Date(snapshot.window_start) <= todayStart &&
    new Date(snapshot.window_end) >= todayEnd;
  const stale =
    snapshot?.stale ||
    (snapshot?.updated_at && now.getTime() - new Date(snapshot.updated_at).getTime() > 15 * 60000);
  const calendarStatus =
    calendarError ||
    (expired
      ? 'Calendar snapshot expired'
      : !snapshot
        ? 'Connecting calendar…'
        : !snapshot.updated_at
          ? 'Waiting for dashboard calendar sync'
          : !covered
            ? 'Calendar feed does not cover today'
            : stale
              ? 'Calendar snapshot is stale'
              : '');
  const solar = useMemo(
    () =>
      settings.latitude !== null && settings.longitude !== null
        ? getSolarDay(new Date(), settings.latitude, settings.longitude)
        : null,
    [key, settings.latitude, settings.longitude],
  );
  const timeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        ...(settings.seconds ? ({ second: '2-digit' } as const) : {}),
        hourCycle: settings.digitalTimeFormat === '12h' ? 'h12' : 'h23',
      }),
    [settings.seconds, settings.digitalTimeFormat],
  );
  // The linear view is shaded edge-to-edge; choose legible text for the band beneath the overlays.
  const centerIsDay = solar?.daylight.some((period) => period.start <= 0.5 && period.end > 0.5);
  const fraction = dayFraction(now);
  const isDay = solar?.daylight.some((period) => period.start <= fraction && period.end > fraction);

  return (
    <main className={`clock-screen ${settings.mode}`} aria-label="Clock">
      <div
        className={`clock-display ${settings.mode === 'linear' ? `rectangle-bar-${settings.rectangleBar}` : ''}`}
        style={{
          ...clockColorStyles(settings),
          ...(settings.mode === 'linear' && solar
            ? { color: `var(--clock-${centerIsDay ? 'day' : 'night'}-text)` }
            : {}),
        }}
      >
        <ClockCanvas settings={settings} dark={dark} events={dailyEvents} />
        <div className="clock-info">
          {settings.showTime && (
            <time dateTime={now.toISOString()} className="clock-time tabular-nums">
              {timeFormat.format(now)}
            </time>
          )}
          {settings.dateFormat !== 'none' && (
            <div className="clock-date">{formatClockDate(now, settings.dateFormat)}</div>
          )}
          {settings.showSolarTimes && solar && (
            <div className="clock-solar text-sm">
              {solar.events.map((event) => (
                <span key={event.time.getTime()} className="inline-flex items-center gap-1.5">
                  {event.kind === 'sunrise' ? (
                    <Sunrise className="w-4 h-4" aria-label="Sunrise" />
                  ) : (
                    <Sunset className="w-4 h-4" aria-label="Sunset" />
                  )}
                  {solarTime.format(event.time)}
                </span>
              ))}
              {solar.state !== 'normal' && (
                <span>{solar.state === 'polar-day' ? 'Daylight all day' : 'Night all day'}</span>
              )}
            </div>
          )}
          {settings.mode === 'linear' &&
            (settings.showWeather || settings.showTomorrowWeather) &&
            settings.rectangleBar !== 'overlay' && (
              <Weather settings={settings} now={now} visible={visible} />
            )}
          {settings.showEventList && settings.calendarRelay && (
            <section className="clock-agenda" aria-label="Today's calendar events">
              <ul>
                {dailyEvents.slice(0, 5).map((event) => (
                  <li key={event.key} title={`${event.calendarName}: ${event.title}`}>
                    <span
                      className="clock-event-dot"
                      style={{
                        background: settings.eventColor ?? event.color ?? 'var(--color-feature)',
                      }}
                    />
                    <span className="truncate">{event.title}</span>
                    <span className="tabular-nums text-xs whitespace-nowrap">
                      {event.allDay
                        ? 'All day'
                        : `${event.continuesBefore ? '↤ ' : ''}${solarTime.format(event.startTime!)}–${solarTime.format(event.endTime!)}${event.continuesAfter ? ' ↦' : ''}${event.repeatedHour ? ' (DST)' : ''}`}
                    </span>
                  </li>
                ))}
              </ul>
              {dailyEvents.length > 5 && (
                <p className="text-xs">+{dailyEvents.length - 5} more events</p>
              )}
              {!dailyEvents.length && covered && !expired && !calendarError && (
                <p className="text-sm">No events today</p>
              )}
            </section>
          )}
          {settings.showCalendarLegend && legendCalendars.length > 0 && (
            <div className="clock-calendar-legend" aria-label="Calendar color legend">
              {legendCalendars.map((calendar) => (
                <span key={calendar.id} className="inline-flex items-center gap-1.5 max-w-full">
                  <span
                    className="clock-event-dot shrink-0"
                    style={{
                      background: settings.eventColor ?? calendar.color ?? 'var(--color-feature)',
                    }}
                  />
                  <span className="truncate">{calendar.name}</span>
                </span>
              ))}
            </div>
          )}
          {settings.showCalendarStatus && settings.calendarRelay && (
            <div className="clock-calendar-status text-xs" role="status">
              {calendarStatus}
              {overflowingEvents > 0 && settings.eventStyle !== 'none' && (
                <span> · {overflowingEvents} overlapping events beyond the 5 visible lanes</span>
              )}
            </div>
          )}
          {!kiosk && (
            <nav className="clock-controls" aria-label="Display controls">
              <Button
                variant="secondary"
                size="icon"
                aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={() => setDark(!dark)}
              >
                {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              {document.fullscreenEnabled && (
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Toggle fullscreen"
                  onClick={async () => {
                    try {
                      if (document.fullscreenElement) await document.exitFullscreen();
                      else await document.documentElement.requestFullscreen();
                      setFullscreenError('');
                    } catch {
                      setFullscreenError('Use the browser’s fullscreen control.');
                    }
                  }}
                >
                  <Maximize className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="icon"
                aria-label="Clock settings"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon className="w-4 h-4" />
              </Button>
            </nav>
          )}
          {fullscreenError && (
            <p role="status" className="clock-message text-sm">
              {fullscreenError}
            </p>
          )}
        </div>
        <span className="sr-only">
          {isDay
            ? 'Daylight'
            : solar
              ? 'Night'
              : 'Location not set. Open clock settings to set latitude and longitude.'}
        </span>
      </div>
      {settingsOpen && (
        <Settings
          settings={settings}
          dark={dark}
          calendars={availableCalendars}
          onSave={(next, nextDark) => {
            saveSettings(next);
            setDark(nextDark);
            setUrlSettings({});
            if (params.size)
              window.history.replaceState(
                {},
                '',
                displayUrl(window.location.href, next, nextDark, kiosk),
              );
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </main>
  );
}
