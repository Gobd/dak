# AppDaemon automations

AppDaemon runs ordinary Python automation apps from `apps/`. The Inovelli app
talks directly to Zigbee2MQTT through Mosquitto; Home Assistant is not in this
control path, but it still observes all resulting device reports through its
MQTT integration.

The AppDaemon runtime and all transitive dependencies are reproducibly managed
by this directory's `pyproject.toml` and `uv.lock`. Deploy and sync use
`uv sync --locked` with the isolated `~/appdaemon/.venv` environment.

The AppDaemon admin UI is available on the local network at
`http://kiosk.home.arpa:5050`. It shows loaded apps, plugin status, callbacks,
threads, namespaces, and logs.

`apps/apps.yaml` maps each switch topic to its target Zigbee group and presets.
The shared implementation provides:

- double tap up: 100% brightness and the configured color temperature;
- double tap down: configured brightness and color temperature;
- hold down while off: publish the configured brightness and color temperature,
  wait for both values to be reported by the group, then turn the group on;
- event-driven synchronization of group state and brightness to each switch.

The double-tap presets use that same report-confirmed sequence when the group is
known to be off. If the group is already on (or its state is not yet known), the
preset is sent as one combined ON payload.

The hold-down preset is configured per control in `apps/apps.yaml` with
`down_held_brightness_percent` and `down_held_color_temp_k`.

The switch should be in Smart Bulb Mode and directly bound to its Zigbee group
for normal single-tap and hold behavior. LED color and intensity remain owned
by the switch's Zigbee2MQTT settings.

## Development and deployment

Run the dependency-free logic tests locally:

```bash
python3 -m unittest discover dashboard/services/appdaemon/tests
```

The normal dashboard deployment installs AppDaemon. For automation-only
changes, test and sync it with:

```bash
./dashboard/scripts/sync-appdaemon.sh kiosk@kiosk.home.arpa
```

AppDaemon watches the `apps/` directory and reloads changed Python or YAML app
configuration automatically. The sync script nevertheless restarts the service
by default so changes to `appdaemon.yaml` are also applied. Pass `--no-restart`
to rely on hot reload.

Inspect the deployed service with:

```bash
ssh kiosk@kiosk.home.arpa 'sudo systemctl status appdaemon --no-pager'
ssh kiosk@kiosk.home.arpa 'sudo journalctl -u appdaemon -n 100 --no-pager'
```

An HA plugin can be added alongside MQTT later for apps that need HA-only
entities such as weather, calendars, or helpers. This Inovelli app will remain
independent of HA availability.
