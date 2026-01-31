#!/bin/bash
# View service logs on remote kiosk
# Usage: ./scripts/logs.sh <user@host> [service] [flags...]
# Examples:
#   ./scripts/logs.sh kiosk@pi                    # home-relay logs
#   ./scripts/logs.sh kiosk@pi -f                 # follow home-relay logs
#   ./scripts/logs.sh kiosk@pi zigbee2mqtt        # zigbee2mqtt logs
#   ./scripts/logs.sh kiosk@pi zigbee2mqtt -f     # follow zigbee2mqtt logs
#   ./scripts/logs.sh kiosk@pi home-relay -n 100  # last 100 lines

REMOTE="$1"

if [[ -z "$REMOTE" ]]; then
  echo "Usage: $0 <user@host> [service] [journalctl flags...]"
  echo ""
  echo "Services: home-relay (default), zigbee2mqtt, voice-control, mosquitto"
  echo "Flags: -f (follow), -n NUM (lines), --since TIME, etc."
  exit 1
fi

shift

# Check if next arg is a service name or a flag
SERVICE="home-relay"
if [[ -n "$1" && ! "$1" =~ ^- ]]; then
  SERVICE="$1"
  shift
fi

# Pass remaining args as journalctl flags
exec ssh -t "$REMOTE" "journalctl -u $SERVICE $*"
