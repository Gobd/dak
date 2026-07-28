# ESP32 Outdoor Sensor

ESPHome firmware for the battery/solar-powered outdoor sensor node. Publishes
temperature, humidity, UV index, air quality (hourly), and battery status over MQTT to
`home-relay`.

## Parts list

| Part                                                                                  | Role                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Adafruit ESP32 Feather V2](https://www.adafruit.com/product/5400)                    | Main board (STEMMA QT, built-in battery charging/monitoring)       |
| [Adafruit BQ25185 Solar/USB/DC Charger](https://www.adafruit.com/product/6091)        | Charges the battery from the solar panel (non-boost version)       |
| 3.7V Li-ion/LiPo battery pack, 4400mAh, JST-PH connector                              | Power source                                                       |
| 5V / 5W USB-C solar panel                                                             | Recharges the battery via the BQ25185                              |
| [INA219](https://www.adafruit.com/product/904) (STEMMA QT + VIN+/VIN- terminal block) | Battery charge/discharge current (mA), in series in the power path |
| [AHT20](https://www.adafruit.com/product/4566) (STEMMA QT)                            | Temperature + humidity                                             |
| [LTR390](https://www.adafruit.com/product/4831) (STEMMA QT)                           | UV index                                                           |
| [PMSA003I](https://www.adafruit.com/product/4632) (STEMMA QT)                         | PM2.5 / PM10 air quality                                           |
| [MAX17048](https://www.adafruit.com/product/5580) (STEMMA QT)                         | Battery fuel gauge (state-of-charge %)                             |
| STEMMA QT / Qwiic (JST-SH 4-pin) cables                                               | Chain the five sensors together off the Feather's STEMMA QT port   |
| JST-PH 2-pin cable (male-to-male), one cut/spliced to bare wire                       | BQ25185 `LOAD` → INA219 `VIN+`/`VIN-` → Feather `BAT`              |

Notes:

- The Feather V2 has **no 5V boost anywhere in this build** - the BQ25185 is the
  non-boost variant, and its `LOAD` output (3.0-4.5V, tracks battery charge) feeds the
  Feather's own JST battery port directly, same as if a bare battery were plugged in.
- The INA219 is the one sensor that is **not** just a STEMMA QT tap. Its STEMMA QT
  connector only carries I2C (for the Feather to read current/voltage); the actual
  battery power must physically flow through its `VIN+`/`VIN-` screw terminals, in
  series between the BQ25185's `LOAD` and the Feather's `BAT` port. This means one of
  the JST-PH cables in this build gets cut (or use a JST-PH pigtail) so its two wires can
  be screwed into `VIN+`/`VIN-` instead of plugging straight into the Feather.
- STEMMA QT cables are chainable - daisy-chain AHT20 → LTR390 → PMSA003I → MAX17048 →
  INA219 off the Feather's single STEMMA QT port, in any order.
- If a STEMMA QT cable is too short for your enclosure layout, splicing in extra wire is
  fine - these are just a 4-conductor cable (power, ground, SDA, SCL) with no signal
  integrity concerns at these short lengths/low speeds. No difference between splicing
  and buying a longer cable to cut down; use whichever you have on hand.

## Wiring diagram

```
                 ☀️  Solar panel (5V / 5W, USB-C out)
                         │
                         │ USB-C cable
                         ▼
              ┌─────────────────────┐
              │   BQ25185 charger    │
              │  (USB-C / DC / solar │
              │   input, non-boost)  │
              │                      │
              │   BATT ●        LOAD ●
              └────┬─────────────┬───┘
                   │             │
        JST-PH 2-pin       JST-PH cable, cut - two bare
                   │        wires screwed into INA219
                   ▼             │
      ┌─────────────────┐        ▼
      │  3.7V 4400mAh    │  ┌───────────────┐
      │  Li-ion battery  │  │  INA219        │
      └──────────────────┘  │  VIN+ ● VIN- ● │
                             └───┬───────┬────┘
                                 │       │
                        (screw terminal, second
                         JST-PH cut/spliced)
                                 │       │
                                 ▼       ▼
                        ┌───────────────────────┐
                        │   Feather ESP32 V2     │
                        │   JST battery port     │
                        │   (BAT)                │
                        │                        │
                        │   STEMMA QT port ●─────┼──► AHT20 ●──► LTR390 ●──►
                        │                        │   PMSA003I ●──► MAX17048 ●──► INA219
                        │   USB-C (flashing/OTA) │        (I2C link only - separate
                        └────────────────────────┘         from the VIN+/VIN- wiring above)
```

Plain-language version:

1. **Battery → BQ25185 `BATT` port.** JST-PH, direct plug.
2. **BQ25185 `LOAD` port → INA219 `VIN+`.** Cut a JST-PH cable (or use a pigtail) and
   screw the positive wire into `VIN+`.
3. **INA219 `VIN-` → Feather's `BAT` (JST battery) port.** Same idea - a second
   cut/spliced JST-PH cable's wire goes into `VIN-`, and the other end plugs into the
   Feather. This whole chain (battery → BQ25185 → INA219 → Feather) is what actually
   powers the board day-to-day; the INA219 just sits in series measuring the current
   flowing through it.
4. **Solar panel → BQ25185's USB-C input.** Recharges the battery; independent of the
   BATT/LOAD/INA219 wiring above.
5. **Feather's STEMMA QT port → AHT20 → LTR390 → PMSA003I → MAX17048 → INA219**, chained
   with STEMMA QT cables in any order. This is separate from step 2-3 above - STEMMA QT
   only carries I2C + logic power for all five sensors, not the battery's actual current.
6. **Feather's USB-C** is only for initial flashing. After that, updates go out over
   WiFi (OTA) - see below.

Sanity checks before sealing the enclosure:

- Confirm JST-PH polarity matches on every connector (Adafruit cables/boards are
  consistent, but double-check if any cable came from elsewhere) - this matters even
  more once you're cutting/splicing cables for the INA219, since it's easy to mix up
  which wire is which after cutting a JST-PH cable in half.
- Power on over USB-C first and watch the logs (`esphome logs esp32-outdoor.yaml`)
  before relying on the battery/solar path - easier to debug wiring with a live serial
  connection than blind in an enclosure.
- If `battery_current_ma` reads negative while the solar panel is clearly in daylight
  and charging, `VIN+`/`VIN-` are likely swapped - the sign convention is positive =
  charging, negative = discharging.

## Flashing

1. Copy `secrets.yaml.example` to `secrets.yaml` in this folder and fill in your WiFi
   credentials and a generated API encryption key (`openssl rand -base64 32`).
   `secrets.yaml` is gitignored - never commit it.
2. Install ESPHome (`pip install esphome`, or use the ESPHome Dashboard/Home Assistant
   add-on).
3. First flash needs a USB-C cable:
   ```bash
   esphome run esp32-outdoor.yaml
   ```
4. Subsequent updates can go over WiFi (OTA), once the board has flashed once and joined
   the network:
   ```bash
   esphome upload esp32-outdoor.yaml
   ```

## Behavior

- Wakes every ~8 minutes, takes readings, publishes over MQTT to
  `home-relay/sensors/esp32-outdoor`, then deep-sleeps.
- Temperature/humidity/UV/battery are read and published every wake cycle.
- PM2.5/PM10 (air quality) are only sampled roughly once per hour - the PMSA003I's fan
  is noisy/wasteful to spin up every 8 minutes, and `home-relay` doesn't need AQI on a
  fast cadence. On wakes where AQI isn't sampled, those fields are simply omitted from
  the MQTT payload rather than publishing stale/zeroed values.
- The STEMMA QT power rail (and everything on it - all five sensors) is powered off
  during deep sleep to minimize battery drain, and powered back on briefly at the start
  of each wake cycle.
- Battery is reported three ways: the MAX17048's state-of-charge estimate
  (`battery_pct`, the primary signal), the Feather's own built-in VBAT resistor-divider
  reading (`battery_voltage`, a secondary sanity check - fuel gauge SOC estimates can
  drift over a battery's life), and the INA219's measured current (`battery_current_ma`,
  positive = charging, negative = discharging - the numeric rate MAX17048's own CRATE
  register is too noisy to provide).

## MQTT payload

Matches the shape `home-relay`'s `mqtt_service.py` expects for the `esp32-outdoor`
custom device:

```json
{
  "temperature": 9.1,
  "humidity": 61.0,
  "uv_index": 3.2,
  "pm2_5": 8.4,
  "pm10": 12.1,
  "battery_pct": 87.3,
  "battery_voltage": 4.01,
  "battery_current_ma": 42.5
}
```

`pm2_5`/`pm10` are omitted on wakes where AQI wasn't sampled (see Behavior above).
