import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Toggle } from '@dak/ui';
import { useCopyToClipboard } from '@dak/hooks';
import {
  DATE_FORMATS,
  normalizeCalendarRelay,
  normalizeSettings,
  validCoordinates,
  type ClockSettings,
} from '../lib/settings';
import { formatClockDate } from '../lib/date';
import { themeColorHex } from '../lib/colors';
import { displayUrl } from '../lib/url';
import { CLOCK_THEMES, clockThemeColors } from '../lib/themes';
import type { ClockCalendar } from '../lib/events';

const COLOR_FIELDS = [
  { key: 'dayColor', label: 'Day', token: '--clock-day' },
  { key: 'nightColor', label: 'Night', token: '--clock-night' },
  { key: 'handColor', label: '24-hour hand / marker', token: '--clock-hand' },
  { key: 'secondColor', label: 'Second hand / marker', token: '--clock-second' },
  { key: 'eventColor', label: 'Event bands / dots', token: '--color-feature' },
] as const;

export default function Settings({
  settings,
  dark,
  calendars,
  onSave,
  onClose,
}: {
  settings: ClockSettings;
  dark: boolean;
  calendars: ClockCalendar[];
  onSave: (settings: ClockSettings, dark: boolean) => void;
  onClose: () => void;
}) {
  const [draftDark, setDraftDark] = useState(dark);
  const [themeOptions] = useState(() =>
    CLOCK_THEMES.map((theme) => ({ ...theme, colors: clockThemeColors(theme.id, themeColorHex) })),
  );
  const [latitude, setLatitude] = useState(settings.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(settings.longitude?.toString() ?? '');
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const locationRequest = useRef(0);
  useEffect(
    () => () => {
      locationRequest.current++;
    },
    [],
  );
  const editCoordinate = (update: (value: string) => void, value: string) => {
    locationRequest.current++;
    setLocating(false);
    setLocationError('');
    update(value);
  };
  const useCurrentLocation = () => {
    setLocationError('');
    if (!navigator.geolocation || !window.isSecureContext) {
      setLocationError(
        'Browser location requires HTTPS or localhost. You can enter coordinates manually.',
      );
      return;
    }
    const request = ++locationRequest.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        const { latitude: lat, longitude: lng } = position.coords;
        if (!validCoordinates(lat, lng)) {
          setLocationError('The browser returned an invalid location. Enter coordinates manually.');
          return;
        }
        setLatitude(lat.toFixed(6));
        setLongitude(lng.toFixed(6));
      },
      (cause) => {
        if (request !== locationRequest.current) return;
        setLocating(false);
        setLocationError(
          cause.code === 1
            ? 'Location permission was denied. Allow location in your browser or enter coordinates manually.'
            : cause.code === 3
              ? 'Location lookup timed out. Try again or enter coordinates manually.'
              : 'The browser could not find your location. Enter coordinates manually.',
        );
      },
      { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false },
    );
  };
  const [mode, setMode] = useState(settings.mode);
  const [hourLabels, setHourLabels] = useState(settings.hourLabels);
  const [digitalTimeFormat, setDigitalTimeFormat] = useState(settings.digitalTimeFormat);
  const [rectangleBar, setRectangleBar] = useState(settings.rectangleBar);
  const [barColor, setBarColor] = useState(settings.barColor);
  const [barTextColor, setBarTextColor] = useState(settings.barTextColor);
  const [barTheme] = useState(() => ({
    background: themeColorHex('--color-surface-raised'),
    text: themeColorHex('--color-text'),
  }));
  const [showWeather, setShowWeather] = useState(settings.showWeather);
  const [showTomorrowWeather, setShowTomorrowWeather] = useState(settings.showTomorrowWeather);
  const [weatherUnit, setWeatherUnit] = useState(settings.weatherUnit);
  const [wipePast, setWipePast] = useState(settings.wipePast);
  const [wipeColor, setWipeColor] = useState(settings.wipeColor);
  const [wipeOpacity, setWipeOpacity] = useState(settings.wipeOpacity);
  const [showTimeMarker, setShowTimeMarker] = useState(settings.showTimeMarker);
  const [showSecondsMarker, setShowSecondsMarker] = useState(settings.showSecondsMarker);
  const [themeWipe] = useState(() => themeColorHex('--clock-wipe'));
  const [seconds, setSeconds] = useState(settings.seconds);
  const [showTime, setShowTime] = useState(settings.showTime);
  const [showSolarTimes, setShowSolarTimes] = useState(settings.showSolarTimes);
  const [dateFormat, setDateFormat] = useState(settings.dateFormat);
  const [colors, setColors] = useState({
    dayColor: settings.dayColor,
    nightColor: settings.nightColor,
    handColor: settings.handColor,
    secondColor: settings.secondColor,
    eventColor: settings.eventColor,
  });
  const [themeColors] = useState(() =>
    Object.fromEntries(COLOR_FIELDS.map((field) => [field.key, themeColorHex(field.token)])),
  );
  const [calendarRelay, setCalendarRelay] = useState(settings.calendarRelay);
  const [calendarIds, setCalendarIds] = useState(settings.calendarIds.join(', '));
  const [calendarFilter, setCalendarFilter] = useState(settings.calendarFilter);
  const [showCalendarLegend, setShowCalendarLegend] = useState(settings.showCalendarLegend);
  const [showEventNames, setShowEventNames] = useState(settings.showEventNames);
  const [eventStyle, setEventStyle] = useState(settings.eventStyle);
  const [eventPlacement, setEventPlacement] = useState(settings.eventPlacement);
  const [showEventList, setShowEventList] = useState(settings.showEventList);
  const [showCalendarStatus, setShowCalendarStatus] = useState(settings.showCalendarStatus);
  const [calendarPollSeconds, setCalendarPollSeconds] = useState(
    settings.calendarPollSeconds.toString(),
  );
  const [error, setError] = useState('');
  const [kioskUrl, setKioskUrl] = useState(true);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copy, copied] = useCopyToClipboard();
  const draftSettings = (): ClockSettings | null => {
    const empty = !latitude.trim() && !longitude.trim();
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!empty && (!latitude.trim() || !longitude.trim() || !validCoordinates(lat, lng))) {
      setError('Enter both coordinates: latitude −90 to 90, longitude −180 to 180.');
      return null;
    }
    if (calendarRelay.trim() && !normalizeCalendarRelay(calendarRelay)) {
      setError('Enter an HTTP(S) calendar relay base URL without query parameters or credentials.');
      return null;
    }
    const poll = Number(calendarPollSeconds);
    if (!Number.isFinite(poll) || poll < 30 || poll > 3600) {
      setError('Calendar refresh must be between 30 and 3600 seconds.');
      return null;
    }
    setError('');
    return normalizeSettings({
      calendarRelay,
      calendarFilter,
      showCalendarLegend,
      showEventNames,
      calendarIds: calendarIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
      eventStyle,
      eventPlacement,
      showEventList,
      showCalendarStatus,
      calendarPollSeconds: poll,
      mode,
      hourLabels,
      digitalTimeFormat,
      rectangleBar,
      barColor,
      barTextColor,
      showWeather,
      showTomorrowWeather,
      weatherUnit,
      wipePast,
      wipeColor,
      wipeOpacity,
      showTimeMarker,
      showSecondsMarker,
      seconds,
      showTime,
      showSolarTimes,
      dateFormat,
      ...colors,
      latitude: empty ? null : lat,
      longitude: empty ? null : lng,
    });
  };

  return (
    <Modal open onClose={onClose} title="Clock settings" wide>
      <form
        className="clock-settings-form min-w-0 space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          const draft = draftSettings();
          if (!draft) return;
          onSave(draft, draftDark);
          onClose();
        }}
      >
        <p className="text-sm text-text-muted">
          Changes apply when you save. Copy display URL includes your current choices, even before
          saving.
        </p>
        <fieldset>
          <legend className="text-sm font-semibold text-text mb-2">Clock shape</legend>
          <div className="flex gap-3">
            {(['circle', 'linear'] as const).map((shape) => (
              <Button
                key={shape}
                type="button"
                variant={mode === shape ? 'primary' : 'secondary'}
                aria-pressed={mode === shape}
                onClick={() => setMode(shape)}
                className="flex-1"
              >
                {shape === 'circle' ? 'Circular' : 'Linear / rectangle'}
              </Button>
            ))}
          </div>
        </fieldset>
        {mode === 'linear' && (
          <>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-text mb-2">Starter themes</legend>
              <div className="grid grid-cols-2 gap-2">
                {themeOptions.map((theme) => (
                  <Button
                    key={theme.id}
                    type="button"
                    variant="secondary"
                    className="justify-start border p-3 text-left"
                    style={{
                      backgroundColor: theme.colors.barColor!,
                      color: theme.colors.barTextColor!,
                      borderColor: theme.colors.dayColor!,
                    }}
                    onClick={() => {
                      const next = theme.colors;
                      setColors({
                        dayColor: next.dayColor,
                        nightColor: next.nightColor,
                        handColor: next.handColor,
                        secondColor: next.secondColor,
                        eventColor: null,
                      });
                      setBarColor(next.barColor);
                      setBarTextColor(next.barTextColor);
                      setWipeColor(next.wipeColor);
                      setDraftDark(theme.dark);
                    }}
                  >
                    <span className="flex min-w-0 w-full flex-col items-start gap-1">
                      <span>{theme.name}</span>
                      <span className="text-xs font-normal">{theme.description}</span>
                      <span className="inline-flex gap-1 mt-1" aria-hidden="true">
                        {[
                          theme.colors.dayColor,
                          theme.colors.nightColor,
                          theme.colors.handColor,
                          theme.colors.secondColor,
                        ].map((color, index) => (
                          <span
                            key={index}
                            className="w-4 h-2 rounded-sm"
                            style={{ backgroundColor: color! }}
                          />
                        ))}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
              <p className="text-xs text-text-muted">
                Pick a starting palette, then tweak any color. Calendar colors are restored; layout
                and weather choices stay as-is. Uses the default near-black wipe color without
                turning wiping on.
              </p>
              <Toggle checked={draftDark} onChange={setDraftDark} label="Dark display theme" />
              <p className="text-xs text-text-muted">
                Changes default backgrounds, text and controls. Your custom colors stay unchanged.
              </p>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-text mb-2">Info bar</legend>
              <label className="block text-sm text-text-secondary">
                Position
                <select
                  value={rectangleBar}
                  onChange={(event) =>
                    setRectangleBar(event.target.value as ClockSettings['rectangleBar'])
                  }
                  className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
                >
                  <option value="top">Top bar</option>
                  <option value="bottom">Bottom bar</option>
                  <option value="overlay">No bar — overlay on clock</option>
                </select>
              </label>
              <p className="text-xs text-text-muted">
                Time, date, solar times and calendar legend/list share this position. No bar puts
                them over the clock; weather requires a top/bottom bar.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="color"
                    aria-label="Bar background color"
                    value={barColor ?? barTheme.background}
                    onChange={(event) => setBarColor(event.target.value)}
                    className="w-10 h-10 cursor-pointer rounded border border-border bg-surface"
                  />
                  Bar background
                </label>
                <label className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="color"
                    aria-label="Bar text color"
                    value={barTextColor ?? barTheme.text}
                    onChange={(event) => setBarTextColor(event.target.value)}
                    className="w-10 h-10 cursor-pointer rounded border border-border bg-surface"
                  />
                  Bar text
                </label>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setBarColor(null);
                  setBarTextColor(null);
                }}
              >
                Reset bar to theme colors
              </Button>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-text mb-2">Weather</legend>
              <p className="text-xs text-text-muted">
                Choose either day or both. Uses the coordinates in Location below.
              </p>
              <div className="flex flex-col gap-3">
                <Toggle
                  checked={showWeather}
                  onChange={setShowWeather}
                  label="Today's weather in info bar"
                />
                <Toggle
                  checked={showTomorrowWeather}
                  onChange={setShowTomorrowWeather}
                  label="Tomorrow's weather in info bar"
                />
              </div>
              {(showWeather || showTomorrowWeather) && (
                <label className="block text-sm text-text-secondary">
                  Weather temperature unit
                  <select
                    value={weatherUnit}
                    onChange={(event) =>
                      setWeatherUnit(event.target.value as ClockSettings['weatherUnit'])
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
                  >
                    <option value="fahrenheit">Fahrenheit (°F)</option>
                    <option value="celsius">Celsius (°C)</option>
                  </select>
                </label>
              )}
              {(showWeather || showTomorrowWeather) && rectangleBar === 'overlay' && (
                <p className="text-sm text-warning" role="status">
                  Choose a top or bottom info bar to show weather.
                </p>
              )}
              {(showWeather || showTomorrowWeather) && (!latitude.trim() || !longitude.trim()) && (
                <p className="text-sm text-warning" role="status">
                  Add both coordinates in Location below to show weather.
                </p>
              )}
              <details className="text-xs text-text-muted">
                <summary className="cursor-pointer">Weather data &amp; privacy</summary>
                <p className="mt-2">
                  Open-Meteo receives your coordinates; no key or relay is needed. Refreshes every
                  30 minutes. Shows condition, low/high and chance of any precipitation—not separate
                  rain/snow probabilities. “Precip” is the total chance; the forecast condition
                  shows Rain or Snow separately. A snowflake marks snowy forecasts, a droplet marks
                  other precipitation; the chance is hidden at 0%. Forecast dates follow this
                  device's timezone.
                </p>
                <p className="mt-2">
                  Weather data by{' '}
                  <a
                    href="https://open-meteo.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    Open-Meteo
                  </a>
                  , under{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline"
                  >
                    CC BY 4.0
                  </a>
                  . Temperatures are rounded and shown as a daily summary. The small info link
                  beside the forecast provides the required source credit.
                </p>
              </details>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-text mb-2">
                Elapsed time &amp; markers
              </legend>
              <Toggle checked={wipePast} onChange={setWipePast} label="Wipe elapsed time" />
              {wipePast && (
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm text-text">
                    <input
                      type="color"
                      aria-label="Wipe color"
                      value={wipeColor ?? themeWipe}
                      onChange={(event) => setWipeColor(event.target.value)}
                      className="w-10 h-10 cursor-pointer rounded border border-border bg-surface"
                    />
                    Wipe color
                  </label>
                  <label className="block text-sm text-text-secondary">
                    Wipe opacity: {wipeOpacity}%
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={wipeOpacity}
                      onChange={(event) => setWipeOpacity(Number(event.target.value))}
                      className="mt-2 block w-full accent-accent"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setWipeColor(null)}
                  >
                    Use theme wipe color
                  </Button>
                  <p className="text-sm text-text-muted">
                    Covers midnight through now, including past event marks and hour labels. The
                    default is near-black to stand out from night shading. Use 100% for a solid
                    blackout.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Toggle
                  checked={showTimeMarker}
                  onChange={setShowTimeMarker}
                  label="Current-time vertical marker"
                />
                <Toggle
                  checked={showSecondsMarker}
                  onChange={setShowSecondsMarker}
                  label="Seconds sweep / horizontal track"
                />
              </div>
              <p className="text-sm text-text-muted">
                The wipe edge can replace the vertical time marker. Hide the seconds track
                separately; digital seconds are controlled in Time &amp; date below.
              </p>
            </fieldset>
          </>
        )}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text mb-2">Time &amp; date</legend>
          <label className="block text-sm text-text-secondary">
            Hour labels
            <select
              value={hourLabels}
              onChange={(event) => setHourLabels(event.target.value as ClockSettings['hourLabels'])}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
            >
              <option value="24h">24-hour numbers (00–23)</option>
              <option value="12h">Repeated 12-hour numbers (12, 1…11, twice)</option>
            </select>
            <span className="block mt-1 text-xs text-text-muted">
              The dial still spans 24 hours. Its labels and the digital time format are independent.
            </span>
          </label>
          <label className="block text-sm text-text-secondary">
            Digital time format
            <select
              value={digitalTimeFormat}
              onChange={(event) =>
                setDigitalTimeFormat(event.target.value as ClockSettings['digitalTimeFormat'])
              }
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
            >
              <option value="24h">24-hour (15:10)</option>
              <option value="12h">12-hour with AM/PM (3:10 PM)</option>
            </select>
          </label>
          <Toggle
            checked={seconds}
            onChange={setSeconds}
            label={mode === 'circle' ? 'Smooth second hand' : 'Digital seconds & optional sweep'}
          />
          <p className="text-sm text-text-muted">
            {mode === 'circle'
              ? 'Turn off seconds for the lowest CPU usage. The 24-hour hand still updates each minute.'
              : 'Adds seconds to digital time and animates the sweep if its track is enabled. Turn off for lower CPU usage; the time marker and wipe still update each minute.'}
          </p>
          <div className="flex flex-col gap-3">
            <Toggle checked={showTime} onChange={setShowTime} label="Digital time" />
            <Toggle
              checked={showSolarTimes}
              onChange={setShowSolarTimes}
              label="Sunrise / sunset times"
            />
          </div>
          <label className="block text-sm text-text-secondary">
            Date display
            <select
              className="mt-2 block w-full rounded-lg border border-border bg-surface-raised p-3 text-text"
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value as ClockSettings['dateFormat'])}
            >
              {Object.entries(DATE_FORMATS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {dateFormat !== 'none' && (
              <span className="block mt-2 text-text-muted">
                {formatClockDate(new Date(), dateFormat)}
              </span>
            )}
          </label>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text mb-2">Clock colors</legend>
          <div className="grid grid-cols-2 gap-3">
            {COLOR_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center gap-2 text-sm text-text">
                <input
                  type="color"
                  aria-label={field.label}
                  value={colors[field.key] ?? themeColors[field.key]}
                  onChange={(event) =>
                    setColors((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="w-10 h-10 cursor-pointer rounded border border-border bg-surface"
                />
                {field.label}
              </label>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              setColors({
                dayColor: null,
                nightColor: null,
                handColor: null,
                secondColor: null,
                eventColor: null,
              })
            }
          >
            Reset to theme colors
          </Button>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text mb-2">Location</legend>
          <p className="text-xs text-text-muted">
            Used for daylight shading and optional weather. Type coordinates or let your browser
            fill them in.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={locating}
            onClick={useCurrentLocation}
          >
            {locating ? 'Finding location…' : 'Use current location'}
          </Button>
          <p className="text-xs text-text-muted">
            Asks for browser permission only when clicked (HTTPS or localhost). Fills these fields;
            save or copy the URL to use them.
          </p>
          {locationError && (
            <p role="alert" className="text-sm text-danger">
              {locationError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              aria-label="Latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              placeholder="40.7128"
              value={latitude}
              onChange={(event) => editCoordinate(setLatitude, event.target.value)}
            />
            <Input
              label="Longitude"
              aria-label="Longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              placeholder="-74.0060"
              value={longitude}
              onChange={(event) => editCoordinate(setLongitude, event.target.value)}
            />
          </div>
          <p className="text-sm text-text-muted">
            North / east are positive; south / west are negative. Leave both blank to show only the
            clock without solar shading or weather. Solar calculation runs locally; enabling weather
            sends these coordinates to Open-Meteo.
          </p>
          <p className="text-sm text-text-muted">
            Times use this device’s timezone, not a timezone inferred from the coordinates. Set the
            display’s timezone to the location you want to show.
          </p>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text mb-2">
            Calendar events (optional)
          </legend>
          <Input
            label="Calendar relay URL"
            aria-label="Calendar relay URL"
            value={calendarRelay}
            onChange={(event) => setCalendarRelay(event.target.value)}
            placeholder="http://home-relay.local:5111"
          />
          <p className="text-xs text-text-muted">
            Enter your local home-relay address; no read key or Google sign-in is needed here. Leave
            blank to turn calendars off. Your dashboard must remain running and sharing calendars.
            Anyone on the relay's network can read this feed.
          </p>
          <label className="block text-sm text-text-secondary">
            Event marks
            <select
              value={eventStyle}
              onChange={(event) => setEventStyle(event.target.value as ClockSettings['eventStyle'])}
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
            >
              <option value="band">Duration bands</option>
              <option value="dot">Dots at start times</option>
              <option value="none">Hidden</option>
            </select>
          </label>
          <label className="block text-sm text-text-secondary">
            Event placement
            <select
              value={eventPlacement}
              onChange={(event) =>
                setEventPlacement(event.target.value as ClockSettings['eventPlacement'])
              }
              className="mt-1 w-full rounded-lg border border-border bg-surface-raised p-2 text-text"
            >
              <option value="outside">
                {mode === 'circle' ? 'Outside the circle' : 'Near bottom of clock'}
              </option>
              <option value="inside">
                {mode === 'circle' ? 'Inside the circle' : 'Near top of clock'}
              </option>
            </select>
          </label>
          <div className="flex flex-col gap-3">
            <Toggle
              checked={showCalendarLegend}
              onChange={setShowCalendarLegend}
              label="Calendar color legend"
            />
            <Toggle
              checked={showEventNames}
              onChange={setShowEventNames}
              label="Event names on marks"
            />
            <Toggle
              checked={showEventList}
              onChange={setShowEventList}
              label="Today's events list"
            />
            <Toggle
              checked={showCalendarStatus}
              onChange={setShowCalendarStatus}
              label="Calendar connection / stale-data status"
            />
            <Toggle
              checked={!calendarFilter}
              onChange={(all) => {
                setCalendarFilter(!all);
                if (!all) setCalendarIds(calendars.map((calendar) => calendar.id).join(', '));
              }}
              label="All shared calendars"
            />
            {calendars.map((calendar) => (
              <Toggle
                key={calendar.id}
                label={calendar.name}
                checked={
                  !calendarFilter ||
                  calendarIds
                    .split(',')
                    .map((id) => id.trim())
                    .includes(calendar.id)
                }
                onChange={(checked) => {
                  const selected = new Set(
                    calendarFilter
                      ? calendarIds
                          .split(',')
                          .map((id) => id.trim())
                          .filter(Boolean)
                      : calendars.map((item) => item.id),
                  );
                  if (checked) selected.add(calendar.id);
                  else selected.delete(calendar.id);
                  setCalendarFilter(true);
                  setCalendarIds([...selected].join(', '));
                }}
              />
            ))}
            {!calendars.length && (
              <p className="text-xs text-text-muted">
                Calendar checkboxes appear after saving a working relay connection. You can also
                enter IDs directly below.
              </p>
            )}
          </div>
          <details className="space-y-3">
            <summary className="cursor-pointer text-sm text-text-secondary">
              Advanced calendar options
            </summary>
            <Input
              label="Included calendar IDs (comma-separated; used when All shared calendars is off)"
              value={calendarIds}
              onChange={(event) => setCalendarIds(event.target.value)}
            />
            <Input
              label="Calendar refresh (seconds)"
              type="number"
              min={30}
              max={3600}
              step={1}
              value={calendarPollSeconds}
              onChange={(event) => setCalendarPollSeconds(event.target.value)}
            />
            <p className="text-sm text-text-muted">
              Overlaps stack into up to five lanes. All-day events use a full ring/line, even in dot
              mode. Leave the event color at its default to use each Google calendar’s color.
            </p>
          </details>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-text mb-2">Kiosk link</legend>
          <Toggle checked={kioskUrl} onChange={setKioskUrl} label="Hide controls in copied URL" />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const draft = draftSettings();
              if (!draft) return;
              const url = displayUrl(window.location.href, draft, draftDark, kioskUrl);
              setGeneratedUrl(url);
              await copy(url);
            }}
          >
            {copied ? 'Copied!' : 'Copy display URL'}
          </Button>
          <p className="text-sm text-text-muted">
            Includes the current form values and theme, even before saving. Launch Chromium with
            --kiosk and this URL for browser fullscreen; the URL alone cannot trigger browser
            fullscreen.
          </p>
          {generatedUrl && (
            <label className="block text-sm text-text-secondary">
              Display URL (also available to copy manually)
              <textarea
                readOnly
                value={generatedUrl}
                onFocus={(event) => event.target.select()}
                className="mt-2 w-full rounded-lg border border-border bg-surface-sunken p-2 text-xs text-text"
                rows={4}
              />
            </label>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save settings</Button>
        </div>
      </form>
    </Modal>
  );
}
