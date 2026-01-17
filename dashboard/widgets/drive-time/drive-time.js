import { registerWidget } from '../../script.js';

// Drive Time Widget - Floating overlay showing commute time
// Uses Cloudflare Functions to proxy Google Distance Matrix & Places APIs
// Routes and addresses stored in localStorage, configured via UI

const CACHE_KEY = 'drive-time-cache';
const DISMISSED_KEY = 'drive-time-dismissed';
const LOCATIONS_KEY = 'drive-time-locations';
const ROUTES_KEY = 'drive-time-routes';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// API endpoints (Cloudflare Functions)
// Use production URL when running locally since CF Functions aren't available
const isLocalDev =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE = isLocalDev ? 'https://dak.bkemper.me/api/maps' : '/api/maps';

// Day name to number mapping (0 = Sunday)
const DAY_MAP = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

// Routes stored in localStorage
function getStoredRoutes() {
  try {
    return JSON.parse(localStorage.getItem(ROUTES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRoutes(routes) {
  localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
}

function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

function formatTime12h(time24) {
  const { hours, minutes } = parseTime(time24);
  const h = hours % 12 || 12;
  const ampm = hours < 12 ? 'AM' : 'PM';
  return `${h}:${String(minutes).padStart(2, '0')} ${ampm}`;
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

function getActiveRoutes(routes) {
  return routes.filter((route) =>
    isInTimeWindow(route.days || [], route.startTime || '0:00', route.endTime || '23:59')
  );
}

function getRouteId(route) {
  return `${route.origin}-${route.destination}`;
}

function getCachedDriveTime(origin, destination, via = []) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const key = `${origin}|${destination}|${via.join(',')}`;
    const entry = cache[key];
    if (entry && Date.now() - entry.timestamp < CACHE_DURATION) {
      return entry.data;
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

function cacheDriveTime(origin, destination, via, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[`${origin}|${destination}|${via.join(',')}`] = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

async function fetchDriveTime(origin, destination, via = []) {
  const cached = getCachedDriveTime(origin, destination, via);
  if (cached) return cached;

  try {
    // Use Directions API when via is specified, otherwise Distance Matrix
    const endpoint = via.length ? `${API_BASE}/directions` : `${API_BASE}/distance-matrix`;
    const body = via.length ? { origin, destination, via } : { origin, destination };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Drive time error:', error);
      return null;
    }

    const result = await response.json();
    cacheDriveTime(origin, destination, via, result);
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

async function fetchRouteAlternatives(origin, destination) {
  try {
    const response = await fetch(`${API_BASE}/alternatives`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Route alternatives error:', error);
      return null;
    }

    const data = await response.json();
    return data.routes || [];
  } catch (err) {
    console.error('Route alternatives fetch error:', err);
    return null;
  }
}

async function fetchMapEmbedUrl(origin, destination, via = []) {
  try {
    const response = await fetch(`${API_BASE}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, via }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.embedUrl;
  } catch {
    return null;
  }
}

function getTrafficColor(durationMinutes, normalMinutes) {
  const ratio = durationMinutes / normalMinutes;
  if (ratio <= 1.1) return '#4ade80';
  if (ratio <= 1.3) return '#facc15';
  if (ratio <= 1.5) return '#f97316';
  return '#ef4444';
}

// Detect if Google returned a different route than expected (e.g., road closure)
function detectRouteMismatch(route, driveData) {
  if (!route.viaLabel || !driveData.summary) return false;
  // Normalize and compare - if Google's summary doesn't contain our expected route, it's a mismatch
  const expected = route.viaLabel.toLowerCase().replace(/[^a-z0-9]/g, '');
  const actual = driveData.summary.toLowerCase().replace(/[^a-z0-9]/g, '');
  return !actual.includes(expected) && !expected.includes(actual);
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
    warningText = `${multiplier.toFixed(1)}x normal - Consider staying home!`;
  } else if (multiplier >= 1.8) {
    severityClass = 'danger';
    warningText = `${multiplier.toFixed(1)}x normal - Heavy traffic`;
  } else if (multiplier >= 1.4) {
    severityClass = 'warning';
    warningText = `${multiplier.toFixed(1)}x normal - Moderate delays`;
  }

  // Detect if Google used a different route than expected
  const routeMismatch = detectRouteMismatch(route, driveData);
  const mismatchWarning = routeMismatch
    ? `Your usual route (${route.viaLabel}) may be blocked - using ${driveData.summary}`
    : '';

  // Show route summary from Directions API (e.g., "via Highland Dr") to confirm via worked
  const routeSummary = driveData.summary ? `via ${driveData.summary}` : '';

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} ${severityClass}">
      <button class="drive-time-close" title="Dismiss for today">&times;</button>
      <button class="drive-time-config" title="Configure routes">&#9881;</button>
      <div class="drive-time-content">
        <div class="drive-time-info">
          <div class="drive-time-duration" style="color: ${trafficColor}">${driveData.durationInTraffic}</div>
          <div class="drive-time-detail">${delayText}</div>
          ${warningText ? `<div class="drive-time-${severityClass}-text">${warningText}</div>` : ''}
          ${mismatchWarning ? `<div class="drive-time-route-blocked">${mismatchWarning}</div>` : ''}
          ${route.label ? `<div class="drive-time-label">${route.label}</div>` : ''}
          ${routeSummary && !routeMismatch ? `<div class="drive-time-summary">${routeSummary}</div>` : ''}
        </div>
      </div>
    </div>
  `;

  container.querySelector('.drive-time-close').addEventListener('click', (e) => {
    e.stopPropagation();
    onDismiss();
  });

  container.querySelector('.drive-time-config').addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit();
  });
}

// Render multiple routes in a combined overlay
function renderMultiRouteOverlay(container, routeDataList, dark, onDismissAll, onEdit) {
  const darkClass = dark ? 'dark' : '';

  // Determine worst severity across all routes
  let worstSeverity = '';
  for (const { driveData } of routeDataList) {
    const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
    const normalMinutes = Math.round(driveData.durationValue / 60);
    const multiplier = durationMinutes / normalMinutes;
    if (multiplier >= 1.8 && worstSeverity !== 'danger') {
      worstSeverity = 'danger';
    } else if (multiplier >= 1.4 && worstSeverity === '') {
      worstSeverity = 'warning';
    }
  }

  const routeItems = routeDataList
    .map(({ route, driveData }) => {
      const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
      const normalMinutes = Math.round(driveData.durationValue / 60);
      const trafficColor = getTrafficColor(durationMinutes, normalMinutes);
      const delayMinutes = durationMinutes - normalMinutes;
      const delayText = delayMinutes > 0 ? `+${delayMinutes}` : '';
      const label = route.label || `${route.origin} → ${route.destination}`;
      const routeSummary = driveData.summary || '';
      const mismatch = detectRouteMismatch(route, driveData);

      return `
        <div class="drive-time-route-row${mismatch ? ' route-blocked' : ''}">
          <div class="drive-time-route-info">
            <span class="drive-time-route-label">${label}</span>
            ${mismatch ? `<span class="drive-time-route-blocked-hint">Route blocked - using ${routeSummary}</span>` : routeSummary ? `<span class="drive-time-route-summary">via ${routeSummary}</span>` : ''}
          </div>
          <span class="drive-time-route-time" style="color: ${trafficColor}">${driveData.durationInTraffic}</span>
          ${delayText ? `<span class="drive-time-route-delay">${delayText}</span>` : ''}
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} ${worstSeverity} multi-route">
      <button class="drive-time-close" title="Dismiss for today">&times;</button>
      <button class="drive-time-config" title="Configure routes">&#9881;</button>
      <div class="drive-time-content">
        <div class="drive-time-info drive-time-multi">
          ${routeItems}
        </div>
      </div>
    </div>
  `;

  container.querySelector('.drive-time-close').addEventListener('click', (e) => {
    e.stopPropagation();
    onDismissAll();
  });

  container.querySelector('.drive-time-config').addEventListener('click', (e) => {
    e.stopPropagation();
    onEdit();
  });
}

function renderLoading(container, dark) {
  const darkClass = dark ? 'dark' : '';
  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass}">
      <div class="drive-time-content">
        <div class="drive-time-info">
          <div class="drive-time-loading">Checking traffic...</div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsIcon(container, dark, onEdit, routeInfo = null) {
  const darkClass = dark ? 'dark' : '';
  const routes = routeInfo || {
    total: getStoredRoutes().length,
    active: getActiveRoutes(getStoredRoutes()).length,
  };
  const hasActive = routes.active > 0;
  const countClass = hasActive ? 'has-active' : '';
  const countDisplay =
    routes.total > 0
      ? `<span class="route-count ${countClass}">${routes.active}/${routes.total}</span>`
      : '';
  const tooltip =
    routes.total > 0
      ? `${routes.active} active of ${routes.total} route${routes.total !== 1 ? 's' : ''} configured`
      : 'Configure drive time routes';
  container.innerHTML = `
    <div class="drive-time-settings-icon ${darkClass}" title="${tooltip}">
      &#128663;${countDisplay}
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

// Time picker component - uses native time input for touch-friendly experience
function createTimePicker(container, initialTime, onChange) {
  // Ensure proper format for time input (HH:MM)
  const { hours, minutes } = parseTime(initialTime || '7:00');
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

  container.innerHTML = `
    <input type="time" class="dt-time-input" value="${formattedTime}">
  `;

  const input = container.querySelector('.dt-time-input');
  input.addEventListener('change', () => {
    onChange(input.value);
  });

  return { getValue: () => input.value };
}

// Minute roller for minTimeToShow - swipeable wheel picker
function createMinuteRoller(container, initialMinutes, onChange) {
  const values = Array.from({ length: 61 }, (_, i) => i); // 0-60 in 1 min increments
  let selectedIndex = values.indexOf(initialMinutes) >= 0 ? values.indexOf(initialMinutes) : 0;

  container.innerHTML = `
    <div class="dt-wheel-picker">
      <div class="dt-wheel-mask"></div>
      <div class="dt-wheel-highlight"></div>
      <div class="dt-wheel-scroll">
        ${values.map((v, i) => `<div class="dt-wheel-item" data-index="${i}">${v}</div>`).join('')}
      </div>
      <div class="dt-wheel-label">min</div>
    </div>
  `;

  const scrollContainer = container.querySelector('.dt-wheel-scroll');
  const itemHeight = 40;

  function scrollToIndex(index, smooth = true) {
    selectedIndex = Math.max(0, Math.min(values.length - 1, index));
    const scrollTop = selectedIndex * itemHeight;
    scrollContainer.scrollTo({
      top: scrollTop,
      behavior: smooth ? 'smooth' : 'auto',
    });
  }

  // Initial scroll position
  setTimeout(() => scrollToIndex(selectedIndex, false), 0);

  // Handle scroll end to snap to nearest value
  let scrollTimeout;
  scrollContainer.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const newIndex = Math.round(scrollContainer.scrollTop / itemHeight);
      if (newIndex !== selectedIndex) {
        selectedIndex = Math.max(0, Math.min(values.length - 1, newIndex));
        onChange(values[selectedIndex]);
      }
      scrollToIndex(selectedIndex);
    }, 100);
  });

  // Allow clicking items to select
  scrollContainer.querySelectorAll('.dt-wheel-item').forEach((item) => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index, 10);
      scrollToIndex(index);
      onChange(values[index]);
    });
  });

  return { getValue: () => values[selectedIndex] };
}

// Route form for add/edit
function renderRouteForm(container, dark, existingRoute, onSave, onCancel) {
  const darkClass = dark ? 'dark' : '';
  const locations = getLocations();
  const locationKeys = Object.keys(locations);

  const route = existingRoute || {
    origin: '',
    destination: '',
    via: '',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    startTime: '6:00',
    endTime: '8:00',
    label: '',
    minTimeToShow: 0,
  };

  const isEdit = !!existingRoute;

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} setup route-form">
      <div class="drive-time-setup">
        <div class="drive-time-setup-title">${isEdit ? 'Edit Route' : 'Add Route'}</div>

        <div class="dt-form-section">
          <span class="dt-section-label">Origin</span>
          <div class="dt-location-select-wrap">
            <select class="dt-location-select dt-origin-select">
              <option value="">Select location...</option>
              ${locationKeys.map((k) => `<option value="${k}" ${route.origin === k ? 'selected' : ''}>${k}</option>`).join('')}
              <option value="__new__">+ Add new location...</option>
            </select>
            <div class="dt-new-location dt-new-origin" style="display: none;">
              <input type="text" class="dt-new-location-name" placeholder="Location name (e.g. home)">
              <div class="dt-address-wrap">
                <input type="text" class="dt-new-location-address dt-address-input" placeholder="Address...">
              </div>
            </div>
          </div>
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Destination</span>
          <div class="dt-location-select-wrap">
            <select class="dt-location-select dt-dest-select">
              <option value="">Select location...</option>
              ${locationKeys.map((k) => `<option value="${k}" ${route.destination === k ? 'selected' : ''}>${k}</option>`).join('')}
              <option value="__new__">+ Add new location...</option>
            </select>
            <div class="dt-new-location dt-new-dest" style="display: none;">
              <input type="text" class="dt-new-location-name" placeholder="Location name (e.g. work)">
              <div class="dt-address-wrap">
                <input type="text" class="dt-new-location-address dt-address-input" placeholder="Address...">
              </div>
            </div>
          </div>
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Preferred Route (optional)</span>
          <p class="dt-field-hint">Skip this to use Google's fastest route, or pick your usual route to see its traffic</p>
          <div class="dt-route-choice">
            <span class="dt-selected-route">${route.viaLabel ? `via ${route.viaLabel}` : route.via?.length ? `${route.via.length} waypoints locked` : 'Using fastest route'}</span>
            <button type="button" class="dt-btn dt-choose-route">Choose Route</button>
            ${route.via?.length ? '<button type="button" class="dt-btn dt-preview-selected">Preview</button>' : ''}
            ${route.via?.length ? '<button type="button" class="dt-btn dt-clear-route">Clear</button>' : ''}
          </div>
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Days</span>
          <div class="dt-day-selector">
            ${DAY_NAMES.map((d, i) => `<button class="dt-day-btn ${route.days.includes(d) ? 'active' : ''}" data-day="${d}">${DAY_LABELS[i]}</button>`).join('')}
          </div>
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Time Window</span>
          <div class="dt-time-pickers">
            <div class="dt-start-time-picker"></div>
            <span class="dt-time-to">to</span>
            <div class="dt-end-time-picker"></div>
          </div>
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Label (optional)</span>
          <input type="text" class="dt-label-input" value="${route.label || ''}" placeholder="e.g. Dad to Office">
        </div>

        <div class="dt-form-section">
          <span class="dt-section-label">Only show if drive time exceeds</span>
          <div class="dt-min-time-roller"></div>
        </div>

        <div class="drive-time-setup-actions">
          <button class="dt-btn dt-cancel">Cancel</button>
          <button class="dt-btn dt-preview">Preview Route</button>
          <button class="dt-btn dt-save">Save</button>
        </div>
      </div>
    </div>
  `;

  // Setup time pickers
  let startTime = route.startTime;
  let endTime = route.endTime;
  createTimePicker(container.querySelector('.dt-start-time-picker'), route.startTime, (val) => {
    startTime = val;
  });
  createTimePicker(container.querySelector('.dt-end-time-picker'), route.endTime, (val) => {
    endTime = val;
  });

  // Setup min time roller
  let minTime = route.minTimeToShow || 0;
  createMinuteRoller(container.querySelector('.dt-min-time-roller'), minTime, (val) => {
    minTime = val;
  });

  // Setup day selector
  const selectedDays = new Set(route.days);
  container.querySelectorAll('.dt-day-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const day = btn.dataset.day;
      if (selectedDays.has(day)) {
        selectedDays.delete(day);
        btn.classList.remove('active');
      } else {
        selectedDays.add(day);
        btn.classList.add('active');
      }
    });
  });

  // Setup location selects
  function setupLocationSelect(selectClass, newLocationClass) {
    const select = container.querySelector(selectClass);
    const newLocationDiv = container.querySelector(newLocationClass);

    select.addEventListener('change', () => {
      if (select.value === '__new__') {
        newLocationDiv.style.display = 'flex';
        const addressInput = newLocationDiv.querySelector('.dt-address-input');
        setupAddressAutocomplete(addressInput);
      } else {
        newLocationDiv.style.display = 'none';
      }
    });
  }

  setupLocationSelect('.dt-origin-select', '.dt-new-origin');
  setupLocationSelect('.dt-dest-select', '.dt-new-dest');

  // Track selected via points (coords) and label (for display)
  let selectedVia = route.via || [];
  let selectedViaLabel = route.viaLabel || '';

  // Helper to get display text for via
  function getViaDisplayText() {
    if (selectedViaLabel) return `via ${selectedViaLabel}`;
    if (selectedVia.length === 0) return 'Using fastest route';
    return `${selectedVia.length} waypoints locked`;
  }

  // Update the route choice display
  function updateRouteDisplay() {
    const routeChoice = container.querySelector('.dt-route-choice');
    routeChoice.innerHTML = `
      <span class="dt-selected-route">${getViaDisplayText()}</span>
      <button type="button" class="dt-btn dt-choose-route">Choose Route</button>
      ${selectedVia.length ? '<button type="button" class="dt-btn dt-preview-selected">Preview</button>' : ''}
      ${selectedVia.length ? '<button type="button" class="dt-btn dt-clear-route">Clear</button>' : ''}
    `;

    // Re-attach event listeners
    routeChoice.querySelector('.dt-choose-route').addEventListener('click', handleChooseRoute);

    const previewBtn = routeChoice.querySelector('.dt-preview-selected');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        const originSelect = container.querySelector('.dt-origin-select');
        const destSelect = container.querySelector('.dt-dest-select');
        const currentLocations = getLocations();

        let originAddress = '';
        let destAddress = '';

        if (originSelect.value === '__new__') {
          originAddress = container
            .querySelector('.dt-new-origin .dt-new-location-address')
            .value.trim();
        } else if (originSelect.value) {
          originAddress = currentLocations[originSelect.value];
        }

        if (destSelect.value === '__new__') {
          destAddress = container
            .querySelector('.dt-new-dest .dt-new-location-address')
            .value.trim();
        } else if (destSelect.value) {
          destAddress = currentLocations[destSelect.value];
        }

        if (originAddress && destAddress) {
          showMapPreviewModal(container, dark, originAddress, destAddress, selectedVia);
        }
      });
    }

    const clearBtn = routeChoice.querySelector('.dt-clear-route');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        selectedVia = [];
        selectedViaLabel = '';
        updateRouteDisplay();
      });
    }
  }

  // Handle choose route button
  function handleChooseRoute() {
    const originSelect = container.querySelector('.dt-origin-select');
    const destSelect = container.querySelector('.dt-dest-select');
    const currentLocations = getLocations();

    let originAddress = '';
    let destAddress = '';

    if (originSelect.value === '__new__') {
      originAddress = container
        .querySelector('.dt-new-origin .dt-new-location-address')
        .value.trim();
    } else if (originSelect.value) {
      originAddress = currentLocations[originSelect.value];
    }

    if (destSelect.value === '__new__') {
      destAddress = container.querySelector('.dt-new-dest .dt-new-location-address').value.trim();
    } else if (destSelect.value) {
      destAddress = currentLocations[destSelect.value];
    }

    if (!originAddress || !destAddress) {
      showAlertModal(container, dark, 'Please select origin and destination first.');
      return;
    }

    showRoutePickerModal(container, dark, originAddress, destAddress, (waypointCoords, summary) => {
      // Store coords for API routing, summary for display
      selectedVia = waypointCoords;
      selectedViaLabel = summary || '';
      updateRouteDisplay();
    });
  }

  // Initial event listeners for route choice buttons
  container.querySelector('.dt-choose-route').addEventListener('click', handleChooseRoute);

  const initialPreviewBtn = container.querySelector('.dt-preview-selected');
  if (initialPreviewBtn) {
    initialPreviewBtn.addEventListener('click', () => {
      const originSelect = container.querySelector('.dt-origin-select');
      const destSelect = container.querySelector('.dt-dest-select');
      const currentLocations = getLocations();

      let originAddress = '';
      let destAddress = '';

      if (originSelect.value === '__new__') {
        originAddress = container
          .querySelector('.dt-new-origin .dt-new-location-address')
          .value.trim();
      } else if (originSelect.value) {
        originAddress = currentLocations[originSelect.value];
      }

      if (destSelect.value === '__new__') {
        destAddress = container.querySelector('.dt-new-dest .dt-new-location-address').value.trim();
      } else if (destSelect.value) {
        destAddress = currentLocations[destSelect.value];
      }

      if (originAddress && destAddress) {
        showMapPreviewModal(container, dark, originAddress, destAddress, selectedVia);
      }
    });
  }

  const clearBtn = container.querySelector('.dt-clear-route');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      selectedVia = [];
      updateRouteDisplay();
    });
  }

  // Cancel button
  container.querySelector('.dt-cancel').addEventListener('click', onCancel);

  // Preview button - shows map with current route
  container.querySelector('.dt-preview').addEventListener('click', () => {
    const originSelect = container.querySelector('.dt-origin-select');
    const destSelect = container.querySelector('.dt-dest-select');
    const currentLocations = getLocations();

    let originAddress = '';
    let destAddress = '';

    // Get origin address
    if (originSelect.value === '__new__') {
      originAddress = container
        .querySelector('.dt-new-origin .dt-new-location-address')
        .value.trim();
    } else if (originSelect.value) {
      originAddress = currentLocations[originSelect.value];
    }

    // Get destination address
    if (destSelect.value === '__new__') {
      destAddress = container.querySelector('.dt-new-dest .dt-new-location-address').value.trim();
    } else if (destSelect.value) {
      destAddress = currentLocations[destSelect.value];
    }

    if (!originAddress || !destAddress) {
      showAlertModal(
        container,
        dark,
        'Please select or enter both origin and destination to preview the route.'
      );
      return;
    }

    showMapPreviewModal(container, dark, originAddress, destAddress, selectedVia);
  });

  // Save button
  container.querySelector('.dt-save').addEventListener('click', () => {
    const originSelect = container.querySelector('.dt-origin-select');
    const destSelect = container.querySelector('.dt-dest-select');
    const currentLocations = getLocations();

    let origin = originSelect.value;
    let destination = destSelect.value;

    // Handle new origin
    if (origin === '__new__') {
      const newOriginDiv = container.querySelector('.dt-new-origin');
      const name = newOriginDiv.querySelector('.dt-new-location-name').value.trim();
      const address = newOriginDiv.querySelector('.dt-new-location-address').value.trim();
      if (!name || !address) {
        showAlertModal(
          container,
          dark,
          'Please enter both name and address for the new origin location.'
        );
        return;
      }
      origin = name;
      currentLocations[name] = address;
    }

    // Handle new destination
    if (destination === '__new__') {
      const newDestDiv = container.querySelector('.dt-new-dest');
      const name = newDestDiv.querySelector('.dt-new-location-name').value.trim();
      const address = newDestDiv.querySelector('.dt-new-location-address').value.trim();
      if (!name || !address) {
        showAlertModal(
          container,
          dark,
          'Please enter both name and address for the new destination location.'
        );
        return;
      }
      destination = name;
      currentLocations[name] = address;
    }

    if (!origin || !destination) {
      showAlertModal(container, dark, 'Please select both origin and destination.');
      return;
    }

    if (selectedDays.size === 0) {
      showAlertModal(container, dark, 'Please select at least one day.');
      return;
    }

    // Save locations if new ones were added
    saveLocations(currentLocations);

    const label = container.querySelector('.dt-label-input').value.trim();

    const newRoute = {
      origin,
      destination,
      via: selectedVia,
      viaLabel: selectedViaLabel,
      days: Array.from(selectedDays),
      startTime,
      endTime,
      label,
      minTimeToShow: minTime,
    };

    onSave(newRoute);
  });
}

