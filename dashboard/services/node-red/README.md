# Inovelli Blue control

This source-controlled Node-RED flow talks directly to Zigbee2MQTT; Home
Assistant is not in its control path.

Edit `config.js` to configure MQTT and add switch/group mappings with their
double-tap presets, then run the normal dashboard deploy. Topic values are Z2M
base topics and must not end in `/set` or `/action`. All mappings share the
implementation in `lib/inovelli-control.js`; do not copy the flow.

The flow provides:

- double tap up: light on, 100% brightness, configured color temperature;
- double tap down: light on, configured brightness and color temperature;
- event-driven synchronization of every target-group `state` and `brightness`
  report to the switch.

Only `state` and `brightness` are written to the switch. Configure the switch's
`led_color_when_on`, `led_color_when_off`, `led_intensity_when_on`, and
`led_intensity_when_off` values in Zigbee2MQTT; the flow intentionally leaves
them alone. The switch should be in Smart Bulb Mode and directly bound to the
target Zigbee group for normal single-tap and hold behavior.

Node-RED uses the synced `~/dashboard/services/node-red` directory as its native
user directory. `settings.js` is the single manifest: it loads `config.js`, the
application module, and the flow wiring. Changes should be made here rather
than only in the Node-RED editor.

## Install and sync

For the first installation, run the normal dashboard deployment from the
repository root:

```bash
./dashboard/scripts/deploy.sh kiosk@kiosk.home.arpa
```

That installs Node-RED and `node-red.service`, then starts it directly from the
synced source directory. For later Node-RED-only changes, use the fast sync
command:

```bash
./dashboard/scripts/sync-node-red.sh kiosk@kiosk.home.arpa
```

The fast sync runs the local tests, rsyncs this entire directory, validates the
remote JavaScript/configuration, and restarts only Node-RED. New files under
this directory are included automatically; there is no deployment file list to
maintain. Pass `--no-restart` to sync and validate without activating changes.

There is no separate Node-RED cloud/editor synchronization. This repository is
the source of truth, and synchronization is one-way to the kiosk. A later sync
overwrites changes made only in the Node-RED editor, so edit `config.js` or
`lib/inovelli-control.js` here instead.

Node-RED is available at `http://kiosk.home.arpa:1880`. To inspect the deployed
service:

```bash
ssh kiosk@kiosk.home.arpa 'sudo systemctl status node-red --no-pager'
ssh kiosk@kiosk.home.arpa 'sudo journalctl -u node-red -n 100 --no-pager'
```

Run the logic tests without Node-RED:

```bash
node --test dashboard/services/node-red/test/*.test.js
```
