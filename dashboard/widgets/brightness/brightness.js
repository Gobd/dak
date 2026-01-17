import './brightness.css';
import { registerWidget } from '../../widget-registry.js';
import {
  getDashboardConfig,
  updateConfigSection,
  getRelayUrl,
} from '../../script.js';
import { setupLocationAutocomplete, formatLocation } from '../../location.js';

// Auto Brightness Widget
// Configures sunrise/sunset brightness control via home-relay API

async function getConfig() {
  try {
    // First try the API endpoint for brightness
    const res = await fetch(`${getRelayUrl()}/config/brightness`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error('Failed to get config');
    return await res.json();
  } catch (err) {
    // Fall back to in-memory dashboard config
    const dashboardConfig = getDashboardConfig();
    if (dashboardConfig?.brightness) {
      return dashboardConfig.brightness;
    }
    console.warn('Brightness config fetch failed:', err.message);
    return null;
  }
}

async function saveConfig(config) {
  try {
    // Update the brightness section of the full config
    await updateConfigSection('brightness', config);
    return config;
  } catch (err) {
    console.error('Brightness config save error:', err);
    return null;
  }
}

async function getStatus() {
  try {
    const res = await fetch(`${getRelayUrl()}/brightness/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error('Failed to get status');
    return await res.json();
  } catch (err) {
    console.warn('Brightness status fetch failed:', err.message);
    return null;
  }
}

async function setBrightness(level) {
  try {
    const res = await fetch(`${getRelayUrl()}/brightness/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Failed to set brightness');
    return await res.json();
  } catch (err) {
    console.error('Brightness set failed:', err.message);
    return null;
  }
}

function showModal(dark, onClose) {
  const darkClass = dark ? 'dark' : '';

  const modal = document.createElement('div');
  modal.className = `brightness-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="brightness-modal-content">
      <div class="brightness-modal-header">
        <h3>Auto Brightness</h3>
      </div>
      <div class="brightness-modal-body">
        <div class="brightness-loading">Loading...</div>
      </div>
      <div class="brightness-modal-actions">
        <button class="brightness-modal-close">Close</button>
      </div>
    </div>
  `;

  const bodyEl = modal.querySelector('.brightness-modal-body');

  async function loadConfig() {
    const config = await getConfig();
    const status = await getStatus();

    if (!config) {
      bodyEl.innerHTML = `<p class="brightness-error">Could not connect to home-relay service</p>`;
      return;
    }

    const currentLevel = status?.current ?? '?';

    bodyEl.innerHTML = `
      <div class="brightness-form">
        <div class="brightness-row">
          <label>Enable Auto Brightness</label>
          <label class="brightness-toggle">
            <input type="checkbox" id="brightness-enabled" ${config.enabled ? 'checked' : ''}>
            <span class="brightness-toggle-slider"></span>
          </label>
        </div>

        <div class="brightness-row">
          <label>Location</label>
          <div class="brightness-location-input">
            <input type="text" id="brightness-location" placeholder="Search city or address..." value="${config.location || ''}">
          </div>
        </div>
        <div class="brightness-location-coords">
          ${config.lat && config.lon ? `Lat: ${config.lat}, Lon: ${config.lon}` : 'No coordinates set'}
        </div>

        <div class="brightness-row">
          <label>Day Brightness: <span id="day-value">${config.dayBrightness}%</span></label>
          <input type="range" id="brightness-day" min="1" max="100" value="${config.dayBrightness}">
        </div>

        <div class="brightness-row">
          <label>Night Brightness: <span id="night-value">${config.nightBrightness}%</span></label>
          <input type="range" id="brightness-night" min="1" max="100" value="${config.nightBrightness}">
        </div>

        <div class="brightness-row">
          <label>Transition Time: <span id="trans-value">${config.transitionMins} min</span></label>
          <input type="range" id="brightness-transition" min="15" max="120" step="15" value="${config.transitionMins}">
        </div>

        <div class="brightness-status">
          <span>Current: ${currentLevel}%</span>
          ${config.enabled ? '<span class="brightness-active">Active</span>' : '<span class="brightness-inactive">Disabled</span>'}
        </div>

        <div class="brightness-set-now">
          <div class="brightness-row">
            <label>Set Now: <span id="set-now-value">${currentLevel !== '?' ? currentLevel : 50}%</span></label>
            <input type="range" id="brightness-set-now" min="1" max="100" value="${currentLevel !== '?' ? currentLevel : 50}">
          </div>
          <button class="brightness-set-now-btn">Apply</button>
        </div>

        <button class="brightness-save-btn">Save</button>
      </div>
    `;

    // Setup location autocomplete
    const locationInput = bodyEl.querySelector('#brightness-location');
    const coordsEl = bodyEl.querySelector('.brightness-location-coords');
    let selectedLocation = { lat: config.lat, lon: config.lon, location: config.location };

    setupLocationAutocomplete(locationInput, (result) => {
      selectedLocation = {
        lat: result.lat,
        lon: result.lon,
        location: result.description || formatLocation(result.city, result.state),
      };
      coordsEl.textContent = `Lat: ${result.lat}, Lon: ${result.lon}`;
      locationInput.value = selectedLocation.location;
    });

    // Slider value displays
    const daySlider = bodyEl.querySelector('#brightness-day');
    const nightSlider = bodyEl.querySelector('#brightness-night');
    const transSlider = bodyEl.querySelector('#brightness-transition');
    const dayValue = bodyEl.querySelector('#day-value');
    const nightValue = bodyEl.querySelector('#night-value');
    const transValue = bodyEl.querySelector('#trans-value');

    daySlider.addEventListener('input', () => {
      dayValue.textContent = `${daySlider.value}%`;
    });
    nightSlider.addEventListener('input', () => {
      nightValue.textContent = `${nightSlider.value}%`;
    });
    transSlider.addEventListener('input', () => {
      transValue.textContent = `${transSlider.value} min`;
    });

    // Set Now slider and button
    const setNowSlider = bodyEl.querySelector('#brightness-set-now');
    const setNowValue = bodyEl.querySelector('#set-now-value');
    const setNowBtn = bodyEl.querySelector('.brightness-set-now-btn');

    setNowSlider.addEventListener('input', () => {
      setNowValue.textContent = `${setNowSlider.value}%`;
    });

    setNowBtn.addEventListener('click', async () => {
      const level = parseInt(setNowSlider.value);
      setNowBtn.textContent = 'Setting...';
      setNowBtn.disabled = true;

      const result = await setBrightness(level);
      if (result && result.success) {
        setNowBtn.textContent = 'Done!';
        // Update the current display
        bodyEl.querySelector('.brightness-status span').textContent = `Current: ${level}%`;
      } else {
        setNowBtn.textContent = 'Error';
      }
      setTimeout(() => {
        setNowBtn.textContent = 'Apply';
        setNowBtn.disabled = false;
      }, 1500);
    });

    // Save button
    bodyEl.querySelector('.brightness-save-btn').addEventListener('click', async () => {
      const newConfig = {
        enabled: bodyEl.querySelector('#brightness-enabled').checked,
        lat: selectedLocation.lat,
        lon: selectedLocation.lon,
        location: selectedLocation.location,
        dayBrightness: parseInt(daySlider.value),
        nightBrightness: parseInt(nightSlider.value),
        transitionMins: parseInt(transSlider.value),
      };

      const saveBtn = bodyEl.querySelector('.brightness-save-btn');
      saveBtn.textContent = 'Saving...';
      saveBtn.disabled = true;

      const result = await saveConfig(newConfig);
      if (result) {
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          modal.remove();
          onClose();
        }, 500);
      } else {
        saveBtn.textContent = 'Error - Try Again';
        saveBtn.disabled = false;
      }
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('brightness-modal-close')) {
      modal.remove();
      onClose();
    }
  });

  document.body.appendChild(modal);
  loadConfig();
}

function renderWidget(container, dark, onOpen) {
  const darkClass = dark ? 'dark' : '';

  container.innerHTML = `
    <div class="brightness-widget ${darkClass}">
      <button class="brightness-open-btn" title="Auto Brightness Settings">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </button>
    </div>
  `;

  container.querySelector('.brightness-open-btn').addEventListener('click', onOpen);
}

function renderBrightnessWidget(container, _panel, { dark = true }) {
  function refresh() {
    renderWidget(container, dark, () => showModal(dark, refresh));
  }
  refresh();
}

registerWidget('brightness', renderBrightnessWidget);
