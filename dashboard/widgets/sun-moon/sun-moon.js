import { registerWidget } from '../../script.js';

// Sun/Moon Widget - Sunrise/sunset, day length, moon phase

const SUN_CACHE_KEY = 'sun-moon-cache-v2';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchSunData(lat, lon) {
  const cached = getCached(lat, lon);
  if (cached) return cached;

  try {
    // Fetch today and yesterday for day length comparison
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Fetch both days in parallel from sunrise-sunset.org
    const [todayRes, yesterdayRes] = await Promise.all([
      fetch(
        `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${todayStr}&formatted=0`
      ),
      fetch(
        `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&date=${yesterdayStr}&formatted=0`
      ),
    ]);

    if (!todayRes.ok || !yesterdayRes.ok) throw new Error('Failed to fetch sun data');

    const todayData = await todayRes.json();
    const yesterdayData = await yesterdayRes.json();

    if (todayData.status !== 'OK' || yesterdayData.status !== 'OK') {
      throw new Error('API returned error status');
    }

    const data = {
      today: todayData.results,
      yesterday: yesterdayData.results,
    };

    cache(lat, lon, data);
    return data;
  } catch (err) {
    console.error('Sun data fetch error:', err);
    return null;
  }
}

function getCached(lat, lon) {
  try {
    const cache = JSON.parse(localStorage.getItem(SUN_CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cache(lat, lon, data) {
  try {
    const c = JSON.parse(localStorage.getItem(SUN_CACHE_KEY) || '{}');
    c[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(SUN_CACHE_KEY, JSON.stringify(c));
  } catch {
    // Ignore cache write errors
  }
}

// Moon phase calculation - based on known new moon and lunar cycle
function getMoonPhase(date = new Date()) {
  // Known new moon: January 6, 2000 at 18:14 UTC
  const knownNewMoon = new Date('2000-01-06T18:14:00Z');
  const lunarCycle = 29.53058867; // days

  const daysSinceNewMoon = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
  const cycleProgress = ((daysSinceNewMoon % lunarCycle) + lunarCycle) % lunarCycle;
  const illumination = cycleProgress / lunarCycle;

  // Days until next full moon (full moon is at 0.5 of cycle)
  let daysToFull;
  if (illumination < 0.5) {
    daysToFull = (0.5 - illumination) * lunarCycle;
  } else {
    daysToFull = (1.5 - illumination) * lunarCycle;
  }

  // Calculate the actual full moon date
  const fullMoonDate = new Date(date);
  fullMoonDate.setDate(fullMoonDate.getDate() + Math.round(daysToFull));

  // Phase name and icon (using sharp Unicode symbols)
  // ○ = new, ◐ = growing half, ● = full, ◑ = shrinking half
  // ◠ ◡ for crescents
  let phase, icon, trend;
  if (illumination < 0.025) {
    phase = 'New';
    icon = '○';
    trend = '';
  } else if (illumination < 0.25) {
    phase = 'Crescent';
    icon = '◐';
    trend = 'Growing';
  } else if (illumination < 0.275) {
    phase = 'Half';
    icon = '◐';
    trend = 'Growing';
  } else if (illumination < 0.475) {
    phase = 'Gibbous';
    icon = '◐';
    trend = 'Growing';
  } else if (illumination < 0.525) {
    phase = 'Full';
    icon = '●';
    trend = '';
  } else if (illumination < 0.75) {
    phase = 'Gibbous';
    icon = '◑';
    trend = 'Shrinking';
  } else if (illumination < 0.775) {
    phase = 'Half';
    icon = '◑';
    trend = 'Shrinking';
  } else if (illumination < 0.975) {
    phase = 'Crescent';
    icon = '◑';
    trend = 'Shrinking';
  } else {
    phase = 'New';
    icon = '○';
    trend = '';
  }

  return {
    phase,
    icon,
    trend,
    daysToFull: Math.round(daysToFull),
    fullMoonDate,
    illuminationPct: Math.round(Math.sin(illumination * Math.PI) * 100),
  };
}

function formatTime(isoString) {
  const date = new Date(isoString);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes.toString().padStart(2, '0')}${ampm}`;
}

function formatShortDate(date) {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDayLength(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function renderWidget(container, sunData, dark) {
  if (!sunData || !sunData.today) {
    renderError(container, 'No sun data', dark);
    return;
  }

  const darkClass = dark ? 'dark' : '';
  const { today, yesterday } = sunData;

  // Day length from API is in seconds
  const todayLength = Math.round(today.day_length / 60);
  const yesterdayLength = Math.round(yesterday.day_length / 60);
  const lengthChange = todayLength - yesterdayLength;

  const moon = getMoonPhase();

  const changeSign = lengthChange >= 0 ? '+' : '';
  const changeClass = lengthChange >= 0 ? 'growing' : 'shrinking';

  container.innerHTML = `
    <div class="sun-moon-widget ${darkClass}">
      <div class="sun-section">
        <div class="sun-times">
          <span class="sun-item"><span class="sun-icon dawn-icon">◐</span> ${formatTime(today.civil_twilight_begin)}</span>
          <span class="sun-item"><span class="sun-icon">↑</span> ${formatTime(today.sunrise)}</span>
          <span class="sun-item"><span class="sun-icon">↓</span> ${formatTime(today.sunset)}</span>
          <span class="sun-item"><span class="sun-icon dusk-icon">◑</span> ${formatTime(today.civil_twilight_end)}</span>
        </div>
        <div class="day-length">
          <span class="length-value">${formatDayLength(todayLength)}</span>
          <span class="length-change ${changeClass}">${changeSign}${lengthChange}m</span>
        </div>
      </div>
      <div class="moon-section">
        <span class="moon-icon">${moon.icon}</span>
        <div class="moon-info">
          <span class="moon-phase">${moon.trend ? moon.trend : moon.phase}</span>
          <span class="moon-full">${moon.daysToFull === 0 ? 'Full tonight' : `Full ${formatShortDate(moon.fullMoonDate)}`}</span>
        </div>
      </div>
    </div>
  `;
}

function renderError(container, message, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="sun-moon-widget sun-moon-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="sun-moon-widget sun-moon-loading ${darkClass}">
      <div class="loading-message">Loading...</div>
    </div>
  `;
}

function renderSunMoonWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const lat = panel.args?.lat || '40.7608';
  const lon = panel.args?.lon || '-111.8910';

  renderLoading(container, dark);

  async function load() {
    const data = await fetchSunData(lat, lon);
    if (data) {
      renderWidget(container, data, dark);
    } else {
      renderError(container, 'Failed to load', dark);
    }
  }

  load();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(load, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('sun-moon', renderSunMoonWidget);
