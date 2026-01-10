import { registerWidget } from '../../script.js';

// Drive Time Widget - Floating overlay showing commute time
// Uses Cloudflare Functions to proxy Google Distance Matrix & Places APIs
// Routes configured in screens.js, addresses in localStorage for privacy

const CACHE_KEY = 'drive-time-cache';
const DISMISSED_KEY = 'drive-time-dismissed';
const LOCATIONS_KEY = 'drive-time-locations';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// API endpoints (Cloudflare Functions)
const API_BASE = '/api/maps';

// Day name to number mapping (0 = Sunday)
const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

// Location address book stored in localStorage
function getLocations() {
  try {
    return JSON.parse(localStorage.getItem(LOCATIONS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveLocations(locations) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function parseDurationToMinutes(durationStr) {
  if (!durationStr) return 0;
  let totalMinutes = 0;
  const hourMatch = durationStr.match(/(\d+)\s*h/i);
  const minMatch = durationStr.match(/(\d+)\s*m/i);
  if (hourMatch) totalMinutes += parseInt(hourMatch[1], 10) * 60;
  if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
  return totalMinutes;
}

function isInTimeWindow(days, startTime, endTime) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const activeDays = days.map((d) => DAY_MAP[d.toLowerCase()]);
  if (!activeDays.includes(currentDay)) return false;

  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function isDismissedToday(routeId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
    const today = new Date().toDateString();
    return dismissed[routeId] === today;
  } catch {
    return false;
  }
}

function dismissForToday(routeId) {
  try {
    const dismissed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
    dismissed[routeId] = new Date().toDateString();
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
  } catch {
    // Ignore storage errors
  }
}

function getActiveRoute(routes) {
  for (const route of routes) {
    if (isInTimeWindow(route.days || [], route.startTime || '0:00', route.endTime || '23:59')) {
      return route;
    }
  }
  return null;
}

function getRouteId(route) {
  return `${route.origin}-${route.destination}`;
}

function getCachedDriveTime(origin, destination) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = `${origin}|${destination}`;
    const entry = cache[key];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
      return entry.data;
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheDriveTime(origin, destination, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[`${origin}|${destination}`] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

async function fetchDriveTime(origin, destination) {
  const cached = getCachedDriveTime(origin, destination);
  if (cached) return cached;

  try {
    const response = await fetch(`${API_BASE}/distance-matrix`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Distance Matrix error:', error);
      return null;
    }

    const result = await response.json();
    cacheDriveTime(origin, destination, result);
    return result;
  } catch (err) {
    console.error('Drive time fetch error:', err);
    return null;
  }
}

async function fetchPlacesAutocomplete(input) {
  if (!input || input.length < 3) return [];

  try {
    const params = new URLSearchParams({ input });
    const response = await fetch(`${API_BASE}/places-autocomplete?${params}`);

    if (!response.ok) return [];

    const data = await response.json();
    return data.predictions || [];
  } catch {
    return [];
  }
}

function getTrafficColor(durationMinutes, normalMinutes) {
  const ratio = durationMinutes / normalMinutes;
  if (ratio <= 1.1) return '#4ade80';
  if (ratio <= 1.3) return '#facc15';
  if (ratio <= 1.5) return '#f97316';
  return '#ef4444';
}

function renderOverlay(container, driveData, route, dark, onDismiss, onEdit) {
  const darkClass = dark ? 'dark' : '';
  const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
  const normalMinutes = Math.round(driveData.durationValue / 60);
  const trafficColor = getTrafficColor(durationMinutes, normalMinutes);

  const delayMinutes = durationMinutes - normalMinutes;
  const multiplier = durationMinutes / normalMinutes;
  const delayText = delayMinutes > 0 ? `+${delayMinutes} min` : 'No delay';

  let severityClass = '';
  let warningText = '';
  if (multiplier >= 2.5) {
    severityClass = 'danger';
    warningText = `⚠️ ${multiplier.toFixed(1)}x normal - Consider staying home!`;
  } else if (multiplier >= 1.8) {
    severityClass = 'danger';
    warningText = `⚠️ ${multiplier.toFixed(1)}x normal - Heavy traffic`;
  } else if (multiplier >= 1.4) {
    severityClass = 'warning';
    warningText = `${multiplier.toFixed(1)}x normal - Moderate delays`;
  }

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} ${severityClass}">
      <button class="drive-time-close" title="Dismiss for today">&times;</button>
      <div class="drive-time-content">
        <div class="drive-time-icon">🚗</div>
        <div class="drive-time-info">
          <div class="drive-time-duration" style="color: ${trafficColor}">${driveData.durationInTraffic}</div>
          <div class="drive-time-detail">${driveData.distance} • ${delayText}</div>
          ${warningText ? `<div class="drive-time-${severityClass}-text">${warningText}</div>` : ''}
          ${route.label ? `<div class="drive-time-label">${route.label}</div>` : ''}
        </div>
      </div>
    </div>
  `;

  container.querySelector('.drive-time-close').addEventListener('click', (e) => {
    e.stopPropagation();
    onDismiss();
  });

  container.querySelector('.drive-time-content').addEventListener('click', onEdit);
}

function renderError(container, message, dark, onClose) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} error">
      <button class="drive-time-close" title="Dismiss">&times;</button>
      <div class="drive-time-content">
        <div class="drive-time-icon">🚗</div>
        <div class="drive-time-info">
          <div class="drive-time-error">${message}</div>
        </div>
      </div>
    </div>
  `;

  container.querySelector('.drive-time-close').addEventListener('click', () => {
    if (onClose) onClose();
    else container.innerHTML = '';
  });
}

function renderLoading(container, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass}">
      <div class="drive-time-content">
        <div class="drive-time-icon">🚗</div>
        <div class="drive-time-info">
          <div class="drive-time-loading">Checking traffic...</div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsIcon(container, dark, onEdit) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="drive-time-settings-icon ${darkClass}" title="Edit drive time settings">
      ⚙️
    </div>
  `;
  container.querySelector('.drive-time-settings-icon').addEventListener('click', onEdit);
}

// Custom autocomplete dropdown for address inputs
function setupAddressAutocomplete(input) {
  let dropdown = null;
  let debounceTimer = null;

  function createDropdown() {
    if (dropdown) return dropdown;
    dropdown = document.createElement('div');
    dropdown.className = 'dt-autocomplete-dropdown';
    input.parentNode.style.position = 'relative';
    input.parentNode.appendChild(dropdown);
    return dropdown;
  }

  function hideDropdown() {
    if (dropdown) {
      dropdown.innerHTML = '';
      dropdown.style.display = 'none';
    }
  }

  function showPredictions(predictions) {
    const dd = createDropdown();
    if (predictions.length === 0) {
      hideDropdown();
      return;
    }

    dd.innerHTML = predictions
      .map(
        (p) => `
      <div class="dt-autocomplete-item" data-description="${p.description}">
        ${p.description}
      </div>
    `
      )
      .join('');
    dd.style.display = 'block';

    dd.querySelectorAll('.dt-autocomplete-item').forEach((item) => {
      item.addEventListener('click', () => {
        input.value = item.dataset.description;
        hideDropdown();
        input.dispatchEvent(new Event('change'));
      });
    });
  }

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const predictions = await fetchPlacesAutocomplete(input.value);
      showPredictions(predictions);
    }, 300);
  });

  input.addEventListener('blur', () => {
    setTimeout(hideDropdown, 200);
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 3) {
      fetchPlacesAutocomplete(input.value).then(showPredictions);
    }
  });
}

function renderLocationManager(container, dark, routes, onDone) {
  const darkClass = dark ? 'dark' : '';
  const locations = getLocations();

  const locationKeys = new Set();
  routes.forEach((r) => {
    if (r.origin) locationKeys.add(r.origin);
    if (r.destination) locationKeys.add(r.destination);
  });

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} setup location-manager">
      <div class="drive-time-setup">
        <div class="drive-time-setup-title">🚗 Manage Locations</div>
        <p class="dt-setup-desc">Enter addresses for each location used in your routes.</p>

        <div class="dt-locations-list">
          ${Array.from(locationKeys)
            .map(
              (key) => `
            <div class="dt-location-item" data-key="${key}">
              <label>
                <span class="dt-location-key">${key}</span>
                <input type="text" class="dt-address-input" data-location="${key}"
                       value="${locations[key] || ''}"
                       placeholder="Start typing address...">
              </label>
            </div>
          `
            )
            .join('')}
        </div>

        <div class="dt-routes-preview">
          <span class="dt-section-label">Configured Routes</span>
          ${routes
            .map(
              (r) => `
            <div class="dt-route-preview">
              <span class="dt-route-path">${r.origin} → ${r.destination}</span>
              <span class="dt-route-schedule">${r.days?.join(', ') || 'daily'} ${r.startTime || ''}–${r.endTime || ''}</span>
              ${r.label ? `<span class="dt-route-label">${r.label}</span>` : ''}
            </div>
          `
            )
            .join('')}
        </div>

        <div class="drive-time-setup-actions">
          <button class="dt-btn dt-save">Save & Close</button>
        </div>
      </div>
    </div>
  `;

  // Setup autocomplete for each address input
  container.querySelectorAll('.dt-address-input').forEach((input) => {
    setupAddressAutocomplete(input);
  });

  container.querySelector('.dt-save').addEventListener('click', () => {
    const newLocations = {};
    container.querySelectorAll('.dt-address-input').forEach((input) => {
      const key = input.dataset.location;
      const value = input.value.trim();
      if (value) {
        newLocations[key] = value;
      }
    });
    saveLocations(newLocations);
    onDone();
  });
}

// Widget render function
function renderDriveTimeWidget(container, panel, { refreshIntervals, dark = true }) {
  const panelDark = panel.args?.dark ?? dark;
  const panelArgs = panel.args || {};
  const routes = panelArgs.routes || [];

  if (routes.length === 0) {
    renderError(container, 'Add routes to screens.js', panelDark);
    return;
  }

  function showLocationManager() {
    renderLocationManager(container, panelDark, routes, () => {
      startWidget();
    });
  }

  function checkLocationsConfigured() {
    const locations = getLocations();
    for (const route of routes) {
      if (!locations[route.origin] || !locations[route.destination]) {
        return false;
      }
    }
    return true;
  }

  function startWidget() {
    async function checkAndRender() {
      const activeRoute = getActiveRoute(routes);

      if (!activeRoute) {
        container.innerHTML = '';
        return;
      }

      const routeId = getRouteId(activeRoute);

      if (isDismissedToday(routeId)) {
        container.innerHTML = '';
        return;
      }

      const locations = getLocations();
      const originAddress = locations[activeRoute.origin];
      const destAddress = locations[activeRoute.destination];

      if (!originAddress || !destAddress) {
        showLocationManager();
        return;
      }

      renderLoading(container, panelDark);

      const driveData = await fetchDriveTime(originAddress, destAddress);

      if (driveData) {
        const minTimeMinutes = parseDurationToMinutes(activeRoute.minTimeToShow);
        const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);

        if (minTimeMinutes > 0 && durationMinutes < minTimeMinutes) {
          renderSettingsIcon(container, panelDark, () => showLocationManager());
          return;
        }

        renderOverlay(
          container,
          driveData,
          activeRoute,
          panelDark,
          () => {
            dismissForToday(routeId);
            container.innerHTML = '';
          },
          () => showLocationManager()
        );
      } else {
        renderError(container, 'Could not get drive time', panelDark, () => {
          dismissForToday(routeId);
          container.innerHTML = '';
        });
      }
    }

    checkAndRender();

    const intervalId = setInterval(checkAndRender, 5 * 60 * 1000);
    refreshIntervals.push(intervalId);

    const windowCheckId = setInterval(() => {
      const activeRoute = getActiveRoute(routes);
      if (!activeRoute) {
        container.innerHTML = '';
      } else if (container.innerHTML === '' && !isDismissedToday(getRouteId(activeRoute))) {
        checkAndRender();
      }
    }, 60 * 1000);
    refreshIntervals.push(windowCheckId);
  }

  if (!checkLocationsConfigured()) {
    showLocationManager();
    return;
  }

  startWidget();
}

registerWidget('drive-time', renderDriveTimeWidget);
