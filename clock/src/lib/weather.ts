export interface TodayWeather {
  code: number;
  low: number;
  high: number;
  precipitation: number;
}

export function weatherDate(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function parseWeather(value: unknown, date: string): TodayWeather | null {
  if (!value || typeof value !== 'object' || !('daily' in value)) return null;
  const daily = value.daily as Record<string, unknown> | null;
  if (!daily || !Array.isArray(daily.time)) return null;
  const index = daily.time.indexOf(date);
  if (index < 0) return null;
  const fields = [
    'weather_code',
    'temperature_2m_min',
    'temperature_2m_max',
    'precipitation_probability_max',
  ];
  const values = fields.map((field) => (Array.isArray(daily[field]) ? daily[field][index] : null));
  if (!values.every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
  const [code, low, high, precipitation] = values as number[];
  if (low > high || precipitation < 0 || precipitation > 100) return null;
  return { code, low, high, precipitation };
}

export function weatherCondition(code: number): {
  label: string;
  kind: 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm';
} {
  if (code === 0) return { label: 'Clear', kind: 'sun' };
  if (code === 1 || code === 2) return { label: 'Partly cloudy', kind: 'partly' };
  if (code === 3) return { label: 'Overcast', kind: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', kind: 'fog' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Snow', kind: 'snow' };
  if ([95, 96, 99].includes(code)) return { label: 'Thunderstorms', kind: 'storm' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: 'Rain', kind: 'rain' };
  return { label: 'Weather', kind: 'cloud' };
}
