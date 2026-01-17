import { registerWidget } from '../../script.js';
import { getSunTimes, getMoonTimes, getMoonIllumination } from './suncalc3-2.0.5.js';
import {
  getWidgetLocation,
  saveLocationConfig,
  formatLocation,
  geocodeAddress,
  setupLocationAutocomplete,
} from '../../location.js';

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

function formatShortDate(date, includeDay = false) {
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
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
  return includeDay ? `${days[date.getDay()]} ${dateStr}` : dateStr;
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

function renderWidget(container, lat, lon, dark, location = null, onSettings = null) {
  const darkClass = dark ? 'dark' : '';
  const locationDisplay = location ? formatLocation(location.city, location.state) : '';

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
      <div class="sun-moon-header">
        <span class="sun-moon-location">${locationDisplay || 'Set Location'}</span>
        <button class="widget-settings-btn" title="Change location">&#9881;</button>
      </div>
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
          <span class="moon-full">${daysToFull === 0 ? 'Full tonight' : `Full ${formatShortDate(moon.nextFullMoon, true)}`}</span>
        </div>
      </div>
    </div>
  `;

  // Add settings button handler
  if (onSettings) {
    container.querySelector('.widget-settings-btn')?.addEventListener('click', onSettings);
  }
}

function renderError(container, message, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="sun-moon-widget sun-moon-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark, message = 'Loading...') {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="sun-moon-widget sun-moon-loading ${darkClass}">
      <div class="loading-message">${message}</div>
    </div>
  `;
}

// Location settings modal
function showLocationSettingsModal(dark, currentLocation, onSave) {
  const darkClass = dark ? 'dark' : '';
  const currentQuery = currentLocation?.query || '';
  const currentDisplay = currentLocation
    ? formatLocation(currentLocation.city, currentLocation.state)
    : '';

  const modal = document.createElement('div');
  modal.className = `widget-location-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="widget-location-modal-content">
      <div class="widget-location-modal-header">
        <h3>Set Location</h3>
      </div>
      <div class="widget-location-modal-body">
        <p class="location-help">Enter a city, state, or ZIP code:</p>
        <div class="location-input-wrapper">
          <input type="text" class="location-input" placeholder="e.g., San Francisco, CA" value="${currentQuery}">
        </div>
        ${currentDisplay ? `<p class="location-current">Current: ${currentDisplay}</p>` : ''}
        <p class="location-status"></p>
      </div>
      <div class="widget-location-modal-actions">
        <button class="modal-cancel">Cancel</button>
        <button class="modal-save">Save</button>
      </div>
    </div>
  `;

  const input = modal.querySelector('.location-input');
  const statusEl = modal.querySelector('.location-status');
  const saveBtn = modal.querySelector('.modal-save');

  // Store place details when autocomplete is selected
  let selectedPlace = null;

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-cancel')) {
      modal.remove();
    }
  });

  saveBtn.addEventListener('click', async () => {
    const query = input.value.trim();
    if (!query) {
      statusEl.textContent = 'Please enter a location';
      statusEl.className = 'location-status error';
      return;
    }

    // Use place details if available (from autocomplete), otherwise geocode
    if (selectedPlace && selectedPlace.lat && selectedPlace.lon) {
      onSave({
        lat: selectedPlace.lat,
        lon: selectedPlace.lon,
        city: selectedPlace.city,
        state: selectedPlace.state,
        query,
      });
      modal.remove();
      return;
    }

    statusEl.textContent = 'Looking up location...';
    statusEl.className = 'location-status';
    saveBtn.disabled = true;

    const geo = await geocodeAddress(query);
    if (geo) {
      onSave({ lat: geo.lat, lon: geo.lon, city: geo.city, state: geo.state, query });
      modal.remove();
    } else {
      statusEl.textContent = 'Could not find that location.';
      statusEl.className = 'location-status error';
      saveBtn.disabled = false;
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  document.body.appendChild(modal);
  input.focus();
  input.select();

  // Setup Google Places autocomplete
  setupLocationAutocomplete(input, ({ city, state, lat, lon }) => {
    if (city && state) {
      input.value = `${city}, ${state}`;
      selectedPlace = { city, state, lat, lon };
    }
  });
}

function renderSunMoonWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const argsLat = panel.args?.lat;
  const argsLon = panel.args?.lon;
  const widgetId = panel.id || 'sun-moon';

  let currentLocation = null;

  async function loadWidget() {
    try {
      currentLocation = await getWidgetLocation(widgetId, argsLat, argsLon);
      renderWidget(
        container,
        currentLocation.lat,
        currentLocation.lon,
        dark,
        currentLocation,
        showSettings
      );
    } catch (err) {
      console.error('Sun/moon load error:', err);
      renderError(container, 'Failed to load', dark);
    }
  }

  function showSettings() {
    showLocationSettingsModal(dark, currentLocation, async (config) => {
      saveLocationConfig(widgetId, config);
      renderLoading(container, dark, 'Updating location...');
      await loadWidget();
    });
  }

  // Initial render
  loadWidget();

  // Refresh periodically (recalculates, no network needed)
  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadWidget, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('sun-moon', renderSunMoonWidget);
