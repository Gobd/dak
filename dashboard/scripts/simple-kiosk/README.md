# simple-kiosk

Sets up a Raspberry Pi 4 or 5 as a fullscreen Chromium kiosk running on Wayland/Cage.

## Requirements

- Raspberry Pi 4 or 5 running Raspberry Pi OS Lite (Debian Trixie) — the full desktop image is not needed
- Pi accessible over SSH with password auth (e.g. fresh Raspberry Pi OS install)
- `sshpass` installed locally: `brew install sshpass`

## Usage

### 0. Find the Pi on your network

If you don't know the Pi's IP address:

```bash
sudo nmap -sn 192.168.1.0/24 | grep -A 1 -i "Raspberry Pi"
```

Once you find it, consider writing the MAC address on the device itself so you can look it up quickly next time (routers usually list IP→MAC in their DHCP table).

### 1. Connect to WiFi (if not already on ethernet)

```bash
bash wifi.sh <host> <ssh-user> <ssh-password> <ssid> <wifi-password>
```

Example:

```bash
bash wifi.sh 192.168.1.50 pi raspberry 'MyWiFi' 'wifipass'
```

### 2. Run setup

```bash
bash setup.sh <host> <ssh-user> <ssh-password> <url>
```

Example:

```bash
bash setup.sh 192.168.1.50 pi raspberry https://example.com
```

The Pi will reboot automatically when done. On next boot it will launch Chromium in kiosk mode pointing at the given URL.

## What setup does

- Installs cage, chromium, wlopm, cec-utils, ddcutil
- Configures console autologin
- Launches kiosk on login via `~/.bash_profile`
- Schedules screen on (7am) and off (6pm) local time via cron, trying CEC → DDC → wlopm in order

## Re-running

`setup.sh` is safe to re-run — it won't insert duplicate config or packages. However it will overwrite any files it manages (`~/.kiosk.sh`, `~/.bash_profile`, the udev rules, and the crontab), so local edits to those files on the Pi will be lost.

## Files

The other files in this directory (`kiosk.sh`, `remote-setup.sh`, `bash_profile`, `kiosk-cron`, `99-kiosk-input.rules`) are support files copied to the Pi by `setup.sh` — you don't need to run them directly.
