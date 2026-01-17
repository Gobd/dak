const STORAGE_KEY = 'dashboard-config';
const GRID_SNAP = 5; // 5% snap
const MIN_SIZE = 10; // 10% minimum

// API endpoint for home-relay config
// Can be overridden with ?relay=host:port URL param for remote editing
const DEFAULT_RELAY_URL = 'http://localhost:5111';
let relayUrl = DEFAULT_RELAY_URL;

// Get the relay URL (for widgets to use)
export function getRelayUrl() {
  return relayUrl;
}

// Initialize relay URL from URL params
function initRelayUrl() {
  const params = new URLSearchParams(window.location.search);
  const relayParam = params.get('relay');
  if (relayParam) {
    // Add http:// if not present
    relayUrl = relayParam.startsWith('http') ? relayParam : `http://${relayParam}`;
    console.log(`Using remote relay: ${relayUrl}`);
  }
}

// SSE connection for live config updates
let sseConnection = null;
let sseRetryCount = 0;
let sseRetryTimeout = null;

// Notification modal state
let activeNotifications = [];

// Expose notify function for iframes to call
window.notify = async function (data) {
  if (!data.type || !data.due) {
    console.warn('notify: type and due are required');
    return;
  }
  try {
    await fetch(`${relayUrl}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    console.log('Notification registered:', data);
  } catch (err) {
    console.warn('Failed to register notification:', err);
  }
};

function connectToConfigUpdates() {
  if (sseConnection) {
    sseConnection.close();
  }
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
    sseRetryTimeout = null;
  }

  try {
    sseConnection = new EventSource(`${relayUrl}/config/subscribe`);

    sseConnection.onopen = () => {
      console.log('Connected to config update stream');
      sseRetryCount = 0; // Reset backoff on successful connection
    };

    sseConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'config-updated') {
        // Skip reload if we just saved (this is our own change)
        if (ignoreSseReload) {
          console.log('Ignoring SSE reload for our own save');
          return;
        }
        console.log('Config updated remotely, reloading...');
        window.location.reload();
      } else if (data.type === 'notifications') {
        // Show notification modal for due notifications
        handleNotifications(data.notifications);
      }
    };

    sseConnection.onerror = () => {
      // Close and use exponential backoff for reconnect
      sseConnection.close();
      sseRetryCount++;
      // Backoff: 1s, 2s, 4s, 8s, 16s, max 30s
      const delay = Math.min(1000 * Math.pow(2, sseRetryCount - 1), 30000);
      console.log(`Config stream disconnected, retrying in ${delay / 1000}s...`);
      sseRetryTimeout = setTimeout(connectToConfigUpdates, delay);
    };
  } catch (err) {
    console.warn('SSE not available:', err.message);
  }
}

// Cleanup SSE connection on page unload to prevent server-side resource leaks
function cleanupSSE() {
  if (sseRetryTimeout) {
    clearTimeout(sseRetryTimeout);
    sseRetryTimeout = null;
  }
  if (sseConnection) {
    sseConnection.close();
    sseConnection = null;
  }
}

window.addEventListener('beforeunload', cleanupSSE);
window.addEventListener('pagehide', cleanupSSE);

// Local dev URL mappings (used when ?local is in URL)
// Maps relative paths to localhost ports for local development
const LOCAL_URL_MAP = {
  '/notes-app/': 'http://localhost:8081/',
  '/health-tracker/': 'http://localhost:5173/health-tracker/',
  '/family-chores/': 'http://localhost:5174/family-chores/',
};

let screens = [];
let config = {};
let currentIndex = 0;
let editMode = false;
let layoutLocked = true; // In edit mode: locked = layout editing, unlocked = widget interaction
let localMode = false;
const refreshIntervals = [];

// Flag to ignore SSE reload when we just saved
let ignoreSseReload = false;
let ignoreSseTimeout = null;

// Widget registry - widgets register themselves here
const widgets = {};

// Convert production URLs to local dev URLs when in local mode
function toLocalUrl(url) {
  if (!localMode || !url) return url;
  for (const [prod, local] of Object.entries(LOCAL_URL_MAP)) {
    if (url.startsWith(prod)) {
      return url.replace(prod, local);
    }
  }
  return url;
}

export function registerWidget(type, renderFn) {
  widgets[type] = renderFn;
}

// Get available widget types for UI
export function getWidgetTypes() {
  return Object.keys(widgets);
}

// =====================
// Alert & Confirm Modals
// =====================

function showAlert(message, title = null) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'dialog-modal';
    modal.innerHTML = `
      <div class="dialog-modal-content">
        ${title ? `<div class="dialog-modal-header"><h3>${title}</h3></div>` : ''}
        <div class="dialog-modal-body">
          <p>${message}</p>
        </div>
        <div class="dialog-modal-actions">
          <button class="dialog-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    const cleanup = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 150);
      resolve();
    };

    modal.querySelector('.dialog-ok').addEventListener('click', cleanup);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup();
    });
  });
}

