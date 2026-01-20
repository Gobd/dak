#!/bin/bash
# Brightness CLI - thin wrapper over home-relay API
# For convenient use via SSH
#
# Usage:
#   ./brightness.sh auto    - Auto-adjust based on sun (or use cron)
#   ./brightness.sh day     - Set day brightness
#   ./brightness.sh night   - Set night brightness
#   ./brightness.sh set 50  - Set to specific level (1-100)
#   ./brightness.sh status  - Show current level and sun times
#
# Cron example (every 2 mins):
#   */2 * * * * curl -s http://localhost:5111/brightness/auto

API="http://localhost:5111"

case "${1:-status}" in
  auto)
    curl -s "$API/brightness/auto" | jq .
    ;;
  day)
    # Get day brightness from config and set it
    LEVEL=$(curl -s "$API/config/brightness" | jq -r '.dayBrightness // 100')
    curl -s -X POST "$API/brightness/set" -H "Content-Type: application/json" -d "{\"level\":$LEVEL}" | jq .
    ;;
  night)
    # Get night brightness from config and set it
    LEVEL=$(curl -s "$API/config/brightness" | jq -r '.nightBrightness // 1')
    curl -s -X POST "$API/brightness/set" -H "Content-Type: application/json" -d "{\"level\":$LEVEL}" | jq .
    ;;
  set)
    LEVEL="${2:-50}"
    curl -s -X POST "$API/brightness/set" -H "Content-Type: application/json" -d "{\"level\":$LEVEL}" | jq .
    ;;
  status)
    curl -s "$API/brightness/status" | jq .
    ;;
  *)
    echo "Usage: $0 [auto|day|night|set N|status]"
    echo "  auto   - Auto-adjust based on sun position"
    echo "  day    - Set to day brightness"
    echo "  night  - Set to night brightness"
    echo "  set N  - Set brightness to N%"
    echo "  status - Show current brightness and config"
    ;;
esac
