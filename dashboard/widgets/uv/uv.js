import './uv.css';
import { registerWidget } from '../../widget-registry.js';
import {
  getWidgetLocation,
  saveLocationConfig,
  formatLocation,
  geocodeAddress,
  setupLocationAutocomplete,
} from '../../location.js';

// UV Index Widget using Open-Meteo (free, no API key)

const UV_CACHE_KEY = 'uv-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function fetchUVIndex(lat, lon) {
  const cached = getCachedUV(lat, lon);
  if (cached) return cached;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=uv_index&timezone=auto&forecast_days=2`
    );
    if (!res.ok) throw new Error('Failed to fetch UV data');
    const data = await res.json();
    cacheUV(lat, lon, data);
    return data;
  } catch (err) {
    console.error('UV fetch error:', err);
    return null;
  }
}

function getCachedUV(lat, lon) {
  try {
    const cache = JSON.parse(localStorage.getItem(UV_CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheUV(lat, lon, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(UV_CACHE_KEY) || '{}');
    cache[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(UV_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

function getUVColor(uv) {
  if (uv < 3) return '#4ade80';
  if (uv < 6) return '#facc15';
  if (uv < 8) return '#f97316';
  if (uv < 11) return '#ef4444';
  return '#a855f7';
}

function getUVLabel(uv) {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

function renderUVChart(
  container,
  uvData,
  dark,
  safeThreshold = 4,
  location = null,
  onSettings = null
) {
  if (!uvData || !uvData.hourly) {
    renderError(container, 'No UV data', dark);
    return;
  }

  const darkClass = dark ? 'dark' : '';
  const locationDisplay = location ? formatLocation(location.city, location.state) : '';
  const now = new Date();
  const times = uvData.hourly.time;
  const uvValues = uvData.hourly.uv_index;

  // Filter to peak UV hours (6am - 8pm, every 2 hours) for today and tomorrow
  const todayHours = [];
  const tomorrowHours = [];

  for (let i = 0; i < times.length; i++) {
    const time = new Date(times[i]);
    const hour = time.getHours();
    // Every 2 hours during daylight (6, 8, 10, 12, 14, 16, 18, 20)
    if (hour >= 6 && hour <= 20 && hour % 2 === 0) {
      const isToday = time.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = time.toDateString() === tomorrow.toDateString();

      const entry = { time, hour, uv: uvValues[i] || 0, isPast: time < now };

      if (isToday) todayHours.push(entry);
      else if (isTomorrow) tomorrowHours.push(entry);
    }
  }

  if (todayHours.length === 0 && tomorrowHours.length === 0) {
    renderError(container, 'No UV data', dark);
    return;
  }

  const currentUV = Math.round(todayHours.find((h) => !h.isPast)?.uv || tomorrowHours[0]?.uv || 0);
  const todayMax = Math.round(todayHours.length ? Math.max(...todayHours.map((h) => h.uv)) : 0);
  const tomorrowMax = Math.round(
    tomorrowHours.length ? Math.max(...tomorrowHours.map((h) => h.uv)) : 0
  );

  const formatHour = (h) => {
    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const suffix = h >= 12 ? 'pm' : 'am';
    return `${hour}${suffix}`;
  };

  // Find when UV crosses the safe threshold (for future hours only)
  const findThresholdCrossings = (hours) => {
    const futureHours = hours.filter((h) => !h.isPast);
    if (futureHours.length < 2) return { riseTime: null, fallTime: null };

    let riseTime = null;
    let fallTime = null;

    for (let i = 1; i < futureHours.length; i++) {
      const prev = futureHours[i - 1];
      const curr = futureHours[i];

      // Crossing above threshold
      if (!riseTime && prev.uv < safeThreshold && curr.uv >= safeThreshold) {
        riseTime = curr.hour;
      }
      // Crossing below threshold (after rising)
      if (riseTime && !fallTime && prev.uv >= safeThreshold && curr.uv < safeThreshold) {
        fallTime = curr.hour;
      }
    }

    // Check if we start above threshold
    if (!riseTime && futureHours[0]?.uv >= safeThreshold) {
      riseTime = futureHours[0].hour;
    }

    return { riseTime, fallTime };
  };

  const todayCrossings = findThresholdCrossings(todayHours);

  const renderDayBars = (hours) => {
    if (hours.length === 0) return '';
    const maxUV = Math.max(...hours.map((h) => h.uv));
    const peakIndex = hours.findIndex((h) => h.uv === maxUV);

    return `
      <div class="uv-day-bars">
        ${hours
          .map((h, i) => {
            const height = Math.max((h.uv / 11) * 100, 4);
            const isPeak = i === peakIndex && maxUV > 0;
            const label = isPeak ? `<span class="uv-peak-time">${formatHour(h.hour)}</span>` : '';

            return `<div class="uv-bar-container ${h.isPast ? 'past' : ''}" title="${h.hour}:00 UV ${h.uv.toFixed(1)}">
            ${label}
            <div class="uv-bar" style="height: ${height}%; background: ${getUVColor(h.uv)}"></div>
          </div>`;
          })
          .join('')}
      </div>
    `;
  };

  // Build threshold crossing text
  let crossingText = '';
  if (todayCrossings.riseTime !== null && todayCrossings.fallTime !== null) {
    crossingText = `<span class="uv-crossing">☀️ ${formatHour(todayCrossings.riseTime)}–${formatHour(todayCrossings.fallTime)}</span>`;
  } else if (todayCrossings.riseTime !== null) {
    crossingText = `<span class="uv-crossing">☀️ ${formatHour(todayCrossings.riseTime)}+</span>`;
  }

  container.innerHTML = `
    <div class="uv-widget ${darkClass}">
      <div class="uv-header">
        <div class="uv-location-row">
          <span class="uv-location">${locationDisplay || 'Set Location'}</span>
          <button class="widget-settings-btn" aria-label="Settings">&#9881;</button>
        </div>
        <span class="uv-now" style="color: ${getUVColor(currentUV)}">UV ${currentUV} ${getUVLabel(currentUV)}</span>
        ${crossingText}
        ${todayHours.length ? `<span class="uv-day-label">Today <b style="color: ${getUVColor(todayMax)}">${todayMax}</b></span>` : ''}
        ${tomorrowHours.length ? `<span class="uv-day-label">Tomorrow <b style="color: ${getUVColor(tomorrowMax)}">${tomorrowMax}</b></span>` : ''}
      </div>
      <div class="uv-days">
        ${renderDayBars(todayHours)}
        ${renderDayBars(tomorrowHours)}
      </div>
    </div>
  `;

  // Settings button opens the settings modal
  const widget = container.querySelector('.uv-widget');
  const settingsBtn = widget.querySelector('.widget-settings-btn');

  if (onSettings && settingsBtn) {
    settingsBtn.addEventListener('click', onSettings);
  }
}

function renderError(container, message, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="uv-widget uv-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark, message = 'Loading UV...') {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="uv-widget uv-loading ${darkClass}">
      <div class="loading-message">${message}</div>
    </div>
  `;
}