export function showConfirm(
  message,
  { title = 'Confirm', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}
) {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'dialog-modal';
    const confirmClass = danger ? 'dialog-danger' : 'dialog-confirm';
    modal.innerHTML = `
      <div class="dialog-modal-content">
        <div class="dialog-modal-header"><h3>${title}</h3></div>
        <div class="dialog-modal-body">
          <p>${message}</p>
        </div>
        <div class="dialog-modal-actions">
          <button class="dialog-cancel">${cancelText}</button>
          <button class="${confirmClass}">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('open'));

    const cleanup = (result) => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 150);
      resolve(result);
    };

    modal.querySelector('.dialog-cancel').addEventListener('click', () => cleanup(false));
    modal.querySelector(`.${confirmClass}`).addEventListener('click', () => cleanup(true));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup(false);
    });
  });
}

// =====================
// Notification Modal
// =====================

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function handleNotifications(notifications) {
  if (!notifications || notifications.length === 0) return;

  // Don't show duplicates that are already displayed
  const newNotifications = notifications.filter(
    (n) => !activeNotifications.some((a) => a.id === n.id)
  );
  if (newNotifications.length === 0) return;

  activeNotifications.push(...newNotifications);
  showNotificationModal();
}

function showNotificationModal() {
  // Remove existing modal if any
  const existing = document.querySelector('.notification-modal');
  if (existing) existing.remove();

  if (activeNotifications.length === 0) return;

  const modal = document.createElement('div');
  modal.className = 'notification-modal';

  const notificationsList = activeNotifications
    .map((n) => {
      const status = n.is_overdue ? '⚠️ Overdue' : n.is_today ? '📅 Due Today' : '🔔 Due Tomorrow';
      return `
        <div class="notification-item" data-id="${n.id}">
          <div class="notification-header">
            <span class="notification-status">${status}</span>
            <span class="notification-type">${escapeHtml(n.type)}</span>
          </div>
          <div class="notification-name">${escapeHtml(n.name)}</div>
          <div class="notification-due">Due: ${n.due_date}</div>
          <div class="notification-actions">
            <button class="notification-dismiss" data-id="${n.id}" data-hours="4">Snooze 4h</button>
            <button class="notification-dismiss" data-id="${n.id}" data-hours="24">Snooze 24h</button>
          </div>
        </div>
      `;
    })
    .join('');

  modal.innerHTML = `
    <div class="notification-modal-content">
      <div class="notification-modal-header">
        <h3>Reminders</h3>
        <button class="notification-close">×</button>
      </div>
      <div class="notification-modal-body">
        ${notificationsList}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  // Close button
  modal.querySelector('.notification-close').addEventListener('click', () => {
    closeNotificationModal();
  });

  // Dismiss/snooze buttons
  modal.querySelectorAll('.notification-dismiss').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.dataset.id);
      const hours = parseInt(e.target.dataset.hours);
      await dismissNotification(id, hours);
    });
  });

  // Click outside to minimize (not close)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeNotificationModal();
    }
  });
}

function closeNotificationModal() {
  const modal = document.querySelector('.notification-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 150);
  }
}

async function dismissNotification(id, hours) {
  try {
    await fetch(`${relayUrl}/notifications/${id}/dismiss`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    });

    // Remove from active list
    activeNotifications = activeNotifications.filter((n) => n.id !== id);

    // Update or close modal
    if (activeNotifications.length === 0) {
      closeNotificationModal();
    } else {
      showNotificationModal();
    }
  } catch (err) {
    console.warn('Failed to dismiss notification:', err);
  }
}

// =====================
// Notification Settings Modal
// =====================

let notifSettingsTab = 'prefs'; // 'prefs' or 'events'

