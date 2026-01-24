# Screenshot Automation Plan

## Current Screenshots

### Dashboard (`dashboard/`)

**Widgets:**

- [x] widget-weather.png
- [x] widget-calendar.png
- [x] widget-climate.png
- [x] widget-clock.png
- [x] widget-sun-moon.png
- [x] widget-aqi.png
- [x] widget-uv.png
- [x] widget-drive-time.png
- [ ] widget-adguard.png

**Modals:**

- [x] modal-kasa.png
- [x] modal-wol.png
- [x] modal-wol-add.png
- [x] modal-timer.png
- [x] modal-brightness.png
- [x] modal-calendar-settings.png
- [x] modal-calendar-add-event.png
- [x] modal-calendar-jump.png
- [x] modal-clock-settings.png
- [x] modal-climate-settings.png
- [x] modal-drive-time-details.png
- [x] modal-drive-time-edit.png
- [x] modal-mqtt.png

**Edit Mode:**

- [x] edit-mode-settings.png
- [x] edit-mode-add-widget.png

**Full Views:**

- [ ] dashboard-full.png (with left sidebar visible)

**Skipped:**

- ~~widget-ptt.png~~ (not needed)

### Notes App (`notes-app/`)

- [x] notes-list.png
- [x] note-detail.png

### Standalone Apps

- [ ] climate-display/app.png
- [ ] kasa-controller/app.png
- [ ] family-chores/app.png
- [ ] health-tracker/app.png

### Future (not yet)

- [ ] dashboard-full-keyboard.png (virtual keyboard visible)

## Automation Approach

Use Playwright to automate screenshot capture.

```bash
pnpm add -D playwright @playwright/test
```

### Script Structure

```ts
// scripts/screenshots.ts
import { chromium, Page } from 'playwright';

interface Screenshot {
  name: string;
  path: string;
  setup?: (page: Page) => Promise<void>;
  selector?: string; // element to capture, or full page if omitted
  sanitize?: (page: Page) => Promise<void>;
}

const screenshots: Screenshot[] = [
  {
    name: 'widget-weather',
    path: 'dashboard/widget-weather.png',
    selector: '[data-widget="weather"]',
  },
  {
    name: 'modal-kasa',
    path: 'dashboard/modal-kasa.png',
    setup: async (page) => {
      await page.click('[data-widget="kasa"]');
      await page.waitForSelector('.modal');
    },
    selector: '.modal',
  },
  {
    name: 'widget-calendar',
    path: 'dashboard/widget-calendar.png',
    selector: '[data-widget="calendar"]',
    sanitize: async (page) => {
      await page.evaluate(() => {
        // Scrub event titles
        document.querySelectorAll('.event-title').forEach((el) => {
          el.textContent = 'Team Meeting';
        });
      });
    },
  },
  // ... more screenshots
];

async function run() {
  // Use existing Chrome profile (already logged in)
  const userDataDir = '/Users/bkemper/Library/Application Support/Google/Chrome';
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    viewport: { width: 1920, height: 1080 },
    headless: false, // Must be false for persistent context
  });
  const page = context.pages()[0] || (await context.newPage());

  await page.goto('https://dak.bkemper.me/dashboard');

  for (const shot of screenshots) {
    // Reset to base state
    await page.goto('https://dak.bkemper.me/dashboard');

    // Run setup (click buttons, open modals, etc.)
    if (shot.setup) await shot.setup(page);

    // Sanitize sensitive data
    if (shot.sanitize) await shot.sanitize(page);

    // Capture
    const target = shot.selector ? page.locator(shot.selector) : page;
    await target.screenshot({ path: `readmes/screenshots/${shot.path}` });

    console.log(`✓ ${shot.name}`);
  }

  await context.close();
}

run();
```

### Data Sanitization

Run JS to scrub sensitive info before capture:

```ts
await page.evaluate(() => {
  // Calendar events
  document.querySelectorAll('.event-title').forEach((el, i) => {
    el.textContent = ['Team Standup', 'Project Review', 'Lunch'][i % 3];
  });

  // Email addresses
  document.querySelectorAll('[data-email], .email').forEach((el) => {
    el.textContent = 'user@example.com';
  });

  // Names
  document.querySelectorAll('.attendee-name').forEach((el) => {
    el.textContent = 'John Doe';
  });
});
```

### Running

```bash
pnpm tsx scripts/screenshots.ts
```

## Notes

- Uses production site (dak.bkemper.me) - no local server needed
- Uses existing Chrome profile for auth (already logged in)
- Sanitization happens client-side before capture
- Each screenshot reloads page for clean state
- Add `data-widget` attributes to widgets for reliable selectors