// Settings modal with location, threshold, and info
function showSettingsModal(dark, currentLocation, currentThreshold, onSave) {
  const darkClass = dark ? 'dark' : '';
  const currentQuery = currentLocation?.query || '';
  const currentDisplay = currentLocation
    ? formatLocation(currentLocation.city, currentLocation.state)
    : '';

  const modal = document.createElement('div');
  modal.className = `widget-location-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="widget-location-modal-content uv-settings-modal">
      <div class="widget-location-modal-header">
        <h3>UV Index</h3>
      </div>
      <div class="widget-location-modal-body">
        <div class="settings-section">
          <p class="location-help">Location:</p>
          <div class="location-input-wrapper">
            <input type="text" class="location-input" placeholder="e.g., San Francisco, CA" value="${currentQuery}">
          </div>
          ${currentDisplay ? `<p class="location-current">Current: ${currentDisplay}</p>` : ''}
        </div>

        <div class="settings-section">
          <p class="location-help">Safe UV threshold:</p>
          <div class="threshold-input-wrapper">
            <input type="range" class="threshold-slider" min="1" max="10" value="${currentThreshold}">
            <span class="threshold-value">${currentThreshold}</span>
          </div>
          <p class="threshold-hint">Times above UV ${currentThreshold} highlighted</p>
        </div>

        <details class="info-section">
          <summary>About UV Index</summary>
          <div class="info-content">
            <p><b>☀️ Times:</b> When UV exceeds your threshold</p>
            <p><b>Scale:</b>
              <span style="color:#4ade80">0-2 Low</span> ·
              <span style="color:#facc15">3-5 Mod</span> ·
              <span style="color:#f97316">6-7 High</span> ·
              <span style="color:#ef4444">8-10 V.High</span> ·
              <span style="color:#a855f7">11+ Extreme</span>
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
  const slider = modal.querySelector('.threshold-slider');
  const thresholdValueEl = modal.querySelector('.threshold-value');
  const thresholdHintEl = modal.querySelector('.threshold-hint');
  const statusEl = modal.querySelector('.location-status');
  const saveBtn = modal.querySelector('.modal-save');

  // Store place details when autocomplete is selected
  let selectedPlace = null;

  // Update threshold display as slider moves
  slider.addEventListener('input', () => {
    thresholdValueEl.textContent = slider.value;
    thresholdHintEl.textContent = `UV ${slider.value}+ shown as warning window`;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('modal-cancel')) {
      modal.remove();
    }
  });

  saveBtn.addEventListener('click', async () => {
    const query = input.value.trim();
    const threshold = parseInt(slider.value, 10);

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
        safeThreshold: threshold,
      });
      modal.remove();
      return;
    }

    statusEl.textContent = 'Looking up location...';
    statusEl.className = 'location-status';
    saveBtn.disabled = true;

    const geo = await geocodeAddress(query);
    if (geo) {
      onSave({
        lat: geo.lat,
        lon: geo.lon,
        city: geo.city,
        state: geo.state,
        query,
        safeThreshold: threshold,
      });
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

function renderUVWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const argsLat = panel.args?.lat;
  const argsLon = panel.args?.lon;
  const defaultThreshold = panel.args?.safeThreshold ?? 4;
  const widgetId = panel.id || 'uv';

  renderLoading(container, dark);

  let currentLocation = null;
  let currentThreshold = defaultThreshold;

  async function loadUV() {
    try {
      currentLocation = await getWidgetLocation(widgetId, argsLat, argsLon);
      // Get threshold from stored config, fallback to default
      currentThreshold = currentLocation.safeThreshold ?? defaultThreshold;
      const uvData = await fetchUVIndex(currentLocation.lat, currentLocation.lon);
      if (uvData) {
        renderUVChart(container, uvData, dark, currentThreshold, currentLocation, openSettings);
      } else {
        renderError(container, 'Failed to load UV', dark);
      }
    } catch (err) {
      console.error('UV load error:', err);
      renderError(container, 'Failed to load UV', dark);
    }
  }

  function openSettings() {
    showSettingsModal(dark, currentLocation, currentThreshold, async (config) => {
      saveLocationConfig(widgetId, config);
      renderLoading(container, dark, 'Updating...');
      await loadUV();
    });
  }

  loadUV();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadUV, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('uv', renderUVWidget);