// Map preview modal - shows embedded Google Maps for route verification
function showMapPreviewModal(container, dark, origin, destination, via = []) {
  const darkClass = dark ? 'dark' : '';
  const modalId = 'dt-map-preview-modal';

  const existing = container.querySelector(`#${modalId}`);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = `drive-time-overlay ${darkClass} setup dt-map-modal`;
  modal.innerHTML = `
    <div class="drive-time-setup dt-map-preview">
      <div class="drive-time-setup-title">Route Preview</div>
      <div class="dt-map-container">
        <div class="dt-map-loading">Loading map...</div>
      </div>
      <div class="drive-time-setup-actions">
        <button class="dt-btn dt-save">Close</button>
      </div>
    </div>
  `;

  container.appendChild(modal);

  const mapContainer = modal.querySelector('.dt-map-container');

  // Fetch embed URL and load iframe
  fetchMapEmbedUrl(origin, destination, via).then((embedUrl) => {
    if (embedUrl) {
      mapContainer.innerHTML = `
        <iframe
          class="dt-map-iframe"
          src="${embedUrl}"
          allowfullscreen
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade">
        </iframe>
      `;
    } else {
      mapContainer.innerHTML = `<div class="dt-map-error">Failed to load map preview</div>`;
    }
  });

  modal.querySelector('.dt-save').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Route picker modal - shows alternative routes and lets user select one to lock in
function showRoutePickerModal(container, dark, origin, destination, onSelectRoute) {
  const darkClass = dark ? 'dark' : '';
  const modalId = 'dt-route-picker-modal';

  const existing = container.querySelector(`#${modalId}`);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = `drive-time-overlay ${darkClass} setup dt-route-picker-modal`;
  modal.innerHTML = `
    <div class="drive-time-setup dt-route-picker">
      <div class="drive-time-setup-title">Choose Your Route</div>
      <p class="dt-setup-desc">Select the route you normally take. This will lock in that specific route for traffic updates.</p>
      <div class="dt-routes-loading">Loading route alternatives...</div>
      <div class="dt-alternatives-list" style="display: none;"></div>
      <div class="drive-time-setup-actions">
        <button class="dt-btn dt-cancel">Cancel</button>
      </div>
    </div>
  `;

  container.appendChild(modal);

  const loadingEl = modal.querySelector('.dt-routes-loading');
  const listEl = modal.querySelector('.dt-alternatives-list');

  // Fetch alternatives
  fetchRouteAlternatives(origin, destination).then((routes) => {
    loadingEl.style.display = 'none';

    if (!routes || routes.length === 0) {
      listEl.innerHTML =
        '<div class="dt-no-routes">No alternative routes found for this trip.</div>';
      listEl.style.display = 'block';
      return;
    }

    listEl.innerHTML = routes
      .map(
        (route, i) => `
        <div class="dt-alternative-item" data-index="${i}">
          <div class="dt-alt-summary">
            <span class="dt-alt-name">${route.summary}</span>
            ${route.waypointCoords?.length ? `<span class="dt-alt-via-hint">${route.waypointCoords.length} waypoints locked</span>` : ''}
          </div>
          <div class="dt-alt-details">
            <span class="dt-alt-time">${route.durationInTraffic}</span>
            <span class="dt-alt-distance">${route.distance}</span>
          </div>
          <button class="dt-btn dt-select-route" data-index="${i}">Use This Route</button>
        </div>
      `
      )
      .join('');
    listEl.style.display = 'block';

    // Handle route selection - pass coords for routing, summary for display
    listEl.querySelectorAll('.dt-select-route').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const selectedRoute = routes[index];
        modal.remove();
        // Pass waypointCoords (for API) and summary (for display)
        onSelectRoute(selectedRoute.waypointCoords || [], selectedRoute.summary);
      });
    });
  });

  modal.querySelector('.dt-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Alert modal - replaces browser alert()
function showAlertModal(container, dark, message) {
  const darkClass = dark ? 'dark' : '';
  const modalId = 'dt-alert-modal';

  const existing = container.querySelector(`#${modalId}`);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = `drive-time-overlay ${darkClass} setup dt-confirm-modal`;
  modal.innerHTML = `
    <div class="drive-time-setup">
      <p class="dt-setup-desc">${message}</p>
      <div class="drive-time-setup-actions">
        <button class="dt-btn dt-save">OK</button>
      </div>
    </div>
  `;

  container.appendChild(modal);
  modal.querySelector('.dt-save').addEventListener('click', () => modal.remove());
}

// Confirmation modal - replaces browser confirm()
function showConfirmModal(container, dark, message, onConfirm, onCancel) {
  const darkClass = dark ? 'dark' : '';
  const modalId = 'dt-confirm-modal';

  // Remove any existing modal
  const existing = container.querySelector(`#${modalId}`);
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = modalId;
  modal.className = `drive-time-overlay ${darkClass} setup dt-confirm-modal`;
  modal.innerHTML = `
    <div class="drive-time-setup">
      <div class="drive-time-setup-title">Confirm</div>
      <p class="dt-setup-desc">${message}</p>
      <div class="drive-time-setup-actions">
        <button class="dt-btn dt-cancel">Cancel</button>
        <button class="dt-btn dt-confirm-delete">Delete</button>
      </div>
    </div>
  `;

  container.appendChild(modal);

  modal.querySelector('.dt-cancel').addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });

  modal.querySelector('.dt-confirm-delete').addEventListener('click', () => {
    modal.remove();
    onConfirm();
  });
}

