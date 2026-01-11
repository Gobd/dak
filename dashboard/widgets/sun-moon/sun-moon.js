import { registerWidget } from '../../script.js';
import { getSunTimes, getMoonTimes, getMoonIllumination } from './suncalc3-2.0.5.js';

// Sun/Moon Widget - All calculations done locally via suncalc3
// No external API needed!

function formatTime(date) {
  if (!date || isNaN(date)) return '--';
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

function getSunMoonData(lat, lon, date = new Date()) {
  const latNum = parseFloat(lat);
  const lonNum = parseFloat(lon);

  // Get sun times for today and yesterday (for day length comparison)
  const sunToday = getSunTimes(date, latNum, lonNum);
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const sunYesterday = getSunTimes(yesterday, latNum, lonNum);

  // Calculate day lengths in minutes
  const todayLength = Math.round((sunToday.sunsetEnd.ts - sunToday.sunriseStart.ts) / (1000 * 60));
  const yesterdayLength = Math.round(
    (sunYesterday.sunsetEnd.ts - sunYesterday.sunriseStart.ts) / (1000 * 60)
  );

  // Get moon times
  const moonTimes = getMoonTimes(date, latNum, lonNum);

  // Get moon illumination and phase
  const moonIllum = getMoonIllumination(date);

  return {
    sun: {
      dawn: sunToday.civilDawn?.value,
      sunrise: sunToday.sunriseStart?.value,
      sunset: sunToday.sunsetEnd?.value,
      dusk: sunToday.civilDusk?.value,
      dayLength: todayLength,
      dayLengthChange: todayLength - yesterdayLength,
    },
    moon: {
      rise: moonTimes.rise,
      set: moonTimes.set,
      phase: moonIllum.phase,
      fraction: moonIllum.fraction,
      phaseValue: moonIllum.phaseValue,
      nextFullMoon: new Date(moonIllum.next.fullMoon.value),
    },
  };
}

function getPhaseDisplay(phase, phaseValue) {
  // Map suncalc3 phase names to our simple names
  const id = phase?.id || '';
  let name = phase?.name || '';
  let icon = '○';
  let trend = '';

  if (id.includes('new')) {
    icon = '○';
    name = 'New';
  } else if (id.includes('full')) {
    icon = '●';
    name = 'Full';
  } else if (id.includes('first') || id.includes('third')) {
    icon = phaseValue < 0.5 ? '◐' : '◑';
    name = 'Half';
    trend = phaseValue < 0.5 ? 'Growing' : 'Shrinking';
  } else if (id.includes('waxing')) {
    icon = '◐';
    trend = 'Growing';
    name = id.includes('Crescent') ? 'Crescent' : 'Gibbous';
  } else if (id.includes('waning')) {
    icon = '◑';
    trend = 'Shrinking';
    name = id.includes('Crescent') ? 'Crescent' : 'Gibbous';
  }

  return { icon, name, trend };
}

function renderWidget(container, lat, lon, dark) {
  const darkClass = dark ? 'dark' : '';

  let data;
  try {
    data = getSunMoonData(lat, lon);
  } catch (err) {
    console.error('Sun/moon calculation error:', err);
    renderError(container, 'Calculation error', dark);
    return;
  }

  const { sun, moon } = data;
  const changeSign = sun.dayLengthChange >= 0 ? '+' : '';
  const changeClass = sun.dayLengthChange >= 0 ? 'growing' : 'shrinking';

  const phaseDisplay = getPhaseDisplay(moon.phase, moon.phaseValue);
  const daysToFull = Math.round((moon.nextFullMoon.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  container.innerHTML = `
    <div class="sun-moon-widget ${darkClass}">
      <div class="times-section">
        <div class="times-column sun-column">
          <div class="times-row">
            <span class="time-label">Dawn</span>
            <span class="time-value dawn">${formatTime(sun.dawn)}</span>
          </div>
          <div class="times-row">
            <span class="time-label">Sunrise</span>
            <span class="time-value sun">${formatTime(sun.sunrise)}</span>
          </div>
          <div class="times-row">
            <span class="time-label">Sunset</span>
            <span class="time-value sun">${formatTime(sun.sunset)}</span>
          </div>
          <div class="times-row">
            <span class="time-label">Dusk</span>
            <span class="time-value dusk">${formatTime(sun.dusk)}</span>
          </div>
        </div>
        <div class="times-column moon-column">
          <div class="times-row">
            <span class="time-label">Moonrise</span>
            <span class="time-value moon">${formatTime(moon.rise)}</span>
          </div>
          <div class="times-row">
            <span class="time-label">Moonset</span>
            <span class="time-value moon">${formatTime(moon.set)}</span>
          </div>
        </div>
      </div>
      <div class="info-section">
        <div class="day-length">
          <span class="length-label">Day</span>
          <span class="length-value">${formatDayLength(sun.dayLength)}</span>
          <span class="length-change ${changeClass}">${changeSign}${sun.dayLengthChange}m</span>
        </div>
        <div class="moon-phase-info">
          <span class="moon-icon">${phaseDisplay.icon}</span>
          <span class="moon-phase">${phaseDisplay.trend ? `${phaseDisplay.trend} ${phaseDisplay.name}` : phaseDisplay.name}</span>
          <span class="moon-full">${daysToFull === 0 ? 'Full tonight' : `Full ${formatShortDate(moon.nextFullMoon)}`}</span>
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

function renderSunMoonWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const lat = panel.args?.lat || '40.7608';
  const lon = panel.args?.lon || '-111.8910';

  // Initial render - no loading needed since it's all local calculation
  renderWidget(container, lat, lon, dark);

  // Refresh periodically (recalculates, no network needed)
  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(() => {
      renderWidget(container, lat, lon, dark);
    }, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('sun-moon', renderSunMoonWidget);
