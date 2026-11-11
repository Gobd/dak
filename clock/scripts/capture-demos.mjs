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
    const weather = paused.request.url.startsWith('https://api.open-meteo.com/');
    if (!weather && !preflight && auth)
      failures.push('Clock sent credentials to keyless calendar read endpoint');
    const weatherFeed = {
      daily: {
        time: ['2026-06-21', '2026-06-22'],
        weather_code: [2, 61],
        temperature_2m_min: [65, 63],
        temperature_2m_max: [82, 76],
        precipitation_probability_max: [15, 70],
      },
    };
    void send('Fetch.fulfillRequest', {
      requestId: paused.requestId,
      responseCode: preflight ? 204 : 200,
      responseHeaders: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: '*' },
        { name: 'Access-Control-Allow-Headers', value: 'authorization, content-type' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
        { name: 'Access-Control-Allow-Private-Network', value: 'true' },
        { name: 'Cache-Control', value: 'no-store' },
      ],
      body: Buffer.from(preflight ? '' : JSON.stringify(weather ? weatherFeed : feed)).toString(
        'base64',
      ),
    }).catch((error) => failures.push(error.message));
  }
});

const shared = {
  rectangleBar: 'top',
  digitalTimeFormat: '24h',
  barColor: '',
  barTextColor: '',
  wipePast: '0',
  wipeColor: '',
  wipeOpacity: '85',
  showTimeMarker: '1',
  showSecondsMarker: '1',
  showWeather: '0',
  showTomorrowWeather: '0',
  weatherUnit: 'fahrenheit',
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
  [
    'rectangle-wipe-top-weather',
    {
      mode: 'linear',
      digitalTimeFormat: '12h',
      barColor: '#000000',
      barTextColor: '#f4efe4',
      wipePast: '1',
      wipeColor: '#000000',
      wipeOpacity: '100',
      showTimeMarker: '0',
      showSecondsMarker: '0',
      showWeather: '1',
      showTomorrowWeather: '1',
      showEventNames: '1',
      eventPlacement: 'inside',
      showSolarTimes: '1',
    },
  ],
  [
    'rectangle-wipe-bottom-weather',
    {
      mode: 'linear',
      ...light,
      rectangleBar: 'bottom',
      barColor: '#f1e9d9',
      barTextColor: '#293544',
      wipePast: '1',
      wipeColor: '#293544',
      wipeOpacity: '65',
      showTimeMarker: '0',
      showSecondsMarker: '0',
      showWeather: '1',
      showTomorrowWeather: '1',
      showEventList: '1',
      showSolarTimes: '1',
    },
  ],
  [
    'rectangle-tomorrow-weather',
    {
      mode: 'linear',
      ...light,
      showTomorrowWeather: '1',
      seconds: '0',
    },
  ],
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
  await send('Fetch.enable', {
    patterns: [
      { urlPattern: 'http://127.0.0.1:5999/*' },
      { urlPattern: 'https://api.open-meteo.com/*' },
    ],
  });
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
    if (options.showWeather === '1' && !result.text.includes('Today'))
      throw new Error(`Today weather missing: ${name}`);
    if (options.showTomorrowWeather === '1' && !result.text.includes('Tomorrow'))
      throw new Error(`Tomorrow weather missing: ${name}`);
    if (options.wipePast === '1') {
      const pixels = await send('Runtime.evaluate', {
        expression: `JSON.stringify((() => {
          const c = document.querySelectorAll('.clock-canvas canvas')[1];
          const ctx = c.getContext('2d');
          return [ctx.getImageData(10, 100, 1, 1).data[3], ctx.getImageData(c.width - 10, 100, 1, 1).data[3]];
        })())`,
      });
      const [past, future] = JSON.parse(pixels.result.value);
      if (Math.abs(past - (255 * Number(options.wipeOpacity)) / 100) > 1 || future !== 0)
        throw new Error(`Wipe alpha/bounds failed: ${name}`);
    }
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    await writeFile(`${directory}/${name}.png`, Buffer.from(screenshot.data, 'base64'));
    demos.push({ file: `${name}.png`, options });
    console.log(`Saved ${name}.png`);
  }
  // Exercise the real settings form: unsaved changes must be in Copy display URL.
  const formUrl = new URL(preview);
  formUrl.search = new URLSearchParams({ ...shared, ...variants[0][1], f: '0' }).toString();
  formUrl.searchParams.set('calendarKey', 'obsolete-read-key');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Page.navigate', { url: formUrl.toString() });
  await new Promise((resolve) => setTimeout(resolve, 650));
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[aria-label="Clock settings"]').click()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await send('Runtime.evaluate', {
    expression: `(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
      const form = document.querySelector('form');
      const change = (element, value, prototype) => {
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
        element.dispatchEvent(new Event('change', { bubbles: true }));
        element.dispatchEvent(new Event('input', { bubbles: true }));
      };
      change([...form.querySelectorAll('select')].find(el => el.value === 'top'), 'bottom', HTMLSelectElement.prototype);
      change([...form.querySelectorAll('select')].find(el => el.value === 'fahrenheit'), 'celsius', HTMLSelectElement.prototype);
      change(form.querySelector('input[type="range"]'), '42', HTMLInputElement.prototype);
      change(form.querySelector('input[aria-label="Bar background color"]'), '#123456', HTMLInputElement.prototype);
      change(form.querySelector('input[aria-label="Bar text color"]'), '#ffffff', HTMLInputElement.prototype);
    })()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const settingsScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    `${directory}/rectangle-settings.png`,
    Buffer.from(settingsScreenshot.data, 'base64'),
  );
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('form button')].find(el => el.textContent === 'Copy display URL').click()`,
    userGesture: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const copied = await send('Runtime.evaluate', {
    expression: `document.querySelector('form textarea')?.value`,
  });
  const copiedUrl = new URL(copied.result.value);
  if (copiedUrl.searchParams.has('calendarKey'))
    throw new Error('Copy URL retained obsolete calendar read key');
  const expected = {
    ...shared,
    ...variants[0][1],
    rectangleBar: 'bottom',
    weatherUnit: 'celsius',
    wipeOpacity: '42',
    barColor: '#123456',
    barTextColor: '#ffffff',
  };
  for (const [key, value] of Object.entries(expected)) {
    if (key !== 'theme' && copiedUrl.searchParams.get(key) !== value)
      throw new Error(
        `Copy URL lost unsaved setting ${key}: expected ${value}, got ${copiedUrl.searchParams.get(key)}`,
      );
  }
  console.log(
    'Actual Copy display URL button preserved all settings, including unsaved bar/unit/opacity changes.',
  );
  await send('Runtime.evaluate', {
    expression: `document.querySelector('input[aria-label="Wipe color"]').scrollIntoView({block:'start'})`,
  });
  const wipeSettings = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    `${directory}/rectangle-wipe-settings.png`,
    Buffer.from(wipeSettings.data, 'base64'),
  );

  // Apply real preset buttons, copy their materialized colors/theme, then capture the kiosk URL.
  for (const [id, name, dark] of [
    ['midnight', 'Midnight', true],
    ['paper', 'Paper', false],
    ['sand', 'Sand', false],
    ['dusk', 'Dusk', true],
    ['slate-cream', 'Slate & Cream', true],
  ]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: formUrl.toString() });
    await new Promise((resolve) => setTimeout(resolve, 650));
    await send('Runtime.evaluate', {
      expression: `document.querySelector('button[aria-label="Clock settings"]').click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await send('Runtime.evaluate', {
      expression: `[...document.querySelectorAll('form button')].find(el => el.textContent.startsWith('${name}')).click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    await send('Runtime.evaluate', {
      expression: `(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
      [...document.querySelectorAll('form button')].find(el => el.textContent === 'Copy display URL').click();
    })()`,
      userGesture: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const state = await send('Runtime.evaluate', {
      expression: `document.querySelector('form textarea').value`,
    });
    const themeUrl = new URL(state.result.value);
    if (themeUrl.searchParams.get('theme') !== (dark ? 'dark' : 'light'))
      throw new Error(`Preset theme mode lost: ${name}`);
    for (const key of [
      'dayColor',
      'nightColor',
      'handColor',
      'secondColor',
      'barColor',
      'barTextColor',
      'wipeColor',
    ])
      if (!/^#[0-9a-f]{6}$/i.test(themeUrl.searchParams.get(key)))
        throw new Error(`Preset color lost: ${name} ${key}`);
    await send('Page.navigate', { url: themeUrl.toString() });
    await new Promise((resolve) => setTimeout(resolve, 650));
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const file = `rectangle-theme-${id}.png`;
    await writeFile(`${directory}/${file}`, Buffer.from(screenshot.data, 'base64'));
    demos.push({ file, options: Object.fromEntries(themeUrl.searchParams) });
    console.log(`Saved ${file}; real preset + Copy URL verified.`);
  }

  // Weather help text must not resize/recenter the dialog or overflow narrow screens.
  for (const [width, height] of [
    [960, 1100],
    [390, 844],
  ]) {
    const layoutUrl = new URL(formUrl);
    layoutUrl.searchParams.set('showWeather', '0');
    layoutUrl.searchParams.set('showTomorrowWeather', '0');
    layoutUrl.searchParams.set('wipePast', '0');
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send('Page.navigate', { url: layoutUrl.toString() });
    await new Promise((resolve) => setTimeout(resolve, 650));
    await send('Runtime.evaluate', {
      expression: `document.querySelector('button[aria-label="Clock settings"]').click()`,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const measure = async () => {
      const result = await send('Runtime.evaluate', {
        expression: `JSON.stringify((() => {
        const panel = document.querySelector('[role="dialog"]').firstElementChild;
        const scroller = document.querySelector('.clock-settings-form').parentElement.parentElement;
        const rect = panel.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
          overflow: scroller.scrollWidth > scroller.clientWidth + 1 };
      })())`,
      });
      return JSON.parse(result.result.value);
    };
    for (const [shape, secondsLabel] of [
      ['Linear / rectangle', 'Digital seconds & optional sweep'],
      ['Circular', 'Smooth second hand'],
      ['Linear / rectangle', 'Digital seconds & optional sweep'],
    ]) {
      await send('Runtime.evaluate', {
        expression: `[...document.querySelectorAll('form button')].find(el => el.textContent === ${JSON.stringify(shape)}).click()`,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const labelState = await send('Runtime.evaluate', {
        expression: `document.querySelector('form').textContent.includes(${JSON.stringify(secondsLabel)})`,
      });
      if (!labelState.result.value) throw new Error(`Incorrect seconds label for ${shape}`);
    }
    const before = await measure();
    for (const label of [
      "Today's weather in info bar",
      "Tomorrow's weather in info bar",
      "Today's weather in info bar",
      "Tomorrow's weather in info bar",
    ]) {
      await send('Runtime.evaluate', {
        expression: `[...document.querySelectorAll('form label')].find(el => el.textContent === ${JSON.stringify(label)}).querySelector('button').click()`,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const after = await measure();
      for (const key of ['x', 'y', 'width', 'height'])
        if (Math.abs(after[key] - before[key]) > 1)
          throw new Error(`Weather toggle moved dialog ${key} at ${width}px`);
      if (after.overflow || after.x < 0 || after.x + after.width > width)
        throw new Error(`Weather help text overflows dialog at ${width}px`);
    }
    console.log(
      `Weather toggles keep stable dialog bounds without horizontal overflow at ${width}px.`,
    );
  }

  // Geolocation is explicit, fills draft fields only, and survives Copy URL without keys.
  await send('Emulation.setDeviceMetricsOverride', {
    width: 960,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send('Browser.grantPermissions', {
    origin: new URL(preview).origin,
    permissions: ['geolocation'],
  });
  await send('Emulation.setGeolocationOverride', {
    latitude: 47.6062,
    longitude: -122.3321,
    accuracy: 10,
  });
  await send('Page.navigate', { url: formUrl.toString() });
  await new Promise((resolve) => setTimeout(resolve, 650));
  await send('Runtime.evaluate', {
    expression: `document.querySelector('button[aria-label="Clock settings"]').click()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  await send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll('form button')].find(el => el.textContent === 'Use current location').click()`,
    userGesture: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 650));
  const location = await send('Runtime.evaluate', {
    expression: `JSON.stringify([document.querySelector('input[aria-label="Latitude"]').value, document.querySelector('input[aria-label="Longitude"]').value])`,
  });
  if (location.result.value !== JSON.stringify(['47.606200', '-122.332100']))
    throw new Error('Geolocation did not fill draft coordinates');
  await send('Runtime.evaluate', {
    expression: `document.querySelector('input[aria-label="Latitude"]').closest('fieldset').scrollIntoView({block:'start'})`,
  });
  const locationScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    `${directory}/rectangle-location-settings.png`,
    Buffer.from(locationScreenshot.data, 'base64'),
  );
  await send('Runtime.evaluate', {
    expression: `document.querySelector('input[aria-label="Calendar relay URL"]').closest('fieldset').scrollIntoView({block:'start'})`,
  });
  const calendarScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(
    `${directory}/rectangle-calendar-settings.png`,
    Buffer.from(calendarScreenshot.data, 'base64'),
  );
  await send('Runtime.evaluate', {
    expression: `(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
    [...document.querySelectorAll('form button')].find(el => el.textContent === 'Copy display URL').click();
  })()`,
    userGesture: true,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const geoCopy = await send('Runtime.evaluate', {
    expression: `document.querySelector('form textarea').value`,
  });
  const geoUrl = new URL(geoCopy.result.value);
  if (
    geoUrl.searchParams.get('lat') !== '47.6062' ||
    geoUrl.searchParams.get('lng') !== '-122.3321' ||
    geoUrl.searchParams.has('calendarKey')
  )
    throw new Error('Geolocation coordinates or keyless calendar settings lost in Copy URL');
  await send('Runtime.evaluate', {
    expression: `(() => {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition: (success, failure) => failure({ code: 1 }) } });
    [...document.querySelectorAll('form button')].find(el => el.textContent === 'Use current location').click();
  })()`,
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const denial = await send('Runtime.evaluate', {
    expression: `JSON.stringify({text:document.querySelector('form').textContent, lat:document.querySelector('input[aria-label="Latitude"]').value, lng:document.querySelector('input[aria-label="Longitude"]').value})`,
  });
  const denied = JSON.parse(denial.result.value);
  if (
    !denied.text.includes('Location permission was denied') ||
    denied.lat !== '47.606200' ||
    denied.lng !== '-122.332100'
  )
    throw new Error('Geolocation denial cleared coordinates or omitted manual fallback');
  console.log(
    'Browser geolocation fills draft fields, copies into kiosk URL and handles permission denial without losing coordinates.',
  );

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