async function openNotifSettings() {
  const existing = document.querySelector('.notif-settings-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'notif-settings-modal';

  modal.innerHTML = `
    <div class="notif-settings-content">
      <div class="notif-settings-header">
        <h3>Notification Settings</h3>
        <button class="notif-settings-close">×</button>
      </div>
      <div class="notif-settings-tabs">
        <button class="notif-settings-tab ${notifSettingsTab === 'prefs' ? 'active' : ''}" data-tab="prefs">Preferences</button>
        <button class="notif-settings-tab ${notifSettingsTab === 'events' ? 'active' : ''}" data-tab="events">Events</button>
      </div>
      <div class="notif-settings-body">
        <div class="notif-loading">Loading...</div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('open'));

  // Close button
  modal.querySelector('.notif-settings-close').addEventListener('click', () => {
    closeNotifSettings();
  });

  // Tab buttons
  modal.querySelectorAll('.notif-settings-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      notifSettingsTab = e.target.dataset.tab;
      modal.querySelectorAll('.notif-settings-tab').forEach((t) => t.classList.remove('active'));
      e.target.classList.add('active');
      loadNotifSettingsContent(modal);
    });
  });

  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeNotifSettings();
  });

  // Load content
  await loadNotifSettingsContent(modal);
}

function closeNotifSettings() {
  const modal = document.querySelector('.notif-settings-modal');
  if (modal) {
    modal.classList.remove('open');
    setTimeout(() => modal.remove(), 150);
  }
}

async function loadNotifSettingsContent(modal) {
  const body = modal.querySelector('.notif-settings-body');
  body.innerHTML = '<div class="notif-loading">Loading...</div>';

  try {
    if (notifSettingsTab === 'prefs') {
      await loadPrefsTab(body);
    } else {
      await loadEventsTab(body);
    }
  } catch (err) {
    body.innerHTML = `<div class="notif-empty">Failed to load: ${err.message}</div>`;
  }
}

async function loadPrefsTab(body) {
  // Fetch current prefs and events (to get unique types)
  const [prefsRes, eventsRes] = await Promise.all([
    fetch(`${relayUrl}/notifications/prefs`),
    fetch(`${relayUrl}/notifications`),
  ]);

  const prefs = await prefsRes.json();
  const events = await eventsRes.json();

  // Get unique types from events
  const types = [...new Set(events.map((e) => e.type))];

  if (types.length === 0) {
    body.innerHTML =
      '<div class="notif-empty">No notification types registered yet. Events will appear here once apps send notifications.</div>';
    return;
  }

  body.innerHTML = types
    .map((type) => {
      const pref = prefs[type] || {
        remind_day_before: true,
        remind_day_of: true,
        time_before_start: '17:00',
        time_before_end: '21:00',
        time_day_of_start: '05:00',
        time_day_of_end: '08:00',
      };

      return `
        <div class="notif-pref-item" data-type="${escapeHtml(type)}">
          <div class="notif-pref-header">
            <span class="notif-pref-type">${escapeHtml(type)}</span>
          </div>
          <div class="notif-pref-row">
            <label>
              <input type="checkbox" class="pref-day-before" ${pref.remind_day_before ? 'checked' : ''} />
              Day before
            </label>
            <div class="time-range">
              <input type="time" class="pref-before-start" value="${pref.time_before_start}" />
              to
              <input type="time" class="pref-before-end" value="${pref.time_before_end}" />
            </div>
          </div>
          <div class="notif-pref-row">
            <label>
              <input type="checkbox" class="pref-day-of" ${pref.remind_day_of ? 'checked' : ''} />
              Day of
            </label>
            <div class="time-range">
              <input type="time" class="pref-day-of-start" value="${pref.time_day_of_start}" />
              to
              <input type="time" class="pref-day-of-end" value="${pref.time_day_of_end}" />
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  // Add change handlers
  body.querySelectorAll('.notif-pref-item').forEach((item) => {
    const type = item.dataset.type;
    const inputs = item.querySelectorAll('input');
    inputs.forEach((input) => {
      input.addEventListener('change', () => savePref(type, item));
    });
  });
}

async function savePref(type, item) {
  const data = {
    remind_day_before: item.querySelector('.pref-day-before').checked,
    remind_day_of: item.querySelector('.pref-day-of').checked,
    time_before_start: item.querySelector('.pref-before-start').value,
    time_before_end: item.querySelector('.pref-before-end').value,
    time_day_of_start: item.querySelector('.pref-day-of-start').value,
    time_day_of_end: item.querySelector('.pref-day-of-end').value,
  };

  try {
    await fetch(`${relayUrl}/notifications/prefs/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('Failed to save pref:', err);
  }
}

async function loadEventsTab(body) {
  const res = await fetch(`${relayUrl}/notifications`);
  const events = await res.json();

  if (events.length === 0) {
    body.innerHTML =
      '<div class="notif-empty">No events registered. Events will appear here when apps send notifications.</div>';
    return;
  }

  body.innerHTML = events
    .map(
      (event) => `
      <div class="notif-event-item" data-id="${event.id}">
        <div class="notif-event-info">
          <div class="notif-event-name">${escapeHtml(event.name)}</div>
          <div class="notif-event-meta">${escapeHtml(event.type)} · Due: ${event.due_date}</div>
        </div>
        <button class="notif-event-delete" title="Delete">×</button>
      </div>
    `
    )
    .join('');

  // Delete handlers
  body.querySelectorAll('.notif-event-delete').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const item = e.target.closest('.notif-event-item');
      const id = item.dataset.id;
      try {
        await fetch(`${relayUrl}/notifications/${id}`, { method: 'DELETE' });
        item.remove();
        if (body.querySelectorAll('.notif-event-item').length === 0) {
          body.innerHTML = '<div class="notif-empty">No events registered.</div>';
        }
      } catch (err) {
        console.warn('Failed to delete event:', err);
      }
    });
  });
}

// Currently editing panel
let editingPanel = null;
let editingScreenIndex = null;
let editingPanelIndex = null;

// Parse duration string like '30s', '30m', '1h', '24h' to milliseconds
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    default:
      return null;
  }
}

// Snap value to grid
function snapToGrid(value) {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}

// Full dashboard config object (includes all sections)
let dashboardConfig = null;

// Fetch config from API
async function fetchApiConfig() {
  try {
    const res = await fetch(`${relayUrl}/config`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Fetch default config template from repo
async function fetchDefaultTemplate() {
  try {
    const res = await fetch('/config/dashboard.json');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Get config from localStorage
function getLocalStorageConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Load config: API → localStorage → default template
async function loadConfig() {
  // Try API first
  let loadedConfig = await fetchApiConfig();
  let source = 'api';

  // Fall back to localStorage
  if (!loadedConfig || !loadedConfig.screens || loadedConfig.screens.length === 0) {
    loadedConfig = getLocalStorageConfig();
    if (loadedConfig && loadedConfig.screens && loadedConfig.screens.length > 0) {
      source = 'localStorage';
    }
  }

  // Fall back to default template from repo
  if (!loadedConfig || !loadedConfig.screens || loadedConfig.screens.length === 0) {
    loadedConfig = await fetchDefaultTemplate();
    source = 'default';
  }

  if (!loadedConfig) {
    console.error('Failed to load config from any source');
    loadedConfig = { global: {}, screens: [] };
    source = 'empty';
  }

  console.log(`Config loaded from: ${source}`);

  // Store full config
  dashboardConfig = loadedConfig;

  // Extract global config and screens
  config = loadedConfig.global || {};
  screens = loadedConfig.screens || [];
}

// Debounce timer for drag/resize saves
let saveDebounceTimer = null;
const SAVE_DEBOUNCE_MS = 500;

// Save config to API + localStorage (debounced version for drag operations)
function saveConfigDebounced() {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer);
  }
  saveDebounceTimer = setTimeout(() => {
    saveConfig();
    saveDebounceTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// Save config to API + localStorage
async function saveConfig() {
  // Update dashboardConfig with current values
  if (!dashboardConfig) {
    dashboardConfig = { global: {}, screens: [] };
  }
  dashboardConfig.global = config;
  dashboardConfig.screens = screens;

  // Save to localStorage (always works)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboardConfig));

  // Set flag to ignore our own SSE reload
  ignoreSseReload = true;
  if (ignoreSseTimeout) clearTimeout(ignoreSseTimeout);
  ignoreSseTimeout = setTimeout(() => {
    ignoreSseReload = false;
    ignoreSseTimeout = null;
  }, 5000); // Reset after 5 seconds (generous for slow networks)

  // Save to API (may fail if relay not running)
  try {
    await fetch(`${relayUrl}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dashboardConfig),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Relay not running, localStorage-only is fine
  }
}

// Get the full dashboard config (for widgets that need access to other sections)
export function getDashboardConfig() {
  return dashboardConfig;
}

// Update a specific section of the config and save
export async function updateConfigSection(section, data) {
  if (!dashboardConfig) {
    dashboardConfig = { global: {}, screens: [] };
  }
  dashboardConfig[section] = data;
  await saveConfig();
  return dashboardConfig;
}

async function init() {
  // Initialize relay URL from ?relay param (for remote editing)
  initRelayUrl();

  // Check URL for local mode: ?local
  const params = new URLSearchParams(window.location.search);
  localMode = params.has('local');

  await loadConfig();
  applyConfig();
  renderScreens();

  // Check URL for screen param: ?screen=1 (0-indexed)
  const screenParam = params.get('screen');
  const startScreen = screenParam ? parseInt(screenParam, 10) : 0;
  showScreen(Math.min(startScreen, screens.length - 1));

  setupNavigation();
  setupEditMode();

  // Connect to SSE for live config updates (auto-refresh when config changes)
  connectToConfigUpdates();
}

function applyConfig() {
  // Background color
  if (config.background) {
    document.body.style.background = config.background;
  }

  // Dark mode - add/remove class for widget modals
  if (config.dark !== false) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }

  const navButtonsContainer = document.getElementById('nav-buttons');
  const navPrev = document.getElementById('nav-prev');
  const navNext = document.getElementById('nav-next');
  const pos = config.navPosition || 'bottom-right';
  const buttonMode = config.navButtons || 'both';

  // Show/hide buttons based on config
  if (buttonMode === 'none') {
    navButtonsContainer.style.display = 'none';
  } else {
    navButtonsContainer.style.display = 'flex';
    navPrev.style.display = buttonMode === 'both' || buttonMode === 'prev' ? 'block' : 'none';
    navNext.style.display = buttonMode === 'both' || buttonMode === 'next' ? 'block' : 'none';
  }

  // Position
  navButtonsContainer.style.top = '';
  navButtonsContainer.style.bottom = '';
  navButtonsContainer.style.left = '';
  navButtonsContainer.style.right = '';

  if (pos.includes('top')) navButtonsContainer.style.top = '20px';
  if (pos.includes('bottom')) navButtonsContainer.style.bottom = '20px';
  if (pos.includes('left')) navButtonsContainer.style.left = '20px';
  if (pos.includes('right')) navButtonsContainer.style.right = '20px';

  // Colors
  [navPrev, navNext].forEach((btn) => {
    if (config.navColor) btn.style.color = config.navColor;
    if (config.navBackground) btn.style.background = config.navBackground;
  });
}

