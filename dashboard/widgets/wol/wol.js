import {
  registerWidget,
  getDashboardConfig,
  updateConfigSection,
  getRelayUrl,
} from '../../script.js';

// Wake on LAN Widget
// Click to open modal, see device status, wake them

function getDevices() {
  try {
    const dashboardConfig = getDashboardConfig();
    return dashboardConfig?.wolDevices || [];
  } catch {
    return [];
  }
}

async function saveDevices(devices) {
  await updateConfigSection('wolDevices', devices);
}

async function pingDevice(ip) {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/ping?ip=${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.online;
  } catch {
    return false;
  }
}

async function wakeDevice(mac) {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mac }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Wake failed');
    return await res.json();
  } catch (err) {
    console.error('WOL error:', err);
    return null;
  }
}

async function lookupMac(ip) {
  try {
    const res = await fetch(`${getRelayUrl()}/wol/mac?ip=${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.mac || null;
  } catch {
    return null;
  }
}

function showConfigModal(dark, onSave) {
  const darkClass = dark ? 'dark' : '';
  const devices = getDevices();

  const modal = document.createElement('div');
  modal.className = `wol-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="wol-modal-content">
      <div class="wol-modal-header">
        <h3>Wake on LAN</h3>
      </div>
      <div class="wol-modal-body">
        <div class="wol-device-list">
          ${devices.length === 0 ? '<p class="wol-empty">No devices configured</p>' : ''}
          ${devices
            .map(
              (d, i) => `
            <div class="wol-device-row" data-index="${i}" data-ip="${d.ip}">
              <span class="wol-device-status" title="Checking...">◌</span>
              <span class="wol-device-name">${d.name}</span>
              <button class="wol-wake-btn" data-mac="${d.mac}" title="Wake">⏻</button>
              <button class="wol-delete-btn" data-index="${i}" title="Remove">×</button>
            </div>
          `
            )
            .join('')}
        </div>
        <button class="wol-show-add-btn" title="Add device">+</button>
        <div class="wol-add-form" style="display: none;">
          <input type="text" class="wol-input wol-name-input" placeholder="Name (e.g., Office PC)">
          <input type="text" class="wol-input wol-ip-input" placeholder="IP (e.g., 192.168.1.100)">
          <div class="wol-mac-row">
            <input type="text" class="wol-input wol-mac-input" placeholder="MAC (e.g., AA:BB:CC:DD:EE:FF)">
            <button class="wol-detect-btn" title="Auto-detect MAC from IP">Detect</button>
          </div>
          <button class="wol-add-btn">Add</button>
        </div>
      </div>
      <div class="wol-modal-actions">
        <button class="wol-modal-close">Close</button>
      </div>
    </div>
  `;

  const nameInput = modal.querySelector('.wol-name-input');
  const ipInput = modal.querySelector('.wol-ip-input');
  const macInput = modal.querySelector('.wol-mac-input');
  const detectBtn = modal.querySelector('.wol-detect-btn');
  const addForm = modal.querySelector('.wol-add-form');
  const showAddBtn = modal.querySelector('.wol-show-add-btn');

  // Toggle add form visibility
  showAddBtn.addEventListener('click', () => {
    const isHidden = addForm.style.display === 'none';
    addForm.style.display = isHidden ? 'flex' : 'none';
    showAddBtn.textContent = isHidden ? '−' : '+';
    if (isHidden) nameInput.focus();
  });

  // Detect MAC button
  detectBtn.addEventListener('click', async () => {
    const ip = ipInput.value.trim();
    if (!ip) {
      ipInput.classList.add('error');
      setTimeout(() => ipInput.classList.remove('error'), 1500);
      return;
    }
    detectBtn.disabled = true;
    detectBtn.textContent = '...';
    const mac = await lookupMac(ip);
    if (mac) {
      macInput.value = mac;
      detectBtn.textContent = '✓';
    } else {
      detectBtn.textContent = '✗';
    }
    setTimeout(() => {
      detectBtn.textContent = 'Detect';
      detectBtn.disabled = false;
    }, 1500);
  });

  // Check status for each device
  modal.querySelectorAll('.wol-device-row').forEach(async (row) => {
    const ip = row.dataset.ip;
    const statusEl = row.querySelector('.wol-device-status');
    if (ip) {
      const online = await pingDevice(ip);
      statusEl.textContent = online ? '●' : '○';
      statusEl.classList.add(online ? 'online' : 'offline');
      statusEl.title = online ? 'Online' : 'Offline';
    } else {
      statusEl.textContent = '?';
      statusEl.title = 'No IP configured';
    }
  });

  // Wake buttons
  modal.querySelectorAll('.wol-wake-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '...';
      const result = await wakeDevice(btn.dataset.mac);
      btn.textContent = result ? '✓' : '✗';
      setTimeout(() => {
        btn.textContent = '⏻';
        btn.disabled = false;
      }, 2000);
    });
  });

  // Delete buttons
  modal.querySelectorAll('.wol-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      const devices = getDevices();
      devices.splice(idx, 1);
      saveDevices(devices);
      modal.remove();
      showConfigModal(dark, onSave);
    });
  });

  // Add button
  modal.querySelector('.wol-add-btn').addEventListener('click', () => {
    const name = nameInput.value.trim();
    const ip = ipInput.value.trim();
    const mac = macInput.value.trim().toUpperCase();

    if (!name || !mac) return;
    if (!/^([0-9A-F]{2}[:-]){5}[0-9A-F]{2}$/i.test(mac)) {
      macInput.classList.add('error');
      return;
    }

    const devices = getDevices();
    devices.push({ name, ip, mac });
    saveDevices(devices);
    modal.remove();
    showConfigModal(dark, onSave);
    onSave();
  });

  // Close
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('wol-modal-close')) {
      modal.remove();
      onSave();
    }
  });

  document.body.appendChild(modal);
}

function renderWidget(container, dark, onOpen) {
  const darkClass = dark ? 'dark' : '';
  const devices = getDevices();
  const count = devices.length;

  container.innerHTML = `
    <div class="wol-widget ${darkClass}">
      <button class="wol-open-btn" title="Wake on LAN">
        <span class="wol-icon">⚡</span>
        ${count > 0 ? `<span class="wol-count">${count}</span>` : ''}
      </button>
    </div>
  `;

  container.querySelector('.wol-open-btn').addEventListener('click', onOpen);
}

function renderWolWidget(container, _panel, { dark = true }) {
  function refresh() {
    renderWidget(container, dark, () => showConfigModal(dark, refresh));
  }
  refresh();
}

registerWidget('wol', renderWolWidget);
