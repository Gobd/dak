import { registerWidget } from '../../script.js';

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

function renderUVChart(container, uvData, dark, safeThreshold = 4) {
  if (!uvData || !uvData.hourly) {
    renderError(container, 'No UV data', dark);
    return;
  }

  const darkClass = dark ? 'dark' : '';
  const now = new Date();
  const times = uvData.hourly.time;
  const uvValues = uvData.hourly.uv_index;

  // Filter to peak UV hours (8am - 8pm) for today and tomorrow
  const todayHours = [];
  const tomorrowHours = [];

  for (let i = 0; i < times.length; i++) {
    const time = new Date(times[i]);
    const hour = time.getHours();
    if (hour >= 8 && hour <= 20) {
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

  const currentUV = todayHours.find((h) => !h.isPast)?.uv || tomorrowHours[0]?.uv || 0;
  const todayMax = todayHours.length ? Math.max(...todayHours.map((h) => h.uv)) : 0;
  const tomorrowMax = tomorrowHours.length ? Math.max(...tomorrowHours.map((h) => h.uv)) : 0;

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

  const modalContent = `
    <div class="uv-modal-content">
      <h3>UV Index Widget</h3>
      <p><strong>Current UV:</strong> The current UV index with color and label (Low, Moderate, High, Very High, Extreme).</p>
      <p><strong>Today/Tomorrow:</strong> Peak UV values for each day.</p>
      <p><strong>☀️ Times:</strong> When UV rises above and falls below your safe threshold (${safeThreshold}). Shows the window when sun protection is needed.</p>
      <p><strong>Bar Chart:</strong> Hourly UV from 8am-8pm. Time shown above the peak hour. Faded bars are past hours.</p>
      <h4>UV Scale</h4>
      <ul>
        <li><span style="color: #4ade80">0-2 Low</span> - Safe for most people</li>
        <li><span style="color: #facc15">3-5 Moderate</span> - Seek shade midday</li>
        <li><span style="color: #f97316">6-7 High</span> - Protection needed</li>
        <li><span style="color: #ef4444">8-10 Very High</span> - Extra protection</li>
        <li><span style="color: #a855f7">11+ Extreme</span> - Avoid sun exposure</li>
      </ul>
      <p><strong>Safe threshold:</strong> ${safeThreshold} (your configured limit)</p>
    </div>
  `;

  container.innerHTML = `
    <div class="uv-widget ${darkClass}">
      <button class="widget-info-btn" aria-label="Widget info">i</button>
      <div class="widget-modal" style="display: none;">
        <div class="widget-modal-backdrop"></div>
        <div class="widget-modal-dialog">
          ${modalContent}
          <button class="widget-modal-close">Close</button>
        </div>
      </div>
      <div class="uv-header">
        <span class="uv-now" style="color: ${getUVColor(currentUV)}">UV ${currentUV.toFixed(0)} ${getUVLabel(currentUV)}</span>
        ${crossingText}
        ${todayHours.length ? `<span class="uv-day-label">Today <b style="color: ${getUVColor(todayMax)}">${todayMax.toFixed(0)}</b></span>` : ''}
        ${tomorrowHours.length ? `<span class="uv-day-label">Tomorrow <b style="color: ${getUVColor(tomorrowMax)}">${tomorrowMax.toFixed(0)}</b></span>` : ''}
      </div>
      <div class="uv-days">
        ${renderDayBars(todayHours)}
        ${renderDayBars(tomorrowHours)}
      </div>
    </div>
  `;

  // Set up modal interactions
  const widget = container.querySelector('.uv-widget');
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
    <div class="uv-widget uv-error ${darkClass}">
      <div class="error-message">${message}</div>
    </div>
  `;
}

function renderLoading(container, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="uv-widget uv-loading ${darkClass}">
      <div class="loading-message">Loading UV...</div>
    </div>
  `;
}

function renderUVWidget(container, panel, { refreshIntervals, parseDuration, dark = true }) {
  const lat = panel.args?.lat || '40.7608';
  const lon = panel.args?.lon || '-111.8910';
  const safeThreshold = panel.args?.safeThreshold ?? 4;

  renderLoading(container, dark);

  async function loadUV() {
    const uvData = await fetchUVIndex(lat, lon);
    if (uvData) {
      renderUVChart(container, uvData, dark, safeThreshold);
    } else {
      renderError(container, 'Failed to load UV', dark);
    }
  }

  loadUV();

  const refreshMs = parseDuration(panel.refresh);
  if (refreshMs) {
    const intervalId = setInterval(loadUV, refreshMs);
    refreshIntervals.push(intervalId);
  }
}

registerWidget('uv', renderUVWidget);