// Route Manager - main config UI
function renderRouteManager(container, dark, onDone) {
  const darkClass = dark ? 'dark' : '';
  const routes = getStoredRoutes();

  function renderList() {
    container.innerHTML = `
      <div class="drive-time-overlay ${darkClass} setup route-manager">
        <div class="drive-time-setup">
          <div class="drive-time-setup-title">Drive Time Routes</div>

          ${
            routes.length === 0
              ? '<p class="dt-setup-desc">No routes configured yet. Add a route to get started.</p>'
              : `
            <div class="dt-routes-list">
              ${routes
                .map(
                  (r, i) => `
                <div class="dt-route-item" data-index="${i}">
                  <div class="dt-route-item-info">
                    <div class="dt-route-item-path">${r.origin} &rarr; ${r.destination}</div>
                    ${r.viaLabel ? `<div class="dt-route-item-via">via ${r.viaLabel}</div>` : r.via?.length ? `<div class="dt-route-item-via">${r.via.length} waypoints</div>` : ''}
                    <div class="dt-route-item-schedule">${r.days?.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ') || 'daily'} ${formatTime12h(r.startTime || '6:00')}&ndash;${formatTime12h(r.endTime || '8:00')}</div>
                    ${r.label ? `<div class="dt-route-item-label">${r.label}</div>` : ''}
                    ${r.minTimeToShow ? `<div class="dt-route-item-min">Show if &gt; ${r.minTimeToShow} min</div>` : ''}
                  </div>
                  <div class="dt-route-item-actions">
                    <button class="dt-route-edit" data-index="${i}" title="Edit">&#9998;</button>
                    <button class="dt-route-delete" data-index="${i}" title="Delete">&times;</button>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }

          <div class="dt-manager-actions">
            <button class="dt-btn dt-add-route">+ Add Route</button>
            <button class="dt-btn dt-manage-locations">Manage Locations</button>
            <button class="dt-btn dt-show-now">Show Now</button>
          </div>

          <div class="drive-time-setup-actions">
            <button class="dt-btn dt-save">Done</button>
          </div>
        </div>
      </div>
    `;

    // Add route button
    container.querySelector('.dt-add-route').addEventListener('click', () => {
      renderRouteForm(
        container,
        dark,
        null,
        (newRoute) => {
          routes.push(newRoute);
          saveRoutes(routes);
          renderList();
        },
        () => renderList()
      );
    });

    // Manage locations button
    container.querySelector('.dt-manage-locations').addEventListener('click', () => {
      renderLocationEditor(container, dark, () => renderList());
    });

    // Show Now button - clears dismissed state and shows widget
    container.querySelector('.dt-show-now').addEventListener('click', () => {
      // Clear all dismissed routes for today
      localStorage.removeItem(DISMISSED_KEY);
      onDone();
    });

    // Edit route buttons
    container.querySelectorAll('.dt-route-edit').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        renderRouteForm(
          container,
          dark,
          routes[index],
          (updatedRoute) => {
            routes[index] = updatedRoute;
            saveRoutes(routes);
            renderList();
          },
          () => renderList()
        );
      });
    });

    // Delete route buttons
    container.querySelectorAll('.dt-route-delete').forEach((btn) => {
      btn.addEventListener('click', () => {
        const index = parseInt(btn.dataset.index, 10);
        const routeName =
          routes[index].label || `${routes[index].origin} → ${routes[index].destination}`;
        showConfirmModal(container, dark, `Delete route "${routeName}"?`, () => {
          routes.splice(index, 1);
          saveRoutes(routes);
          renderList();
        });
      });
    });

    // Done button
    container.querySelector('.dt-save').addEventListener('click', onDone);
  }

  renderList();
}