function renderScreens() {
  // Clear refresh intervals
  refreshIntervals.forEach((id) => clearInterval(id));
  refreshIntervals.length = 0;

  const container = document.getElementById('screens');
  container.innerHTML = '';

  screens.forEach((screen, screenIndex) => {
    const screenEl = document.createElement('div');
    screenEl.className = 'screen';
    screenEl.dataset.index = screenIndex;

    screen.panels.forEach((panel, panelIndex) => {
      const panelEl = createPanelElement(panel, screenIndex, panelIndex);
      screenEl.appendChild(panelEl);
    });

    container.appendChild(screenEl);
  });
}

function createPanelElement(panel, screenIndex, panelIndex) {
  const panelEl = document.createElement('div');
  panelEl.className = 'panel';
  panelEl.dataset.screenIndex = screenIndex;
  panelEl.dataset.panelIndex = panelIndex;
  panelEl.style.left = panel.x;
  panelEl.style.top = panel.y;
  panelEl.style.width = panel.w;
  panelEl.style.height = panel.h;

  if (panel.css) {
    panelEl.style.cssText += panel.css;
  }

  // Position tooltip
  const tooltip = document.createElement('div');
  tooltip.className = 'position-tooltip';
  tooltip.textContent = `${panel.x}, ${panel.y} | ${panel.w} x ${panel.h}`;
  panelEl.appendChild(tooltip);

  // Resize handles
  const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];
  handles.forEach((dir) => {
    const handle = document.createElement('div');
    handle.className = `resize-handle ${dir} ${['nw', 'ne', 'sw', 'se'].includes(dir) ? 'corner' : 'edge'}`;
    handle.dataset.direction = dir;
    panelEl.appendChild(handle);
  });

  // Determine widget type
  const widgetType = panel.type || (panel.src ? 'iframe' : null);

  // Add widget type to panel for CSS targeting
  if (widgetType) {
    panelEl.dataset.widget = widgetType;
  }

  // Content container for widget
  const content = document.createElement('div');
  content.className = 'panel-content';
  if (widgetType) {
    content.dataset.widget = widgetType;
  }

  // Get dark mode setting from config
  const isDark = config.dark !== false;

  if (widgetType && widgets[widgetType]) {
    // Use registered widget - pass dark mode in options
    widgets[widgetType](content, panel, { refreshIntervals, parseDuration, dark: isDark });
  } else if (panel.src) {
    // Fallback: iframe for legacy configs with just src
    const iframe = document.createElement('iframe');
    let src = toLocalUrl(panel.src);
    const params = new URLSearchParams();
    // Add dark mode param
    params.append('dark', isDark ? 'true' : 'false');
    // Add panel args
    if (panel.args && Object.keys(panel.args).length > 0) {
      for (const [key, value] of Object.entries(panel.args)) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
    }
    const separator = src.includes('?') ? '&' : '?';
    src = src + separator + params.toString();
    iframe.src = src;
    iframe.loading = 'lazy';

    const refreshMs = parseDuration(panel.refresh);
    if (refreshMs) {
      const intervalId = setInterval(() => {
        iframe.src = src;
      }, refreshMs);
      refreshIntervals.push(intervalId);
    }

    content.appendChild(iframe);
  } else {
    // Empty panel
    content.innerHTML = '<div class="empty-panel">No widget configured</div>';
  }

  panelEl.appendChild(content);

  // Drag handlers
  setupPanelDrag(panelEl, screenIndex, panelIndex);

  // Double-click to edit (only when layout is locked)
  panelEl.addEventListener('dblclick', (e) => {
    if (editMode && layoutLocked && !e.target.classList.contains('resize-handle')) {
      openPanelSettings(screenIndex, panelIndex);
    }
  });

  return panelEl;
}

