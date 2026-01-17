import './style.css';
import { getWidgetRenderer, getWidgetTypes } from './widget-registry.js';

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

// Check if running on localhost (for iframe URL handling)
const isLocalDev =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const PROD_ORIGIN = 'https://dak.bkemper.me';

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

// Convert URLs for iframe panels based on environment
// - In localMode (?local): map to local dev servers
// - In isLocalDev (localhost without ?local): map relative URLs to production
function toLocalUrl(url) {
  if (!url) return url;

  // In local mode, map to local dev servers
  if (localMode) {
    for (const [prod, local] of Object.entries(LOCAL_URL_MAP)) {
      if (url.startsWith(prod)) {
        return url.replace(prod, local);
      }
    }
    return url;
  }

  // On localhost (not in local mode), map relative URLs to production
  if (isLocalDev && url.startsWith('/') && !url.startsWith('//')) {
    return PROD_ORIGIN + url;
  }

  return url;
}

// Re-export for backwards compatibility (widgets that import from script.js)
export { getWidgetTypes };

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

/**
 * Get a specific section of the config
 * @param {string} section - The config section name (e.g., 'calendar', 'locations')
 * @param {*} defaultValue - Default value if section doesn't exist
 */
export function getConfigSection(section, defaultValue = null) {
  return dashboardConfig?.[section] ?? defaultValue;
}

// Update a specific section of the config and save (to both API and localStorage)
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

  const widgetRenderer = widgetType && getWidgetRenderer(widgetType);
  if (widgetRenderer) {
    // Use registered widget - pass dark mode in options
    widgetRenderer(content, panel, { refreshIntervals, parseDuration, dark: isDark });
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
  // Capture panel references before showing confirm (in case modal state changes)
  const screenIdx = editingScreenIndex;
  const panelIdx = editingPanelIndex;

  const confirmed = await showConfirm('Delete this panel?', {
    title: 'Delete Panel',
    confirmText: 'Delete',
    danger: true,
  });
  if (!confirmed) return;

  // Validate indices before splicing
  if (screenIdx == null || panelIdx == null) {
    console.error('deletePanel: invalid indices', { screenIdx, panelIdx });
    return;
  }
  if (!screens[screenIdx] || !screens[screenIdx].panels) {
    console.error('deletePanel: screen not found', { screenIdx, screens });
    return;
  }

  screens[screenIdx].panels.splice(panelIdx, 1);
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
  // Export full dashboard config including all widget settings
  // dashboardConfig includes: global, screens, locations, driveTime, wolDevices, brightness, calendar, etc.
  const data = {
    ...dashboardConfig,
    global: config,
    screens,
  };
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
  reader.onload = async (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.screens && Array.isArray(data.screens) && data.global) {
        config = data.global;
        screens = data.screens;
        dashboardConfig = data;

        await saveConfig();
        applyConfig();
        renderScreens();
        showScreen(0);
        showAlert('Configuration imported!', 'Import Complete');
      } else {
        showAlert(
          'Invalid configuration file. Expected: { global, screens, ... }',
          'Import Failed'
        );
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
