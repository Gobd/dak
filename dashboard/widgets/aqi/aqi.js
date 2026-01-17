import './aqi.css';
import { registerWidget } from '../../widget-registry.js';
import {
  getWidgetLocation,
  saveLocationConfig,
  formatLocation,
  geocodeAddress,
  setupLocationAutocomplete,
} from '../../location.js';

// AQI Widget using Open-Meteo Air Quality API (free, no API key)

const AQI_CACHE_KEY = 'aqi-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchAQI(lat, lon) {
  const cached = getCachedAQI(lat, lon);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,pm2_5,pm10&hourly=us_aqi&timezone=auto&forecast_days=2`
    );
    if (!res.ok) throw new Error('Failed to fetch AQI data');
    const data = await res.json();
    cacheAQI(lat, lon, data);
    return data;
  } catch (err) {
    console.error('AQI fetch error:', err);
    return null;
  }
}

function getCachedAQI(lat, lon) {
  try {
    const cache = JSON.parse(localStorage.getItem(AQI_CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheAQI(lat, lon, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(AQI_CACHE_KEY) || '{}');
    cache[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(AQI_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

function getAQIColor(aqi) {
  if (aqi <= 50) return '#4ade80';
  if (aqi <= 100) return '#facc15';
  if (aqi <= 150) return '#f97316';
  if (aqi <= 200) return '#ef4444';
  if (aqi <= 300) return '#a855f7';
  return '#991b1b';
}

function getAQILabel(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Sensitive';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

function renderAQIChart(container, aqiData, dark, location = null, onSettings = null) {
  if (!aqiData || !aqiData.hourly) {
    renderError(container, 'No AQI data', dark);
    return;
  }

  const darkClass = dark ? 'dark' : '';
  const locationDisplay = location ? formatLocation(location.city, location.state) : '';
  const now = new Date();
  const times = aqiData.hourly.time;
  const aqiValues = aqiData.hourly.us_aqi;

  // Show all 24 hours (every 2 hours) for today and tomorrow
  const todayHours = [];
  const tomorrowHours = [];

  for (let i = 0; i < times.length; i++) {
    const time = new Date(times[i]);
    const hour = time.getHours();
    if (hour % 2 === 0) {
      const isToday = time.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = time.toDateString() === tomorrow.toDateString();

      const entry = { time, hour, aqi: aqiValues[i] || 0, isPast: time < now };

      if (isToday) todayHours.push(entry);
      else if (isTomorrow) tomorrowHours.push(entry);
    }
  }

  if (todayHours.length === 0 && tomorrowHours.length === 0) {
    renderError(container, 'No AQI data', dark);
    return;
  }

  const currentAQI = Math.round(
    aqiData.current?.us_aqi || todayHours.find((h) => !h.isPast)?.aqi || tomorrowHours[0]?.aqi || 0
  );
  const todayMax = Math.round(todayHours.length ? Math.max(...todayHours.map((h) => h.aqi)) : 0);
  const tomorrowMax = Math.round(
    tomorrowHours.length ? Math.max(...tomorrowHours.map((h) => h.aqi)) : 0
  );

  const formatHour = (h) => {
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const suffix = h >= 12 ? 'pm' : 'am';
    return `${hour}${suffix}`;
  };

  const renderDayBars = (hours) => {
    if (hours.length === 0) return '';
    const maxAQI = Math.max(...hours.map((h) => h.aqi));
    const peakIndex = hours.findIndex((h) => h.aqi === maxAQI);

    return `
      <div class="aqi-day-bars">
        ${hours
          .map((h, i) => {
            const height = Math.max((h.aqi / 150) * 100, 4);
            const isPeak = i === peakIndex && maxAQI > 0;
            const label = isPeak ? `<span class="aqi-peak-time">${formatHour(h.hour)}</span>` : '';

            return `<div class="aqi-bar-container ${h.isPast ? 'past' : ''}" title="${h.hour}:00 AQI ${h.aqi}">
            ${label}
            <div class="aqi-bar" style="height: ${Math.min(height, 100)}%; background: ${getAQIColor(h.aqi)}"></div>
          </div>`;
          })
          .join('')}
      </div>
    `;
  };

  container.innerHTML = `
    <div class="aqi-widget ${darkClass}">
      <div class="aqi-header">
        <div class="aqi-location-row">
          <span class="aqi-location">${locationDisplay || 'Set Location'}</span>
          <button class="widget-settings-btn" aria-label="Settings">&#9881;</button>
        </div>
        <span class="aqi-now" style="color: ${getAQIColor(currentAQI)}">AQI ${currentAQI} ${getAQILabel(currentAQI)}</span>
        ${todayHours.length ? `<span class="aqi-day-label">Today <b style="color: ${getAQIColor(todayMax)}">${todayMax}</b></span>` : ''}
        ${tomorrowHours.length ? `<span class="aqi-day-label">Tomorrow <b style="color: ${getAQIColor(tomorrowMax)}">${tomorrowMax}</b></span>` : ''}
      </div>
      <div class="aqi-days">
        ${renderDayBars(todayHours)}
        ${renderDayBars(tomorrowHours)}
      </div>
    </div>
  `;

  // Settings button opens the settings modal
  const widget = container.querySelector('.aqi-widget');
  const settingsBtn = widget.querySelector('.widget-settings-btn');

  if (onSettings && settingsBtn) {
    settingsBtn.addEventListener('click', onSettings);
  }
}

function renderError(container, message, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="aqi-widget aqi-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark, message = 'Loading AQI...') {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="aqi-widget aqi-loading ${darkClass}">
      <div class="loading-message">${message}</div>
    </div>
  `;
}

// Settings modal with location and info
function showSettingsModal(dark, currentLocation, onSave) {
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
        <h3>Air Quality</h3>
      </div>
      <div class="widget-location-modal-body">
        <div class="settings-section">
          <p class="location-help">Location:</p>
          <div class="location-input-wrapper">
            <input type="text" class="location-input" placeholder="e.g., San Francisco, CA" value="${currentQuery}">
          </div>
          ${currentDisplay ? `<p class="location-current">Current: ${currentDisplay}</p>` : ''}
        </div>

        <details class="info-section">
          <summary>About AQI</summary>
          <div class="info-content">
            <p><b>Scale (US EPA):</b>
              <span style="color:#4ade80">0-50 Good</span> ·
              <span style="color:#facc15">51-100 Mod</span> ·
              <span style="color:#f97316">101-150 Sens.</span> ·
              <span style="color:#ef4444">151-200 Unhealthy</span> ·
              <span style="color:#a855f7">201+ V.Unhealthy</span>
            </p>
          </div>
        </details>

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

function renderAQIWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const argsLat = panel.args?.lat;
  const argsLon = panel.args?.lon;
  const widgetId = panel.id || 'aqi';

  renderLoading(container, dark);

  let currentLocation = null;

  async function loadAQI() {
    try {
      currentLocation = await getWidgetLocation(widgetId, argsLat, argsLon);
      const aqiData = await fetchAQI(currentLocation.lat, currentLocation.lon);
      if (aqiData) {
        renderAQIChart(container, aqiData, dark, currentLocation, showSettings);
      } else {
        renderError(container, 'Failed to load AQI', dark);
      }
    } catch (err) {
      console.error('AQI load error:', err);
      renderError(container, 'Failed to load AQI', dark);
    }
  }

  function showSettings() {
    showSettingsModal(dark, currentLocation, async (config) => {
      saveLocationConfig(widgetId, config);
      renderLoading(container, dark, 'Updating...');
      await loadAQI();
    });
  }

  loadAQI();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadAQI, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('aqi', renderAQIWidget);