function showScreen(index) {
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => s.classList.remove('active'));

  currentIndex = index;
  if (allScreens[index]) {
    allScreens[index].classList.add('active');
  }

  // Update URL with current screen (preserves other params like ?edit)
  const params = new URLSearchParams(window.location.search);
  params.set('screen', index);
  const newUrl = window.location.pathname + '?' + params.toString();
  history.replaceState(null, '', newUrl);
}

function nextScreen() {
  const next = (currentIndex + 1) % screens.length;
  showScreen(next);
}

function prevScreen() {
  const prev = (currentIndex - 1 + screens.length) % screens.length;
  showScreen(prev);
}

function setupNavigation() {
  document.getElementById('nav-next').addEventListener('click', nextScreen);
  document.getElementById('nav-prev').addEventListener('click', prevScreen);
}

// =====================
// EDIT MODE
// =====================

function setupEditMode() {
  // Check URL for edit mode: ?edit
  if (window.location.search.includes('edit')) {
    editMode = true;
    document.body.classList.add('edit-mode');
  }

  // Escape to close modal or exit edit mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('settings-modal');
      if (modal.classList.contains('open')) {
        closeModal();
      } else if (editMode) {
        toggleEditMode();
      }
    }
  });

  // Edit button (always visible)
  document.getElementById('edit-btn').addEventListener('click', toggleEditMode);

  // Toolbar buttons
  document.getElementById('exit-edit-btn').addEventListener('click', toggleEditMode);
  document.getElementById('toggle-layout-btn').addEventListener('click', toggleLayoutLock);
  document.getElementById('save-btn').addEventListener('click', async () => {
    await saveConfig();
    showAlert('Configuration saved!', 'Saved');
  });
  document.getElementById('add-panel-btn').addEventListener('click', addPanel);
  document.getElementById('notif-settings-btn').addEventListener('click', openNotifSettings);
  document.getElementById('export-btn').addEventListener('click', exportConfig);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', importConfig);
  document.getElementById('reset-btn').addEventListener('click', resetConfig);

  // Modal buttons
  document.getElementById('cancel-panel-btn').addEventListener('click', closeModal);
  document.getElementById('save-panel-btn').addEventListener('click', savePanelSettings);
  document.getElementById('delete-panel-btn').addEventListener('click', deletePanel);
  document.getElementById('add-arg-btn').addEventListener('click', () => addArgRow('', ''));

  // Toggle URL field visibility based on type selection
  document.getElementById('panel-type').addEventListener('change', (e) => {
    const srcLabel = document.getElementById('panel-src-label');
    srcLabel.style.display = e.target.value ? 'none' : '';
  });

  // Close modal on backdrop click
  document.getElementById('settings-modal').addEventListener('click', (e) => {
    if (e.target.id === 'settings-modal') {
      closeModal();
    }
  });
}

