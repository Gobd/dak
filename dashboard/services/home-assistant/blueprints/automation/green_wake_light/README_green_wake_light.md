# Green Wake Light

Turns a light group green at low brightness at a scheduled time, whether the
light was already off or on. Meant for two schedules (weekday / weekend) made
from the same blueprint.

## Setup

1. Copy `green_wake_light.yaml` into your HA `blueprints/automation/` folder
   (already true if this repo's `services/home-assistant/` is synced to your
   HA config dir), then in HA: **Settings → Automations & Scenes →
   Blueprints → Green Wake Light → Create Automation**.
2. Pick the **target light group** - a Z2M/Hue group entity works best so
   you can add/remove bulbs later without editing the automation.
3. Set the **trigger time**.
4. Set **days of week** - `Mon-Fri` for the weekday instance.
5. Leave **brightness** at 25% (or adjust) and **transition** as desired.
6. Save, then repeat steps 1-5 for a second instance with `Sat-Sun` and a
   different trigger time.

## Notes

- `light.turn_on` with `hs_color` + `brightness_pct` works regardless of
  whether the light is currently off - no separate "if off" logic needed.
- If a member bulb in the target group doesn't support color, it just
  ignores `hs_color` and applies brightness only (same behavior as the Hue
  Tap Dial blueprint's RGB mode).
- Color isn't exposed as a form field - it's hardcoded to pure green
  (`hs_color: [120, 100]`) in the blueprint YAML. To change it, edit that
  line; it affects every automation instance made from this blueprint.
