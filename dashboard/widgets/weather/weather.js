import { registerWidget } from '../../script.js';

// NWS API Weather Widget
// Uses api.weather.gov - free, no auth, CORS-enabled

const CACHE_KEY = 'weather-cache';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Store alerts and periods for click handling
let currentAlerts = [];
let currentPeriods = [];

// =====================
// DATA FETCHING
// =====================

async function fetchForecast(lat, lon) {
  const cached = getCachedForecast(lat, lon);
  if (cached) return cached;

  try {
    const pointRes = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: { 'User-Agent': 'Dashboard (bkemper.me)' },
    });
    if (!pointRes.ok) throw new Error('Failed to get location');
    const point = await pointRes.json();

    const forecastRes = await fetch(point.properties.forecast, {
      headers: { 'User-Agent': 'Dashboard (bkemper.me)' },
    });
    if (!forecastRes.ok) throw new Error('Failed to get forecast');
    const forecast = await forecastRes.json();

    let alerts = [];
    try {
      const alertsRes = await fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, {
        headers: { 'User-Agent': 'Dashboard (bkemper.me)' },
      });
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json();
        alerts = alertsData.features || [];
      }
    } catch (e) {
      console.warn('Failed to fetch alerts:', e);
    }

    const result = { forecast, alerts };
    cacheForecast(lat, lon, result);
    return result;
  } catch (err) {
    console.error('Weather fetch error:', err);
    throw err;
  }
}

// =====================
// CACHING
// =====================

function getCachedForecast(lat, lon) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = cache[`${lat},${lon}`];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) return entry.data;
  } catch {}
  return null;
}

function cacheForecast(lat, lon, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[`${lat},${lon}`] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// =====================
// ALERTS
// =====================

function getAlertSeverityClass(severity) {
  switch (severity?.toLowerCase()) {
    case 'extreme': return 'alert-extreme';
    case 'severe': return 'alert-severe';
    case 'moderate': return 'alert-moderate';
    default: return 'alert-minor';
  }
}

function formatAlertTime(_start, end) {
  const endDate = new Date(end);
  const now = new Date();
  const remaining = endDate - now;
  if (remaining <= 0) return 'Expired';

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  }
  return `${minutes}m remaining`;
}

function showAlertModal(alert) {
  const props = alert.properties;
  const severityClass = getAlertSeverityClass(props.severity);
  const timeRemaining = formatAlertTime(props.onset, props.expires);

  const modal = document.createElement('div');
  modal.className = 'weather-modal open';
  modal.innerHTML = `
    <div class="weather-modal-content">
      <div class="weather-modal-header ${severityClass}">
        <span class="alert-icon">⚠</span>
        <h3>${props.event}</h3>
      </div>
      <div class="weather-modal-body">
        <p class="alert-timing">
          <strong>Expires:</strong> ${new Date(props.expires).toLocaleString()}<br>
          <strong>Time remaining:</strong> ${timeRemaining}
        </p>
        ${props.headline ? `<p class="alert-headline">${props.headline}</p>` : ''}
        ${props.description ? `<p class="alert-description">${props.description}</p>` : ''}
        ${props.instruction ? `<p class="alert-instruction"><strong>Instructions:</strong> ${props.instruction}</p>` : ''}
      </div>
      <div class="weather-modal-actions">
        <button class="weather-modal-close">Close</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('weather-modal-close')) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

function showPeriodModal(period) {
  const modal = document.createElement('div');
  modal.className = 'weather-modal open';
  modal.innerHTML = `
    <div class="weather-modal-content">
      <div class="weather-modal-header period-header">
        <img class="period-modal-icon" src="${period.icon}" alt="${period.shortForecast}">
        <div class="period-modal-title">
          <h3>${period.name}</h3>
          <span class="period-modal-temp ${period.isDaytime ? 'high' : 'low'}">${period.temperature}°${period.temperatureUnit}</span>
        </div>
      </div>
      <div class="weather-modal-body">
        <p class="period-short-forecast">${period.shortForecast}</p>
        ${period.detailedForecast ? `<p class="period-detailed-forecast">${period.detailedForecast}</p>` : ''}
        ${period.windSpeed ? `<p class="period-wind"><strong>Wind:</strong> ${period.windDirection} ${period.windSpeed}</p>` : ''}
      </div>
      <div class="weather-modal-actions">
        <button class="weather-modal-close">Close</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('weather-modal-close')) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