function toggleEditMode() {
  if (editMode) {
    // Exit edit mode - redirect to clean URL
    window.location.href = window.location.pathname;
  } else {
    // Enter edit mode - redirect to ?edit
    window.location.href = window.location.pathname + '?edit';
  }
}

function toggleLayoutLock() {
  layoutLocked = !layoutLocked;
  const btn = document.getElementById('toggle-layout-btn');
  if (layoutLocked) {
    document.body.classList.remove('layout-unlocked');
    btn.classList.remove('unlocked');
    btn.textContent = '🔒 Layout';
    btn.title = 'Layout editing enabled - click to allow widget interaction';
  } else {
    document.body.classList.add('layout-unlocked');
    btn.classList.add('unlocked');
    btn.textContent = '🔓 Widgets';
    btn.title = 'Widget interaction enabled - click to edit layout';
  }
}

function setupPanelDrag(panelEl, screenIndex, panelIndex) {
  let isDragging = false;
  let isResizing = false;
  let resizeDir = null;
  let startX, startY;
  let startLeft, startTop, startWidth, startHeight;
  const container = document.getElementById('screens');

  panelEl.addEventListener('mousedown', (e) => {
    if (!editMode || !layoutLocked) return;

    const handle = e.target.closest('.resize-handle');
    if (handle) {
      isResizing = true;
      resizeDir = handle.dataset.direction;
      panelEl.classList.add('resizing');
    } else if (e.target === panelEl || e.target.classList.contains('position-tooltip')) {
      isDragging = true;
      panelEl.classList.add('dragging');
    } else {
      return;
    }

    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(panelEl.style.left);
    startTop = parseFloat(panelEl.style.top);
    startWidth = parseFloat(panelEl.style.width);
    startHeight = parseFloat(panelEl.style.height);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    const containerRect = container.getBoundingClientRect();
    const dx = ((e.clientX - startX) / containerRect.width) * 100;
    const dy = ((e.clientY - startY) / containerRect.height) * 100;

    if (isDragging) {
      let newLeft = snapToGrid(startLeft + dx);
      let newTop = snapToGrid(startTop + dy);

      // Constrain to bounds
      newLeft = Math.max(0, Math.min(100 - startWidth, newLeft));
      newTop = Math.max(0, Math.min(100 - startHeight, newTop));

      panelEl.style.left = newLeft + '%';
      panelEl.style.top = newTop + '%';
      updateTooltip(panelEl);
    }

    if (isResizing) {
      let newLeft = startLeft;
      let newTop = startTop;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // Handle resize directions
      if (resizeDir.includes('e')) {
        newWidth = snapToGrid(startWidth + dx);
      }
      if (resizeDir.includes('w')) {
        const dxSnapped = snapToGrid(dx);
        newLeft = startLeft + dxSnapped;
        newWidth = startWidth - dxSnapped;
      }
      if (resizeDir.includes('s')) {
        newHeight = snapToGrid(startHeight + dy);
      }
      if (resizeDir.includes('n')) {
        const dySnapped = snapToGrid(dy);
        newTop = startTop + dySnapped;
        newHeight = startHeight - dySnapped;
      }

      // Enforce minimums
      if (newWidth < MIN_SIZE) {
        if (resizeDir.includes('w')) {
          newLeft = startLeft + startWidth - MIN_SIZE;
        }
        newWidth = MIN_SIZE;
      }
      if (newHeight < MIN_SIZE) {
        if (resizeDir.includes('n')) {
          newTop = startTop + startHeight - MIN_SIZE;
        }
        newHeight = MIN_SIZE;
      }

      // Constrain to bounds
      newLeft = Math.max(0, newLeft);
      newTop = Math.max(0, newTop);
      if (newLeft + newWidth > 100) newWidth = 100 - newLeft;
      if (newTop + newHeight > 100) newHeight = 100 - newTop;

      panelEl.style.left = newLeft + '%';
      panelEl.style.top = newTop + '%';
      panelEl.style.width = newWidth + '%';
      panelEl.style.height = newHeight + '%';
      updateTooltip(panelEl);
    }
  }

  function onMouseUp() {
    if (isDragging || isResizing) {
      // Check if position/size actually changed before saving
      const newLeft = parseFloat(panelEl.style.left);
      const newTop = parseFloat(panelEl.style.top);
      const newWidth = parseFloat(panelEl.style.width);
      const newHeight = parseFloat(panelEl.style.height);

      const positionChanged =
        newLeft !== startLeft ||
        newTop !== startTop ||
        newWidth !== startWidth ||
        newHeight !== startHeight;

      if (positionChanged) {
        // Update the data
        const panel = screens[screenIndex].panels[panelIndex];
        panel.x = panelEl.style.left;
        panel.y = panelEl.style.top;
        panel.w = panelEl.style.width;
        panel.h = panelEl.style.height;
        saveConfigDebounced(); // Debounced to avoid excessive saves during rapid edits
      }
    }

    isDragging = false;
    isResizing = false;
    resizeDir = null;
    panelEl.classList.remove('dragging', 'resizing');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }
}

function updateTooltip(panelEl) {
  const tooltip = panelEl.querySelector('.position-tooltip');
  if (tooltip) {
    tooltip.textContent = `${panelEl.style.left}, ${panelEl.style.top} | ${panelEl.style.width} x ${panelEl.style.height}`;
  }
}

// =====================
// SETTINGS MODAL
// =====================

function openPanelSettings(screenIndex, panelIndex) {
  editingScreenIndex = screenIndex;
  editingPanelIndex = panelIndex;
  editingPanel = screens[screenIndex].panels[panelIndex];

  // Populate type dropdown with available widgets
  const typeSelect = document.getElementById('panel-type');
  const currentType = editingPanel.type || '';
  typeSelect.innerHTML = '<option value="">URL (iframe)</option>';
  getWidgetTypes()
    .filter((t) => t !== 'iframe')
    .forEach((type) => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      opt.selected = type === currentType;
      typeSelect.appendChild(opt);
    });

  // Show/hide URL field based on type
  const srcLabel = document.getElementById('panel-src-label');
  srcLabel.style.display = currentType && currentType !== 'iframe' ? 'none' : '';

  document.getElementById('panel-src').value = editingPanel.src || '';
  document.getElementById('panel-refresh').value = editingPanel.refresh || '';

  // Populate position/size
  document.getElementById('panel-x').value = editingPanel.x || '0%';
  document.getElementById('panel-y').value = editingPanel.y || '0%';
  document.getElementById('panel-w').value = editingPanel.w || '50%';
  document.getElementById('panel-h').value = editingPanel.h || '50%';

  // Populate args
  const argsList = document.getElementById('args-list');
  argsList.innerHTML = '';
  if (editingPanel.args) {
    Object.entries(editingPanel.args).forEach(([key, value]) => {
      addArgRow(key, value);
    });
  }

  document.getElementById('settings-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('settings-modal').classList.remove('open');
  editingPanel = null;
  editingScreenIndex = null;
  editingPanelIndex = null;
}

function addArgRow(key = '', value = '') {
  const argsList = document.getElementById('args-list');
  const row = document.createElement('div');
  row.className = 'arg-row';
  row.innerHTML = `
    <input type="text" class="arg-key" placeholder="key" value="${key}" />
    <input type="text" class="arg-value" placeholder="value" value="${value}" />
    <button type="button" class="remove-arg">x</button>
  `;
  row.querySelector('.remove-arg').addEventListener('click', () => row.remove());
  argsList.appendChild(row);
}

function savePanelSettings() {
  if (!editingPanel) return;

  const selectedType = document.getElementById('panel-type').value;
  editingPanel.type = selectedType || undefined;
  editingPanel.src = selectedType ? undefined : document.getElementById('panel-src').value;
  editingPanel.refresh = document.getElementById('panel-refresh').value || undefined;

  // Save position/size
  editingPanel.x = document.getElementById('panel-x').value || '0%';
  editingPanel.y = document.getElementById('panel-y').value || '0%';
  editingPanel.w = document.getElementById('panel-w').value || '50%';
  editingPanel.h = document.getElementById('panel-h').value || '50%';

  // Collect args
  const args = {};
  document.querySelectorAll('#args-list .arg-row').forEach((row) => {
    const key = row.querySelector('.arg-key').value.trim();
    const value = row.querySelector('.arg-value').value.trim();
    if (key) {
      args[key] = value;
    }
  });
  editingPanel.args = Object.keys(args).length > 0 ? args : undefined;

  saveConfig();
  closeModal();
  renderScreens();
  showScreen(currentIndex);
}

async function deletePanel() {
  const confirmed = await showConfirm('Delete this panel?', {
    title: 'Delete Panel',
    confirmText: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  screens[editingScreenIndex].panels.splice(editingPanelIndex, 1);
  saveConfig();
  closeModal();
  renderScreens();
  showScreen(currentIndex);
}

function addPanel() {
  if (screens.length === 0) {
    screens.push({ id: 'screen-1', panels: [] });
  }

  screens[currentIndex].panels.push({
    src: '',
    x: '0%',
    y: '0%',
    w: '50%',
    h: '50%',
  });

  saveConfig();
  renderScreens();
  showScreen(currentIndex);

  // Open settings for the new panel
  const newIndex = screens[currentIndex].panels.length - 1;
  openPanelSettings(currentIndex, newIndex);
}

// =====================
// EXPORT / IMPORT / RESET
// =====================

function exportConfig() {
  const data = { config, screens };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard-config.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.screens && Array.isArray(data.screens)) {
        config = data.config || {};
        screens = data.screens;
        saveConfig();
        applyConfig();
        renderScreens();
        showScreen(0);
        showAlert('Configuration imported!', 'Import Complete');
      } else {
        showAlert('Invalid configuration file', 'Import Failed');
      }
    } catch {
      showAlert('Failed to parse configuration file', 'Import Failed');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

async function resetConfig() {
  const confirmed = await showConfirm(
    'Reset to default configuration? This will discard all changes.',
    {
      title: 'Reset Configuration',
      confirmText: 'Reset',
      danger: true,
    }
  );
  if (!confirmed) return;

  // Fetch default template
  const defaultTemplate = await fetchDefaultTemplate();
  if (!defaultTemplate) {
    showAlert('Failed to fetch default template. Reset cancelled.', 'Reset Failed');
    return;
  }

  dashboardConfig = defaultTemplate;
  config = defaultTemplate.global || {};
  screens = defaultTemplate.screens || [];

  // Save to API (uses saveConfig to properly set SSE ignore flag)
  await saveConfig();

  applyConfig();
  renderScreens();
  showScreen(0);
  showAlert('Configuration reset to defaults!', 'Reset Complete');
}

// Load widgets dynamically then initialize
// Dynamic imports avoid circular dependency (widgets import registerWidget from this file)
Promise.all([
  import('./widgets/weather/weather.js'),
  import('./widgets/calendar/calendar.js'),
  import('./widgets/uv/uv.js'),
  import('./widgets/aqi/aqi.js'),
  import('./widgets/drive-time/drive-time.js'),
  import('./widgets/sun-moon/sun-moon.js'),
  import('./widgets/kasa/kasa.js'),
  import('./widgets/wol/wol.js'),
  import('./widgets/brightness/brightness.js'),
]).then(async () => {
  await init();
});
