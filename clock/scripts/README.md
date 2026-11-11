# Clock kiosk setup (Orange Pi / Debian)

For an Orange Pi Zero 2W (including 1 GB models) running a **Debian-based Orange Pi or Armbian image** with working HDMI/DRM/KMS and Mesa drivers. Start with a minimal image, configure networking/SSH, and use a non-root Bash-login user with sudo.

This has been syntax/lint checked, **not tested on physical Orange Pi hardware**. Board/vendor images differ: setup does not install a kernel, device-tree overlay, display-panel driver, or GPU driver specific to your board. A round display's resolution/rotation must already work in the OS. Images that provide Chromium only through Snap are not supported by this installer.

The old `dashboard/scripts/simple-kiosk/` installer is Raspberry Pi-specific (`raspi-config`, Pi boot-file edits, forced 1080p and screen-off cron). This version reuses the Cage/Chromium approach without those assumptions.

## From your laptop

Configure Clock, select **Copy display URL**, and use the entire quoted URL:

```bash
bash clock/scripts/setup-kiosk-remote.sh user@orange-pi 'PASTE_DISPLAY_URL' America/New_York
ssh user@orange-pi sudo reboot
```

Uses your existing SSH keys/password prompts and normal sudo. Does not disable SSH host-key verification or grant passwordless sudo. It copies a temporary script bundle, installs, then removes that bundle. The remote login shell must support Bash-style argument quoting (normal Bash user).

## Directly on the device

Copy both `setup-kiosk.sh` and `kiosk-launcher.sh` to the same directory, then:

```bash
sudo bash setup-kiosk.sh 'PASTE_DISPLAY_URL' America/New_York
sudo reboot
```

Optional third argument selects an existing kiosk user when `SUDO_USER` is unavailable. An omitted timezone preserves the existing timezone.

## What changes

- Installs native Chromium, Cage, dbus user-session support, and Mesa userspace.
- Keeps an active chrony/NTP service; otherwise installs/enables systemd-timesyncd.
- Sets the requested timezone. Check `timedatectl status` and wait for a synchronized clock before judging sunrise/sunset or TLS failures.
- Adds the kiosk user to existing `video`, `render`, and `input` groups.
- Installs `~/.local/bin/clock-kiosk` and writes the URL as **data** to `~/.config/clock-kiosk/url` (0600). The script never sources/evaluates the URL, and does not print it to keep your local relay address and display configuration private.
- Adds/replaces only a marked block in `~/.bash_profile`. Existing profile content is preserved. Launches on tty1 only, never during SSH sessions.
- Configures tty1 autologin through a dedicated systemd getty drop-in and selects `multi-user.target`. A desktop login manager will no longer launch automatically after reboot.
- Starts Cage plus sandboxed, non-root Chromium in kiosk/incognito/Wayland mode. Chromium cache limits are 16 MiB per configured cache; these flags are not a hard total memory/disk quota. Incognito avoids retaining browsing history; complete URL configuration makes localStorage unnecessary on this display.

No reboot is automatic. No Pi boot files, display modes, existing cron jobs, or passwords/sudoers are changed. No daily screen-off schedule is installed: the clock is intended to run 24/7. Existing kiosk/profile/cron launchers from another installation may conflict and must be removed before using this one.

## Change the URL over SSH

Replace the single line in `~/.config/clock-kiosk/url`, preserving file mode 0600. For example:

```bash
ssh -t user@orange-pi 'nano ~/.config/clock-kiosk/url'
ssh user@orange-pi sudo systemctl restart getty@tty1
```

Prefer editing the file to embedding a private URL in many shell commands. Anyone with the read-only URL can read the calendar feed while its key remains valid. `f=1` hides all app controls; Cage/Chromium already supplies actual fullscreen.

## Renderer troubleshooting

First check that `/dev/dri/` exists and that the image supports your display. SSH into the board and inspect:

```bash
journalctl -b -u getty@tty1
ls /dev/dri
free -h
timedatectl status
```

If GPU rendering fails, try wlroots' software renderer (uses more CPU; support varies by Cage/wlroots build):

```bash
printf 'pixman\n' > ~/.config/clock-kiosk/renderer
sudo systemctl restart getty@tty1
```

Remove that file or write `auto` to restore automatic renderer selection. Prefer a working hardware-accelerated image for smooth seconds. Turning off seconds updates the canvas once per minute and lowers CPU work considerably. For 1 GB, use a minimal image, one browser window/tab, and no desktop environment or local dashboard backend on this board.

## Re-run / undo

Re-running replaces the managed launcher, URL, getty drop-in, and marked profile block. Unrelated profile content is preserved; packages/groups remain installed. Review any existing console autologin configuration first.

To stop autolaunch, remove the marked block in `~/.bash_profile` and `/etc/systemd/system/getty@tty1.service.d/clock-kiosk.conf`, then `sudo systemctl daemon-reload` and reboot. Set the desired boot target again if needed. Setup does not offer an automatic rollback of package/user-group/timezone changes.
