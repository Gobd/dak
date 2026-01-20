#!/bin/bash
# Restore kiosk mode after debugging
# Run from SSH after using debug-mode.sh

cp ~/dashboard/scripts/config/kiosk-launcher.sh ~/.kiosk.sh
chmod +x ~/.kiosk.sh

echo "Restored kiosk mode. Restarting display..."
sudo systemctl restart getty@tty1

echo "Kiosk mode active."
