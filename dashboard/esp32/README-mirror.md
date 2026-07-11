# Bathroom Mirror (Arikta Royce) - QuinLED An-Penta-Mini Takeover

ESPHome firmware for a bathroom mirror LED + touch button takeover. Bypasses the mirror's
stock motherboard entirely - the QuinLED An-Penta-Mini drives the CCT LED strip directly
and reads the mirror's touch pads as raw dry contacts, replicating the original day/night
button behavior. Unrelated to the rest of this repo/dashboard; lives here only because it
shares the ESP32/ESPHome toolchain with the outdoor sensor.

Wiring reference, parts, and behavior notes below; full wire-color table is in the header
comment of [`mirror-arikta-royce.yaml`](./mirror-arikta-royce.yaml).

## Parts list

| Part                                                                                                                                                   | Role                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [QuinLED An-Penta-Mini](https://quinled.info/quinled-an-penta/)                                                                                        | Main board (ESP32-C3), drives LED channels, reads button dry contacts                                                                                                                                                                                                                                                                                                                              |
| [Adafruit LTC4311 I2C Extender/Active Terminator](https://www.adafruit.com/product/4756) (STEMMA QT)                                                   | Boosts I2C signal integrity over the long attic-to-sensor run                                                                                                                                                                                                                                                                                                                                      |
| AHT20 (STEMMA QT)                                                                                                                                      | Room humidity/temperature (planned, not yet wired)                                                                                                                                                                                                                                                                                                                                                 |
| STHS34PF80 IR presence sensor - [M5Stack Unit TMOS PIR](https://shop.m5stack.com/products/tmos-pir-unit-sths34pf80) (~$6.50, HY2.0-4P Grove connector) | Preferred: someone-walked-in trigger for the light (planned, not yet wired). M5Stack ships a maintained ESPHome `external_components` driver for it - no custom C++ needed. Connector is Grove (HY2.0-4P), not STEMMA QT - needs an adapter/spliced cable to join the STEMMA QT chain below. Fallback options (plain GPIO PIR, or mmWave if presence-while-stationary is ever wanted) noted below. |
| Mirror's existing 24V CCT LED strip                                                                                                                    | Reused; driven by Penta output channels instead of the mobo's driver                                                                                                                                                                                                                                                                                                                               |
| Mirror's existing 24V power brick                                                                                                                      | Reused to power the Penta (rated 12-48V input) and the LED strip                                                                                                                                                                                                                                                                                                                                   |
| Cat5/6 Ethernet cable, one run                                                                                                                         | Carries button signals + I2C, attic ↔ behind-mirror                                                                                                                                                                                                                                                                                                                                                |
| 16/3 (or similar) cable, one run                                                                                                                       | Carries 24V power, attic ↔ behind-mirror (Ethernet conductors aren't sized for LED current)                                                                                                                                                                                                                                                                                                        |

## Layout

- **Penta lives in the attic**, directly above the mirror - cooler and drier than the
  bathroom, better for the ESP32 and any exposed connections.
- **One Ethernet bundle** runs down to behind the mirror carrying every signal that might
  ever be needed there (button taps, I2C), pulled now while there's attic access whether
  or not each conductor is wired up yet.
- **Separate 16/3 cable** carries 24V down to the mirror for the LED strip and back up
  from the mirror's original brick to power the Penta.
- **Mirror's stock motherboard is fully disconnected** - touch pads and LED strip are
  rewired to bypass it entirely. It's left in place, still receiving 24V, but has nothing
  left to drive or read, so it's inert.

## Button behavior (replicated from the stock mirror)

- **Night button**: tap toggles into a fixed night preset (warmest color temp, dimmest
  brightness) if off or in day mode; tap again while in night mode turns off.
- **Day button**: tap while off turns on; rapid taps while on cycle through color temp
  steps; press-and-hold ramps brightness in whichever direction it last left off in,
  clamping (not reversing) at 0%/100% - direction only flips on the _next_ separate hold.

See the YAML's `script:` section for the actual state machine implementation.

## Spare wiring, pulled but not yet connected

- **B3 terminal** (Striped Green) - reserved for a future fan/humidity automation once
  presence + AHT20 are in place.
- **Spare GPIO** (Striped Brown) - fallback for a plain GPIO PIR, only needed if the
  STHS34PF80 (I2C) doesn't pan out.
- **I2C wires down to the mirror side** - the AHT20 stays at the Penta end (attic), but the
  presence sensor needs to actually see the room, so it's planned to live at the mirror
  end instead, at the far end of the LTC4311-extended I2C run.

## Presence / humidity → MQTT

The presence sensor and AHT20 are I2C sensors wired directly to the Penta - **not** Zigbee
devices, so they never touch Zigbee2MQTT directly. They publish over raw MQTT to the same
Mosquitto broker Zigbee2MQTT and the outdoor sensor use (`kiosk.home.arpa`), matching
`esp32-outdoor.yaml`'s pattern - not via Home Assistant's ESPHome native API integration.

**Sensor choice for "did someone walk in":** the STHS34PF80 is preferred - M5Stack's [Unit
TMOS PIR](https://shop.m5stack.com/products/tmos-pir-unit-sths34pf80) is the same chip as
the pricier Adafruit/SparkFun STEMMA QT boards, at ~$6.50, and M5Stack maintains a real
ESPHome `external_components` driver for it (`github://m5stack/esphome-yaml/components`,
see the [docs](https://docs.m5stack.com/en/homeassistant/sensor/unit_tmos_pir)) - no
custom C++ needed. It's not the only option though - if it's ever unavailable, a plain
GPIO PIR (Adafruit #189/#4871) on the spare Striped Brown GPIO works just as well for this
simple walked-in-turns-on-light use case, and an mmWave sensor (Adafruit LD2410 #5920) is
an option too if "hold the light on while someone's standing still" ever becomes a
requirement (it isn't one today). See the commented-out sensor block in the YAML for
specifics on each.

**Connector note:** the M5Stack board uses their Grove-style HY2.0-4P connector, not
STEMMA QT/JST-SH like the AHT20/LTC4311 chain. Same 4 signals (3V3/GND/SDA/SCL), different
housing - use a Grove-to-STEMMA-QT adapter cable, or cut/splice the included HY2.0 cable
onto the STEMMA QT tail wires at the mirror (same splicing approach already used elsewhere
in this build).

**Tuning caveat:** the `presence_threshold`/`presence_hysteresis`/`odr` values in the
YAML's commented sensor block are M5Stack's own example defaults - a reasonable starting
point, but getting presence detection to reliably fire on "walked in" without
false-triggering on hallway traffic through the doorway or HVAC vents needs tuning against
the physical sensor once it's mounted, not something verified ahead of time.

**Alternate driver (documented, not switched to):**
[jamesjharper/esphome_sths34pf80](https://github.com/jamesjharper/esphome_sths34pf80) is a
different `external_components` driver for the same chip - generic I2C wiring rather than
tied to M5Stack's hardware, `binary_sensor` entries (`presence`/`motion`/`thermal_shock`,
device_class-native) instead of M5Stack's `pres_flag`/`mot_flag` sensor platform, and
notably exposes runtime `number`/`select` entities so threshold/hysteresis can be tuned
live from Home Assistant instead of an edit-YAML-reflash loop. Smaller, newer project than
M5Stack's though, so this build sticks with M5Stack's driver for now - worth reconsidering
if live threshold tuning turns out to matter more than the maturity tradeoff.

This keeps the sensor data useful to _anything_ subscribing to the broker (Home Assistant,
home-relay, a script), rather than requiring HA specifically to be running and configured
with the ESPHome integration. Same philosophy as the outdoor sensor: broker-first, no
single consumer required.

All decision logic (sunrise/sunset timing, guest override) is intended to live in a **Home
Assistant automation** that subscribes to the MQTT topic as its trigger:

- Trigger: MQTT topic `home-relay/sensors/mirror-arikta-royce/pir` payload `ON`
- Condition: `sun.sun` below horizon (or a fixed time window), and an
  `input_boolean.mirror_pir_enabled` toggle on (so PIR-driven night mode can be disabled
  when guests are over)
- Action: call `light.turn_on` / `light.turn_off` on the mirror's light entity directly
  with the night preset values - don't simulate pressing the physical button from HA.

If dashboard/home-relay visibility is also wanted (like the outdoor sensor's readings on
dashboard widgets), home-relay can subscribe to the same topic - no separate integration
needed, it's already just another MQTT subscriber on the broker.

## Known placeholders in the YAML (fix before flashing)

- GPIO pin numbers for `B1`/`B2`/`B3` and the LED output channels are **not yet confirmed**
  against the actual An-Penta-Mini pinout - swap in the real numbers from QuinLED's docs.
- `color_temperature` / mired values for the LED strip's warm/cool points are guesses -
  measure the actual strip and correct them.
- Board type (`esp32-c3-devkitm-1`) is assumed from QuinLED's own documentation and should
  be confirmed against the specific board revision.
