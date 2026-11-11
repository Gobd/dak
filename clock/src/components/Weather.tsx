import { useEffect, useState } from 'react';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Snowflake,
  Sun,
} from 'lucide-react';
import { useInterval } from '@dak/hooks';
import type { ClockSettings } from '../lib/settings';
import { parseWeather, weatherCondition, weatherDate, type TodayWeather } from '../lib/weather';

const icons = {
  sun: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export default function Weather({
  settings,
  now,
  visible,
}: {
  settings: ClockSettings;
  now: Date;
  visible: boolean;
}) {
  const [forecast, setForecast] = useState<{ today: TodayWeather; tomorrow: TodayWeather } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const date = weatherDate(now);
  const tomorrow = weatherDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { latitude, longitude, weatherUnit } = settings;
  useInterval(() => setRefresh((value) => value + 1), visible ? 30 * 60000 : null);

  useEffect(() => {
    setForecast(null);
    setError(false);
  }, [date, latitude, longitude, weatherUnit, timezone]);

  useEffect(() => {
    if (!visible || latitude === null || longitude === null) return;
    const controller = new AbortController();
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      temperature_unit: weatherUnit,
      timezone,
      start_date: date,
      end_date: tomorrow,
    }).toString();
    void (async () => {
      try {
        const response = await fetch(url, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        });
        if (!response.ok) throw new Error('Weather unavailable');
        const data: unknown = await response.json();
        const todayForecast = parseWeather(data, date);
        const tomorrowForecast = parseWeather(data, tomorrow);
        if (!todayForecast || !tomorrowForecast) throw new Error('Invalid forecast');
        const next = { today: todayForecast, tomorrow: tomorrowForecast };
        if (!controller.signal.aborted) {
          setForecast(next);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [date, tomorrow, latitude, longitude, weatherUnit, timezone, visible, refresh]);

  if (latitude === null || longitude === null)
    return (
      <div className="clock-weather text-xs" role="status">
        Set coordinates for weather
      </div>
    );
  if (!forecast)
    return (
      <div className="clock-weather text-xs" role="status">
        {error ? 'Weather unavailable' : 'Loading weather…'}
      </div>
    );
  return (
    <div className="clock-weather-group">
      {settings.showWeather && (
        <WeatherDay forecast={forecast.today} label="Today" unit={weatherUnit} error={error} />
      )}
      {settings.showTomorrowWeather && (
        <WeatherDay
          forecast={forecast.tomorrow}
          label="Tomorrow"
          unit={weatherUnit}
          error={error}
        />
      )}
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
        className="text-text-muted text-xs"
        aria-label="Weather data by Open-Meteo"
      >
        Open-Meteo
      </a>
    </div>
  );
}

function WeatherDay({
  forecast,
  label,
  unit: temperatureUnit,
  error,
}: {
  forecast: TodayWeather;
  label: string;
  unit: ClockSettings['weatherUnit'];
  error: boolean;
}) {
  const condition = weatherCondition(forecast.code);
  const Icon = icons[condition.kind];
  const PrecipitationIcon = condition.kind === 'snow' ? Snowflake : Droplets;
  const unit = temperatureUnit === 'celsius' ? 'C' : 'F';
  return (
    <div
      className="clock-weather"
      aria-label={`${label}'s weather: ${condition.label}, low ${Math.round(forecast.low)} degrees ${unit}, high ${Math.round(forecast.high)} degrees ${unit}, ${forecast.precipitation}% chance of precipitation${error ? ', update unavailable' : ''}`}
    >
      <Icon className="w-6 h-6 shrink-0" aria-hidden="true" />
      <span>
        {label} <span className="text-text-secondary">{condition.label}</span>
      </span>
      <span className="tabular-nums whitespace-nowrap">
        L {Math.round(forecast.low)}° / H {Math.round(forecast.high)}°{unit}
      </span>
      <span
        className="inline-flex items-center gap-1 tabular-nums"
        title="Chance of rain or snow (any precipitation)"
      >
        <PrecipitationIcon className="w-4 h-4" aria-hidden="true" />
        {forecast.precipitation}%
      </span>
      {error && <span className="text-xs text-text-muted">Update unavailable</span>}
    </div>
  );
}
