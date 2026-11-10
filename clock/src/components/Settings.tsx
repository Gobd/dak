import { useState } from 'react';
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
  onSave: (settings: ClockSettings) => void;
  onClose: () => void;
}) {
  const [latitude, setLatitude] = useState(settings.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(settings.longitude?.toString() ?? '');
  const [mode, setMode] = useState(settings.mode);
  const [hourLabels, setHourLabels] = useState(settings.hourLabels);
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
  const [calendarKey, setCalendarKey] = useState(settings.calendarKey);
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
    if (calendarRelay.trim() && !calendarKey.trim()) {
      setError('Enter the relay’s calendar read key, or clear the relay URL to disable calendars.');
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
      calendarKey,
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
    <Modal open onClose={onClose} title="Clock settings" fit>
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          const draft = draftSettings();
          if (!draft) return;
          onSave(draft);
          onClose();
        }}
      >
        <fieldset>
          <legend className="text-sm text-text-secondary mb-2">Clock shape</legend>
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
            The dial still spans 24 hours. Only its labels change; digital time remains 24-hour.
          </span>
        </label>
        <div className="flex items-center justify-between gap-4">
          <span id="second-hand-label" className="text-text">
            Smooth second hand
          </span>
          <Toggle checked={seconds} onChange={setSeconds} label="Show seconds" />
        </div>
        <p className="text-sm text-text-muted">
          Turn off seconds for the lowest CPU usage. The 24-hour hand still updates each minute.
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
        <fieldset className="space-y-3">
          <legend className="text-sm text-text-secondary mb-2">Colors</legend>
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
          <legend className="text-sm text-text-secondary mb-2">Location</legend>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Latitude"
              type="number"
              min={-90}
              max={90}
              step="any"
              placeholder="40.7128"
              value={latitude}
              onChange={(event) => setLatitude(event.target.value)}
            />
            <Input
              label="Longitude"
              type="number"
              min={-180}
              max={180}
              step="any"
              placeholder="-74.0060"
              value={longitude}
              onChange={(event) => setLongitude(event.target.value)}
            />
          </div>
          <p className="text-sm text-text-muted">
            North / east are positive; south / west are negative. Leave both blank to show only the
            clock. No location permission or network lookup is needed.
          </p>
          <p className="text-sm text-text-muted">
            Times use this device’s timezone, not a timezone inferred from the coordinates. Set the
            display’s timezone to the location you want to show.
          </p>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm text-text-secondary mb-2">Calendar (optional)</legend>
          <Input
            label="Calendar relay URL"
            value={calendarRelay}
            onChange={(event) => setCalendarRelay(event.target.value)}
            placeholder="https://kiosk-relay.bkemper.me"
          />
          <Input
            label="Calendar read key"
            type="password"
            autoComplete="off"
            maxLength={256}
            value={calendarKey}
            onChange={(event) => setCalendarKey(event.target.value)}
          />
          <p className="text-sm text-text-muted">
            Use CALENDAR_READ_KEY, never the publishing key or Google credentials. The copied URL
            contains this read-only key—treat the URL as private. The dashboard must be running and
            sharing visible calendars.
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
              <option value="outside">Outside circle / below rectangle</option>
              <option value="inside">Inside circle / above rectangle</option>
            </select>
          </label>
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
          <Toggle checked={showEventList} onChange={setShowEventList} label="Today's events list" />
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
              Calendar checkboxes appear after saving a working relay connection. You can also enter
              IDs directly below.
            </p>
          )}
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
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="text-sm text-text-secondary mb-2">No-input display setup</legend>
          <Toggle checked={kioskUrl} onChange={setKioskUrl} label="Hide controls in copied URL" />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const draft = draftSettings();
              if (!draft) return;
              const url = displayUrl(window.location.href, draft, dark, kioskUrl);
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
