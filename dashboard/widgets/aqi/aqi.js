import { registerWidget } from '../../script.js';

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

function renderAQIChart(container, aqiData, dark) {
  if (!aqiData || !aqiData.hourly) {
    renderError(container, 'No AQI data', dark);
    return;
  }

  const darkClass = dark ? 'dark' : '';
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

  const modalContent = `
    <div class="aqi-modal-content">
      <h3>Air Quality Index Widget</h3>
      <p><strong>Current AQI:</strong> The current US AQI value with color and label.</p>
      <p><strong>Today/Tomorrow:</strong> Peak AQI values for each day.</p>
      <p><strong>Bar Chart:</strong> AQI readings every 2 hours for 24 hours. Time shown above the peak hour. Faded bars are past hours.</p>
      <h4>AQI Scale (US EPA)</h4>
      <ul>
        <li><span style="color: #4ade80">0-50 Good</span> - Air quality is satisfactory</li>
        <li><span style="color: #facc15">51-100 Moderate</span> - Acceptable; sensitive groups may be affected</li>
        <li><span style="color: #f97316">101-150 Sensitive</span> - Unhealthy for sensitive groups</li>
        <li><span style="color: #ef4444">151-200 Unhealthy</span> - Everyone may experience effects</li>
        <li><span style="color: #a855f7">201-300 Very Unhealthy</span> - Health alert; everyone affected</li>
        <li><span style="color: #991b1b">301+ Hazardous</span> - Emergency conditions</li>
      </ul>
      <p><strong>Data source:</strong> Open-Meteo Air Quality API</p>
    </div>
  `;

  container.innerHTML = `
    <div class="aqi-widget ${darkClass}">
      <button class="widget-info-btn" aria-label="Widget info">i</button>
      <div class="widget-modal" style="display: none;">
        <div class="widget-modal-backdrop"></div>
        <div class="widget-modal-dialog">
          ${modalContent}
          <button class="widget-modal-close">Close</button>
        </div>
      </div>
      <div class="aqi-header">
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

  // Set up modal interactions
  const widget = container.querySelector('.aqi-widget');
  const infoBtn = widget.querySelector('.widget-info-btn');
  const modal = widget.querySelector('.widget-modal');
  const backdrop = widget.querySelector('.widget-modal-backdrop');
  const closeBtn = widget.querySelector('.widget-modal-close');

  const openModal = () => (modal.style.display = 'flex');
  const closeModal = () => (modal.style.display = 'none');

  infoBtn.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
}

function renderError(container, message, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="aqi-widget aqi-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="aqi-widget aqi-loading ${darkClass}">
      <div class="loading-message">Loading AQI...</div>
    </div>
  `;
}

function renderAQIWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const lat = panel.args?.lat || '40.7608';
  const lon = panel.args?.lon || '-111.8910';

  renderLoading(container, dark);

  async function loadAQI() {
    const aqiData = await fetchAQI(lat, lon);
    if (aqiData) {
      renderAQIChart(container, aqiData, dark);
    } else {
      renderError(container, 'Failed to load AQI', dark);
    }
  }

  loadAQI();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadAQI, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('aqi', renderAQIWidget);
