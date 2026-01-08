import defaultData from './screens.js';

const STORAGE_KEY = 'dashboard-config';
const GRID_SNAP = 5; // 5% snap
const MIN_SIZE = 10; // 10% minimum

let screens = [];
let config = {};
let currentIndex = 0;
let editMode = false;
const refreshIntervals = [];

// Widget registry - widgets register themselves here
const widgets = {};

export function registerWidget(type, renderFn) {
  widgets[type] = renderFn;
}

// Get available widget types for UI
export function getWidgetTypes() {
  return Object.keys(widgets);
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

// Load config from localStorage, merged with defaults from screens.js
function loadConfig() {
  // Start with defaults
  config = { ...defaultData.config };
  screens = JSON.parse(JSON.stringify(defaultData.screens));

  // Override with stored values if present
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      // Merge config (stored overrides defaults)
      config = { ...config, ...(parsed.config || {}) };
      // Use stored screens if present
      if (parsed.screens && parsed.screens.length > 0) {
        screens = parsed.screens;
      }
    } catch {
      console.warn('Failed to parse stored config, using defaults');
    }
  }
}

// Save config to localStorage
function saveConfig() {
  const data = { config, screens };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function init() {
  loadConfig();
  applyConfig();
  renderScreens();

  // Check URL for screen param: ?screen=1 (0-indexed)
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get('screen');
  const startScreen = screenParam ? parseInt(screenParam, 10) : 0;
  showScreen(Math.min(startScreen, screens.length - 1));

  setupNavigation();
  setupEditMode();
}

function applyConfig() {
  // Background color
  if (config.background) {
    document.body.style.background = config.background;
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

  // Content container for widget
  const content = document.createElement('div');
  content.className = 'panel-content';

  if (widgetType && widgets[widgetType]) {
    // Use registered widget
    widgets[widgetType](content, panel, { refreshIntervals, parseDuration });
  } else if (panel.src) {
    // Fallback: iframe for legacy configs with just src
    const iframe = document.createElement('iframe');
    let src = panel.src;
    if (panel.args && Object.keys(panel.args).length > 0) {
      const separator = src.includes('?') ? '&' : '?';
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(panel.args)) {
        if (Array.isArray(value)) {
          value.forEach((v) => params.append(key, v));
        } else {
          params.append(key, value);
        }
      }
      src = src + separator + params.toString();
    }
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

  // Double-click to edit
  panelEl.addEventListener('dblclick', (e) => {
    if (editMode && !e.target.classList.contains('resize-handle')) {
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
  document.getElementById('save-btn').addEventListener('click', () => {
    saveConfig();
    alert('Configuration saved!');
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

function setupPanelDrag(panelEl, screenIndex, panelIndex) {
  let isDragging = false;
  let isResizing = false;
  let resizeDir = null;
  let startX, startY;
  let startLeft, startTop, startWidth, startHeight;
  const container = document.getElementById('screens');

  panelEl.addEventListener('mousedown', (e) => {
    if (!editMode) return;

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
      // Update the data
      const panel = screens[screenIndex].panels[panelIndex];
      panel.x = panelEl.style.left;
      panel.y = panelEl.style.top;
      panel.w = panelEl.style.width;
      panel.h = panelEl.style.height;
      saveConfig();
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

  editingPanel.src = document.getElementById('panel-src').value;
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

function deletePanel() {
  if (!confirm('Delete this panel?')) return;

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
        alert('Configuration imported!');
      } else {
        alert('Invalid configuration file');
      }
    } catch {
      alert('Failed to parse configuration file');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function resetConfig() {
  if (!confirm('Reset to default configuration? This will discard all changes.')) return;

  localStorage.removeItem(STORAGE_KEY);
  config = { ...defaultData.config };
  screens = JSON.parse(JSON.stringify(defaultData.screens));
  applyConfig();
  renderScreens();
  showScreen(0);
  alert('Configuration reset to defaults!');
}

// Load widgets dynamically then initialize
// Dynamic imports avoid circular dependency (widgets import registerWidget from this file)
Promise.all([
  import('./widgets/weather/weather.js'),
  import('./widgets/calendar/calendar.js'),
]).then(() => {
  init();
});