// =====================
// MAIN RENDER
// =====================

function renderForecast(container, data, layout = 'horizontal', dark = true) {
  const { forecast, alerts } = data;
  currentAlerts = alerts;
  const periods = forecast.properties.periods.slice(0, 10); // 5 days
  currentPeriods = periods;
  const darkClass = dark ? 'dark' : '';

  const alertsHtml = alerts.length > 0
    ? `
    <div class="weather-alerts">
      ${alerts.slice(0, 3).map((alert, index) => {
        const props = alert.properties;
        const severityClass = getAlertSeverityClass(props.severity);
        const timeRemaining = formatAlertTime(props.onset, props.expires);
        return `
          <div class="weather-alert ${severityClass}" data-alert-index="${index}">
            <span class="alert-icon">⚠</span>
            <span class="alert-event">${props.event}</span>
            <span class="alert-time">${timeRemaining}</span>
          </div>
        `;
      }).join('')}
      ${alerts.length > 3 ? `<div class="more-alerts">+${alerts.length - 3} more alerts</div>` : ''}
    </div>
  ` : '';

  const layoutClass = layout === 'vertical' ? 'vertical' : '';

  container.innerHTML = `
    <div class="weather-widget ${layoutClass} ${darkClass}">
      ${alertsHtml}
      <div class="weather-periods">
        ${periods.map((period, index) => `
          <div class="weather-period ${index === periods.length - 1 ? 'last-period' : ''}" data-period-index="${index}">
            <div class="period-name">${period.name}</div>
            <img class="period-icon" src="${period.icon}" alt="${period.shortForecast}">
            <div class="period-temp ${period.isDaytime ? 'high' : 'low'}">${period.temperature}°${period.temperatureUnit}</div>
            <div class="period-desc">${period.shortForecast}</div>
            ${index === periods.length - 1 ? '<button class="weather-refresh-btn" title="Reload widget">↻</button>' : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Add click handler for refresh button
  container.querySelector('.weather-refresh-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  // Add click handlers for alerts
  container.querySelectorAll('.weather-alert').forEach((el) => {
    el.addEventListener('click', () => {
      const index = parseInt(el.dataset.alertIndex, 10);
      if (currentAlerts[index]) showAlertModal(currentAlerts[index]);
    });
  });

  // Add click handlers for periods
  container.querySelectorAll('.weather-period').forEach((el) => {
    el.addEventListener('click', () => {
      const index = parseInt(el.dataset.periodIndex, 10);
      if (currentPeriods[index]) showPeriodModal(currentPeriods[index]);
    });
  });
}

function renderError(container, message, dark = true) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="weather-widget weather-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark = true) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="weather-widget weather-loading ${darkClass}">
      <div class="loading-message">Loading forecast...</div>
    </div>
  `;
}

// Widget render function
// Options: args.lat, args.lon, args.layout ('horizontal' or 'vertical')
function renderWeatherWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const lat = panel.args?.lat || '40.7608';
  const lon = panel.args?.lon || '-111.8910';
  const layout = panel.args?.layout || 'horizontal';

  renderLoading(container, dark);

  async function loadForecast() {
    try {
      const data = await fetchForecast(lat, lon);
      renderForecast(container, data, layout, dark);
    } catch {
      renderError(container, 'Failed to load forecast', dark);
    }
  }

  loadForecast();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadForecast, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('weather', renderWeatherWidget);
