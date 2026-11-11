# Clock

Standalone 24-hour daylight clock for browser/kiosk displays. No account, dashboard configuration, or backend required.

The rectangle supports a top/bottom info bar with background/text color pickers, four editable starter palettes (Midnight, Paper, Sand, Dusk), elapsed-time wipe with color/opacity controls, independently hidden time/seconds markers, and optional today/tomorrow weather (Open-Meteo, using configured coordinates). Digital time independently supports 12-hour AM/PM or 24-hour display. Circular rendering is otherwise unchanged. **Copy display URL** includes every option, including unsaved form values, for kiosk startup.

```bash
pnpm --filter clock dev
# http://localhost:5184/clock/
```

See [Clock documentation](../readmes/clock.md) for all URL settings, calendar-feed setup, timezone behavior, and rendering details.

- [Demo screenshots](screenshots/README.md): alternate palettes, layouts, and fictional calendar events.
- [Orange Pi / Debian kiosk setup](scripts/README.md): configure from a laptop with a copied display URL.
