// Uses an already-running headless Chromium CDP endpoint and the built app's preview.
// Google/relay calls are intercepted with fictional data; nothing contacts production.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../screenshots/', import.meta.url));
const feed = JSON.parse(await readFile(`${directory}/demo-feed.json`, 'utf8'));
const preview = process.env.CLOCK_PREVIEW_URL ?? 'http://127.0.0.1:5284/clock/';
const cdp = process.env.CLOCK_CDP_URL ?? 'http://127.0.0.1:9224';
const tab = await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' }).then((response) =>
  response.json(),
);
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
const failures = [];
let requests = 0;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 10000);
    pending.set(id, { resolve, reject, timeout });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (request) {
    clearTimeout(request.timeout);
    pending.delete(message.id);
    message.error
      ? request.reject(new Error(message.error.message))
      : request.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown')
    failures.push(message.params.exceptionDetails.text);
  if (message.method === 'Fetch.requestPaused') {
    const paused = message.params;
    requests++;
    const preflight = paused.request.method === 'OPTIONS';
    const auth = Object.entries(paused.request.headers).find(
      ([name]) => name.toLowerCase() === 'authorization',
    )?.[1];
    const authorized = preflight || auth === 'Bearer fictional-demo-read-key';
    void send('Fetch.fulfillRequest', {
      requestId: paused.requestId,
      responseCode: preflight ? 204 : authorized ? 200 : 401,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Headers', value: 'authorization, content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { name: 'Access-Control-Allow-Private-Network', value: 'true' },
        { name: 'Cache-Control', value: 'no-store' },
      ],
      body: Buffer.from(
        preflight ? '' : JSON.stringify(authorized ? feed : { detail: 'Invalid key' }),
      ).toString('base64'),
    }).catch((error) => failures.push(error.message));
  }
});

