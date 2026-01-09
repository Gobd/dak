#!/bin/bash
# Restart chromium kiosk (after closing it)

pkill -f cage || true
sleep 1
~/.kiosk.sh &