// Location editor - for managing location addresses and names
function renderLocationEditor(container, dark, onBack) {
  const darkClass = dark ? 'dark' : '';
  const locations = getLocations();
  const locationKeys = Object.keys(locations);
  const renamedKeys = {}; // Track renames: originalKey -> newKey

  container.innerHTML = `
    <div class="drive-time-overlay ${darkClass} setup location-manager">
      <div class="drive-time-setup">
        <div class="drive-time-setup-title">Manage Locations</div>
        <p class="dt-setup-desc">Edit addresses for your saved locations.</p>

        <div class="dt-locations-list">
          ${
            locationKeys.length === 0
              ? '<p class="dt-no-locations">No locations saved yet.</p>'
              : locationKeys
                  .map(
                    (key) => `
              <div class="dt-location-item" data-original-key="${key}" data-current-key="${key}">
                <div class="dt-location-header">
                  <span class="dt-location-name-display">${key}</span>
                  <input type="text" class="dt-location-name-input" value="${key}" style="display: none;">
                  <button class="dt-location-edit-name" title="Rename">&#9998;</button>
                  <button class="dt-location-save-name" title="Save name" style="display: none;">&#10003;</button>
                  <button class="dt-location-delete" data-key="${key}" title="Delete">&times;</button>
                </div>
                <div class="dt-address-wrap">
                  <input type="text" class="dt-address-input" data-location="${key}"
                         value="${locations[key] || ''}"
                         placeholder="Start typing address...">
                </div>
              </div>
            `
                  )
                  .join('')
          }
        </div>

        <button class="dt-btn dt-add-location">+ Add Location</button>

        <div class="drive-time-setup-actions">
          <button class="dt-btn dt-back">&larr; Back</button>
          <button class="dt-btn dt-save">Save</button>
        </div>
      </div>
    </div>
  `;

  const locationsList = container.querySelector('.dt-locations-list');

  function addLocationItem(key = '', address = '') {
    const item = document.createElement('div');
    item.className = 'dt-location-item';
    item.dataset.originalKey = key;
    item.dataset.currentKey = key;
    item.innerHTML = `
      <div class="dt-location-header">
        <span class="dt-location-name-display" style="${key ? '' : 'display: none;'}">${key}</span>
        <input type="text" class="dt-location-name-input" value="${key}" style="${key ? 'display: none;' : ''}" placeholder="Location name (e.g. home)">
        <button class="dt-location-edit-name" title="Rename" style="${key ? '' : 'display: none;'}">&#9998;</button>
        <button class="dt-location-save-name" title="Save name" style="${key ? 'display: none;' : ''}">&#10003;</button>
        <button class="dt-location-delete" title="Delete">&times;</button>
      </div>
      <div class="dt-address-wrap">
        <input type="text" class="dt-address-input"
               value="${address}"
               placeholder="Start typing address...">
      </div>
    `;

    // Remove the "no locations" message if present
    const noLocationsMsg = locationsList.querySelector('.dt-no-locations');
    if (noLocationsMsg) noLocationsMsg.remove();

    locationsList.appendChild(item);

    const addressInput = item.querySelector('.dt-address-input');
    setupAddressAutocomplete(addressInput);

    // Edit name button
    const editBtn = item.querySelector('.dt-location-edit-name');
    editBtn.addEventListener('click', () => {
      item.querySelector('.dt-location-name-display').style.display = 'none';
      item.querySelector('.dt-location-edit-name').style.display = 'none';
      item.querySelector('.dt-location-name-input').style.display = 'block';
      item.querySelector('.dt-location-save-name').style.display = 'block';
      item.querySelector('.dt-location-name-input').focus();
    });

    // Save name button
    const saveBtn = item.querySelector('.dt-location-save-name');
    saveBtn.addEventListener('click', () => {
      const input = item.querySelector('.dt-location-name-input');
      const display = item.querySelector('.dt-location-name-display');
      const newName = input.value.trim();

      if (newName) {
        display.textContent = newName;
        item.dataset.currentKey = newName;
      }

      display.style.display = 'block';
      item.querySelector('.dt-location-edit-name').style.display = 'block';
      input.style.display = 'none';
      saveBtn.style.display = 'none';
    });

    // Delete button
    const deleteBtn = item.querySelector('.dt-location-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const currentKey = item.dataset.currentKey;
      if (!currentKey) {
        // New unsaved location, just remove the element
        item.remove();
        return;
      }
      showConfirmModal(
        container,
        dark,
        `Delete location "${currentKey}"? Routes using this location will need to be updated.`,
        () => {
          const originalKey = item.dataset.originalKey;
          if (originalKey) {
            delete locations[originalKey];
            saveLocations(locations);
          }
          item.remove();
        }
      );
    });

    // Focus the name input if this is a new location
    if (!key) {
      item.querySelector('.dt-location-name-input').focus();
    }

    return item;
  }

  // Add Location button
  container.querySelector('.dt-add-location').addEventListener('click', () => {
    addLocationItem();
  });

  // Setup autocomplete for each address input
  container.querySelectorAll('.dt-address-input').forEach((input) => {
    setupAddressAutocomplete(input);
  });

  // Edit name buttons - switch to edit mode
  container.querySelectorAll('.dt-location-edit-name').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.dt-location-item');
      item.querySelector('.dt-location-name-display').style.display = 'none';
      item.querySelector('.dt-location-edit-name').style.display = 'none';
      item.querySelector('.dt-location-name-input').style.display = 'block';
      item.querySelector('.dt-location-save-name').style.display = 'block';
      item.querySelector('.dt-location-name-input').focus();
    });
  });

  // Save name buttons - save and switch back to display mode
  container.querySelectorAll('.dt-location-save-name').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.dt-location-item');
      const input = item.querySelector('.dt-location-name-input');
      const display = item.querySelector('.dt-location-name-display');
      const newName = input.value.trim();
      const originalKey = item.dataset.originalKey;

      if (newName) {
        display.textContent = newName;
        item.dataset.currentKey = newName;
        renamedKeys[originalKey] = newName;
      }

      display.style.display = 'block';
      item.querySelector('.dt-location-edit-name').style.display = 'block';
      input.style.display = 'none';
      btn.style.display = 'none';
    });
  });

  // Delete location buttons
  container.querySelectorAll('.dt-location-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const item = btn.closest('.dt-location-item');
      const key = item.dataset.currentKey;
      showConfirmModal(
        container,
        dark,
        `Delete location "${key}"? Routes using this location will need to be updated.`,
        () => {
          const originalKey = item.dataset.originalKey;
          delete locations[originalKey];
          saveLocations(locations);
          renderLocationEditor(container, dark, onBack);
        }
      );
    });
  });

  // Back button
  container.querySelector('.dt-back').addEventListener('click', onBack);

  // Save button - handles renames and address changes
  container.querySelector('.dt-save').addEventListener('click', () => {
    const newLocations = {};
    const routes = getStoredRoutes();
    let routesUpdated = false;

    container.querySelectorAll('.dt-location-item').forEach((item) => {
      const originalKey = item.dataset.originalKey;
      // Use input value directly in case user didn't click the save name button
      const nameInput = item.querySelector('.dt-location-name-input');
      const currentKey = nameInput.value.trim() || item.dataset.currentKey;
      const address = item.querySelector('.dt-address-input').value.trim();

      if (currentKey && address) {
        newLocations[currentKey] = address;

        // Update routes if location was renamed
        if (originalKey !== currentKey) {
          routes.forEach((route) => {
            if (route.origin === originalKey) {
              route.origin = currentKey;
              routesUpdated = true;
            }
            if (route.destination === originalKey) {
              route.destination = currentKey;
              routesUpdated = true;
            }
          });
        }
      }
    });

    saveLocations(newLocations);
    if (routesUpdated) {
      saveRoutes(routes);
    }
    onBack();
  });
}