const shared = {
  seconds: '1',
  showTime: '1',
  showSolarTimes: '0',
  date: 'weekdayDate',
  hourLabels: '24h',
  lat: '40.7128',
  lng: '-74.006',
  theme: 'dark',
  f: '1',
  calendarRelay: 'http://127.0.0.1:5999',
  calendarKey: 'fictional-demo-read-key',
  calendarFilter: '0',
  calendars: '[]',
  eventStyle: 'band',
  eventPlacement: 'outside',
  showEventNames: '0',
  showEventList: '0',
  showCalendarLegend: '1',
  showCalendarStatus: '0',
  calendarPollSeconds: '60',
  eventColor: '',
  dayColor: '#dcd4bd',
  nightColor: '#293544',
  handColor: '#f4efe4',
  secondColor: '#d88d77',
};
const light = {
  theme: 'light',
  dayColor: '#f1e9d9',
  nightColor: '#424959',
  handColor: '#a56950',
  secondColor: '#9b6f86',
};
const variants = [
  ['circle-bands-outside-dark', { mode: 'circle' }],
  [
    'circle-bands-inside-light',
    { mode: 'circle', ...light, eventPlacement: 'inside', hourLabels: '12h', showSolarTimes: '1' },
  ],
  ['circle-dots-outside-dark', { mode: 'circle', eventStyle: 'dot', hourLabels: '12h' }],
  [
    'circle-dots-inside-light',
    { mode: 'circle', ...light, eventStyle: 'dot', eventPlacement: 'inside', showEventNames: '1' },
  ],
  ['rectangle-bands-below-dark', { mode: 'linear', date: 'monthDay' }],
  [
    'rectangle-bands-above-light',
    { mode: 'linear', ...light, eventPlacement: 'inside', showEventNames: '1', hourLabels: '12h' },
  ],
  [
    'rectangle-dots-below-dark',
    { mode: 'linear', eventStyle: 'dot', eventColor: '#b3a0cf', showCalendarLegend: '0' },
  ],
  [
    'rectangle-dots-above-light',
    {
      mode: 'linear',
      ...light,
      eventStyle: 'dot',
      eventPlacement: 'inside',
      date: 'iso',
      hourLabels: '12h',
    },
  ],
  ['circle-agenda-dark', { mode: 'circle', showEventList: '1', hourLabels: '12h' }],
  [
    'rectangle-agenda-light',
    { mode: 'linear', ...light, showEventList: '1', eventPlacement: 'inside', showSolarTimes: '1' },
  ],
  [
    'circle-minimal-dark',
    {
      mode: 'circle',
      showTime: '0',
      seconds: '0',
      date: 'none',
      showCalendarLegend: '0',
      calendarFilter: '1',
      calendars: '["family-demo"]',
      hourLabels: '12h',
    },
  ],
  [
    'rectangle-minimal-light',
    {
      mode: 'linear',
      ...light,
      showTime: '0',
      seconds: '0',
      date: 'none',
      showCalendarLegend: '0',
      eventStyle: 'none',
      hourLabels: '12h',
    },
  ],
];

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setTimezoneOverride', { timezoneId: 'America/New_York' });
  await send('Fetch.enable', { patterns: [{ urlPattern: 'http://127.0.0.1:5999/*' }] });
  const stamp = new Date(feed.updated_at).getTime();
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `{
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { if (args.length) super(...args); else super(${stamp}); }
      static now() { return ${stamp}; }
    };
  }`,
  });
  await mkdir(directory, { recursive: true });
  const demos = [];
  for (const [name, overrides] of variants) {
    const options = { ...shared, ...overrides };
    const circle = options.mode === 'circle';
    await send('Emulation.setDeviceMetricsOverride', {
      width: circle ? 960 : 1280,
      height: circle ? 960 : 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const url = new URL(preview);
    url.search = new URLSearchParams(options).toString();
    await send('Page.navigate', { url: url.toString() });
    await new Promise((resolve) => setTimeout(resolve, 650));
    const state = await send('Runtime.evaluate', {
      expression: `JSON.stringify({text:document.body.innerText, controls:!!document.querySelector('.clock-controls'), legends:document.querySelectorAll('.clock-calendar-legend span.truncate').length, dark:document.documentElement.classList.contains('dark')})`,
    });
    const result = JSON.parse(state.result.value);
    if (result.controls || result.dark !== (options.theme === 'dark'))
      throw new Error(`URL controls/theme failed for ${name}`);
    if (options.showCalendarLegend === '1' && !result.legends)
      throw new Error(`Calendar feed/legend missing for ${name}`);
    if (options.showEventList === '1' && !result.text.includes('Summer solstice'))
      throw new Error(`Agenda missing for ${name}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${directory}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
    demos.push({ file: `${name}.png`, options });
    console.log(`Saved ${name}.png`);
  }
  // Explicit browser smoke check: deselecting every calendar must keep all marks/legend off.
  const empty = new URL(preview);
  empty.search = new URLSearchParams({
    ...shared,
    mode: 'circle',
    calendarFilter: '1',
    calendars: '[]',
    showEventList: '1',
  }).toString();
  await send('Page.navigate', { url: empty.toString() });
  await new Promise((resolve) => setTimeout(resolve, 650));
  const state = await send('Runtime.evaluate', { expression: 'document.body.innerText' });
  if (!state.result.value.includes('No events today'))
    throw new Error('Empty calendar filter failed');
  if (failures.length) throw new Error(`Browser exceptions: ${failures.join(', ')}`);
  if (requests < variants.length) throw new Error('Expected calendar feed requests were missing');
  await writeFile(`${directory}/demo-options.json`, `${JSON.stringify(demos, null, 2)}\n`);
  for (const mode of ['circle', 'rectangle']) {
    const entries = await Promise.all(
      demos
        .filter((demo) => demo.file.startsWith(mode))
        .map(async (demo) => ({
          name: demo.file.replace('.png', '').replaceAll('-', ' '),
          image: `data:image/png;base64,${(await readFile(`${directory}/${demo.file}`)).toString('base64')}`,
        })),
    );
    const result = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
      const entries = ${JSON.stringify(entries)};
      const circle = ${mode === 'circle'};
      const columns = circle ? 3 : 2;
      const cellWidth = circle ? 320 : 640;
      const imageHeight = circle ? 320 : 360;
      const cellHeight = imageHeight + 32;
      const canvas = document.createElement('canvas');
      canvas.width = columns * cellWidth;
      canvas.height = Math.ceil(entries.length / columns) * cellHeight;
      const ctx = canvas.getContext('2d');
      const style = getComputedStyle(document.documentElement);
      ctx.fillStyle = style.getPropertyValue('--color-surface').trim();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
      for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const image = new Image(); image.src = entry.image;
        await image.decode();
        const x = (index % columns) * cellWidth;
        const y = Math.floor(index / columns) * cellHeight;
        ctx.drawImage(image, x, y, cellWidth, imageHeight);
        ctx.fillStyle = style.getPropertyValue('--color-text').trim();
        ctx.fillText(entry.name, x + cellWidth / 2, y + imageHeight + 21);
      }
      return canvas.toDataURL('image/png').split(',')[1];
    })()`,
    });
    await writeFile(`${directory}/${mode}-gallery.png`, Buffer.from(result.result.value, 'base64'));
  }
  console.log(
    `Browser smoke checks passed; ${requests} fictional feed/preflight requests intercepted.`,
  );
} finally {
  await send('Page.close').catch(() => {});
  socket.close();
}
