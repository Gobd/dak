import data from './screens.js';

let screens = [];
let config = {};
let currentIndex = 0;
const refreshIntervals = [];

// Parse duration string like '30s', '30m', '1h', '24h' to milliseconds
function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(s|m|h)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    default: return null;
  }
}

function init() {
  config = data.config || {};
  screens = data.screens || [];

  applyConfig();
  renderScreens();
  showScreen(0);
  setupNavigation();
}

function applyConfig() {
  const btn = document.getElementById('nav-btn');
  const pos = config.navPosition || 'bottom-right';

  // Reset positions
  btn.style.top = '';
  btn.style.bottom = '';
  btn.style.left = '';
  btn.style.right = '';

  // Apply position
  if (pos.includes('top')) btn.style.top = '20px';
  if (pos.includes('bottom')) btn.style.bottom = '20px';
  if (pos.includes('left')) btn.style.left = '20px';
  if (pos.includes('right')) btn.style.right = '20px';

  // Apply color
  if (config.navColor) btn.style.color = config.navColor;
  if (config.navBackground) btn.style.background = config.navBackground;
}

function renderScreens() {
  const container = document.getElementById('screens');
  container.innerHTML = '';

  screens.forEach((screen, index) => {
    const screenEl = document.createElement('div');
    screenEl.className = 'screen';
    screenEl.dataset.index = index;

    screen.panels.forEach((panel) => {
      const panelEl = document.createElement('div');
      panelEl.className = 'panel';
      panelEl.style.left = panel.x;
      panelEl.style.top = panel.y;
      panelEl.style.width = panel.w;
      panelEl.style.height = panel.h;

      if (panel.css) {
        panelEl.style.cssText += panel.css;
      }

      const iframe = document.createElement('iframe');
      iframe.src = panel.src;
      iframe.loading = 'lazy';

      // Set up refresh interval if specified
      const refreshMs = parseDuration(panel.refresh);
      if (refreshMs) {
        const intervalId = setInterval(() => {
          iframe.src = panel.src;
        }, refreshMs);
        refreshIntervals.push(intervalId);
      }

      panelEl.appendChild(iframe);
      screenEl.appendChild(panelEl);
    });

    container.appendChild(screenEl);
  });
}

function showScreen(index) {
  const allScreens = document.querySelectorAll('.screen');
  allScreens.forEach((s) => s.classList.remove('active'));

  currentIndex = index;
  if (allScreens[index]) {
    allScreens[index].classList.add('active');
  }
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
  // Button click
  document.getElementById('nav-btn').addEventListener('click', nextScreen);

  // Swipe detection
  let touchStartX = 0;
  let touchEndX = 0;
  const minSwipeDistance = 50;

  document.addEventListener(
    'touchstart',
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchend',
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const distance = touchEndX - touchStartX;

      if (Math.abs(distance) > minSwipeDistance) {
        if (distance < 0) {
          nextScreen(); // Swipe left -> next
        } else {
          prevScreen(); // Swipe right -> prev
        }
      }
    },
    { passive: true }
  );
}

init();
