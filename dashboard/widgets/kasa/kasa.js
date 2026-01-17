import { registerWidget, getRelayUrl } from '../../script.js';

// Kasa Smart Device Widget
// Click button to open modal, see devices, toggle on/off

async function discoverDevices() {
  try {
    const res = await fetch(`${getRelayUrl()}/kasa/discover`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('Discovery failed');
    return await res.json();
  } catch (err) {
    console.warn('Kasa discovery failed:', err.message);
    return null;
  }
}

async function toggleDevice(ip) {
  try {
    const res = await fetch(`${getRelayUrl()}/kasa/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error('Toggle failed');
    return await res.json();
  } catch (err) {
    console.error('Kasa toggle error:', err);
    return null;
  }
}

function showModal(dark, onClose) {
  const darkClass = dark ? 'dark' : '';

  const modal = document.createElement('div');
  modal.className = `kasa-modal open ${darkClass}`;
  modal.innerHTML = `
    <div class="kasa-modal-content">
      <div class="kasa-modal-header">
        <h3>Smart Devices</h3>
      </div>
      <div class="kasa-modal-body">
        <div class="kasa-device-list">
          <p class="kasa-loading-text">Discovering devices...</p>
        </div>
      </div>
      <div class="kasa-modal-actions">
        <button class="kasa-modal-close">Close</button>
      </div>
    </div>
  `;

  const listEl = modal.querySelector('.kasa-device-list');

  async function loadDevices() {
    const devices = await discoverDevices();

    if (!devices || devices.length === 0) {
      listEl.innerHTML = '<p class="kasa-empty-text">No devices found</p>';
      return;
    }

    listEl.innerHTML = devices
      .map(
        (d) => `
        <div class="kasa-device-row">
          <span class="kasa-device-status ${d.on ? 'on' : 'off'}">${d.on ? '●' : '○'}</span>
          <span class="kasa-device-name">${d.name}</span>
          <button class="kasa-toggle-btn ${d.on ? 'on' : 'off'}" data-ip="${d.ip}">
            ${d.on ? 'Turn Off' : 'Turn On'}
          </button>
        </div>
      `
      )
      .join('');

    listEl.querySelectorAll('.kasa-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = '...';
        const result = await toggleDevice(btn.dataset.ip);
        if (result) {
          btn.classList.toggle('on', result.on);
          btn.classList.toggle('off', !result.on);
          btn.textContent = result.on ? 'Turn Off' : 'Turn On';
          const row = btn.closest('.kasa-device-row');
          const status = row.querySelector('.kasa-device-status');
          status.classList.toggle('on', result.on);
          status.classList.toggle('off', !result.on);
          status.textContent = result.on ? '●' : '○';
        }
        btn.disabled = false;
      });
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('kasa-modal-close')) {
      modal.remove();
      onClose();
    }
  });

  document.body.appendChild(modal);
  loadDevices();
}

function renderWidget(container, dark, onOpen) {
  const darkClass = dark ? 'dark' : '';

  container.innerHTML = `
    <div class="kasa-widget ${darkClass}">
      <button class="kasa-open-btn" title="Smart Devices">🔌</button>
    </div>
  `;

  container.querySelector('.kasa-open-btn').addEventListener('click', onOpen);
}

function renderKasaWidget(container, _panel, { dark = true }) {
  function refresh() {
    renderWidget(container, dark, () => showModal(dark, refresh));
  }
  refresh();
}

registerWidget('kasa', renderKasaWidget);