// Widget render function
function renderDriveTimeWidget(container, panel, { refreshIntervals, dark = true }) {
  const panelDark = panel.args?.dark ?? dark;

  // Get routes from localStorage
  const routes = getStoredRoutes();

  function showRouteManager() {
    renderRouteManager(container, panelDark, () => {
      startWidget();
    });
  }

  function checkLocationsConfigured() {
    const locations = getLocations();
    const currentRoutes = getStoredRoutes();
    for (const route of currentRoutes) {
      if (!locations[route.origin] || !locations[route.destination]) {
        return false;
      }
    }
    return true;
  }

  function startWidget() {
    const currentRoutes = getStoredRoutes();

    // If no routes configured, show setup prompt
    if (currentRoutes.length === 0) {
      renderSettingsIcon(container, panelDark, () => showRouteManager());
      return;
    }

    async function checkAndRender() {
      const latestRoutes = getStoredRoutes();
      const activeRoutes = getActiveRoutes(latestRoutes);
      const routeInfo = { total: latestRoutes.length, active: activeRoutes.length };

      if (activeRoutes.length === 0) {
        // Show settings icon even outside time window so user can reconfigure
        renderSettingsIcon(container, panelDark, () => showRouteManager(), routeInfo);
        return;
      }

      // Filter out dismissed routes
      const nonDismissedRoutes = activeRoutes.filter(
        (route) => !isDismissedToday(getRouteId(route))
      );

      if (nonDismissedRoutes.length === 0) {
        // All routes dismissed for today
        renderSettingsIcon(container, panelDark, () => showRouteManager(), routeInfo);
        return;
      }

      const locations = getLocations();

      // Check all routes have configured addresses
      const routesWithAddresses = nonDismissedRoutes.filter((route) => {
        const originAddress = locations[route.origin];
        const destAddress = locations[route.destination];
        return originAddress && destAddress;
      });

      if (routesWithAddresses.length === 0) {
        showRouteManager();
        return;
      }

      renderLoading(container, panelDark);

      // Fetch drive times for all active routes in parallel
      const routeDataPromises = routesWithAddresses.map(async (route) => {
        const originAddress = locations[route.origin];
        const destAddress = locations[route.destination];
        const driveData = await fetchDriveTime(originAddress, destAddress, route.via || []);
        return { route, driveData };
      });

      const routeDataResults = await Promise.all(routeDataPromises);

      // Filter out routes that failed to fetch or don't meet minTimeToShow
      // Exception: always show if route mismatch detected (usual route may be blocked)
      const validRouteData = routeDataResults.filter(({ route, driveData }) => {
        if (!driveData) return false;
        // Always show if there's a route mismatch (blocked road, etc.)
        if (detectRouteMismatch(route, driveData)) return true;
        const minTimeMinutes = route.minTimeToShow || 0;
        const durationMinutes = Math.round(driveData.durationInTrafficValue / 60);
        return minTimeMinutes === 0 || durationMinutes >= minTimeMinutes;
      });

      if (validRouteData.length === 0) {
        renderSettingsIcon(container, panelDark, () => showRouteManager(), routeInfo);
        return;
      }

      // Dismiss all shown routes when close is clicked
      const dismissAll = () => {
        validRouteData.forEach(({ route }) => {
          dismissForToday(getRouteId(route));
        });
        renderSettingsIcon(container, panelDark, () => showRouteManager(), routeInfo);
      };

      if (validRouteData.length === 1) {
        // Single route - use original overlay
        const { route, driveData } = validRouteData[0];
        renderOverlay(container, driveData, route, panelDark, dismissAll, () => showRouteManager());
      } else {
        // Multiple routes - use combined overlay
        renderMultiRouteOverlay(container, validRouteData, panelDark, dismissAll, () =>
          showRouteManager()
        );
      }
    }

    checkAndRender();

    const intervalId = setInterval(checkAndRender, 5 * 60 * 1000);
    refreshIntervals.push(intervalId);

    const windowCheckId = setInterval(() => {
      const latestRoutes = getStoredRoutes();
      const activeRoutes = getActiveRoutes(latestRoutes);
      const routeInfo = { total: latestRoutes.length, active: activeRoutes.length };
      if (activeRoutes.length === 0 && !container.querySelector('.drive-time-settings-icon')) {
        // Show settings icon even outside time window
        renderSettingsIcon(container, panelDark, () => showRouteManager(), routeInfo);
      } else if (activeRoutes.length > 0 && container.innerHTML === '') {
        // Re-render when entering time window
        checkAndRender();
      }
    }, 60 * 1000);
    refreshIntervals.push(windowCheckId);
  }

  // If no routes or locations not configured, show route manager
  if (routes.length === 0 || !checkLocationsConfigured()) {
    showRouteManager();
    return;
  }

  startWidget();
}

registerWidget('drive-time', renderDriveTimeWidget);
