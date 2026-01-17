#!/bin/bash
# Auto brightness control using ddcutil
# Gradual transitions at sunrise/sunset
# Configuration via ~/.config/home-relay/brightness.json
#
# Usage:
#   ./brightness.sh auto    - Auto-adjust based on sun (run via cron)
#   ./brightness.sh day     - Set day brightness
#   ./brightness.sh night   - Set night brightness
#   ./brightness.sh set 50  - Set to specific level (1-100)
#   ./brightness.sh status  - Show current level and sun times

# Config file (managed by home-relay API)
CONFIG_FILE="$HOME/.config/home-relay/brightness.json"
CACHE_FILE="/tmp/brightness_sun_cache"

# === LOAD CONFIG ===

load_config() {
  if [ ! -f "$CONFIG_FILE" ]; then
    echo "No config file found at $CONFIG_FILE"
    echo "Configure brightness via the dashboard UI"
    exit 1
  fi

  # Parse JSON config (using grep/sed for minimal dependencies)
  ENABLED=$(grep -o '"enabled"[[:space:]]*:[[:space:]]*[^,}]*' "$CONFIG_FILE" | grep -o 'true\|false')
  LAT=$(grep -o '"lat"[[:space:]]*:[[:space:]]*[0-9.-]*' "$CONFIG_FILE" | grep -o '[0-9.-]*$')
  LON=$(grep -o '"lon"[[:space:]]*:[[:space:]]*[0-9.-]*' "$CONFIG_FILE" | grep -o '\-*[0-9.]*$')
  DAY_BRIGHTNESS=$(grep -o '"dayBrightness"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
  NIGHT_BRIGHTNESS=$(grep -o '"nightBrightness"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')
  TRANSITION_MINS=$(grep -o '"transitionMins"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | grep -o '[0-9]*$')

  # Defaults
  DAY_BRIGHTNESS=${DAY_BRIGHTNESS:-100}
  NIGHT_BRIGHTNESS=${NIGHT_BRIGHTNESS:-1}
  TRANSITION_MINS=${TRANSITION_MINS:-60}

  if [ "$ENABLED" != "true" ]; then
    echo "Auto brightness disabled in config"
    exit 0
  fi

  if [ -z "$LAT" ] || [ -z "$LON" ]; then
    echo "Location not configured"
    exit 1
  fi
}

# === FUNCTIONS ===

get_sun_times() {
  local TODAY
  TODAY=$(date +%Y-%m-%d)

  # Check if we have valid cached data from today
  if [ -f "$CACHE_FILE" ]; then
    local CACHED_DATE
    CACHED_DATE=$(head -1 "$CACHE_FILE")
    if [ "$CACHED_DATE" = "$TODAY" ]; then
      SUNRISE_EPOCH=$(sed -n '2p' "$CACHE_FILE")
      SUNSET_EPOCH=$(sed -n '3p' "$CACHE_FILE")
      return 0
    fi
  fi

  # Fetch fresh data from API
  local DATA
  DATA=$(curl -s "https://api.sunrise-sunset.org/json?lat=$LAT&lng=$LON&formatted=0" 2>/dev/null)

  # Extract times (UTC)
  SUNRISE_UTC=$(echo "$DATA" | grep -o '"sunrise":"[^"]*"' | cut -d'"' -f4)
  SUNSET_UTC=$(echo "$DATA" | grep -o '"sunset":"[^"]*"' | cut -d'"' -f4)

  if [ -z "$SUNRISE_UTC" ] || [ -z "$SUNSET_UTC" ]; then
    echo "ERROR: Could not fetch sun times"
    return 1
  fi

  # Convert to local epoch seconds
  SUNRISE_EPOCH=$(date -d "$SUNRISE_UTC" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${SUNRISE_UTC%+*}" +%s 2>/dev/null)
  SUNSET_EPOCH=$(date -d "$SUNSET_UTC" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${SUNSET_UTC%+*}" +%s 2>/dev/null)

  # Cache the results
  echo -e "$TODAY\n$SUNRISE_EPOCH\n$SUNSET_EPOCH" > "$CACHE_FILE"
}

calculate_brightness() {
  local NOW_EPOCH
  NOW_EPOCH=$(date +%s)
  local TRANS_SECS=$((TRANSITION_MINS * 60))

  # Define transition windows
  local SUNRISE_START=$((SUNRISE_EPOCH - TRANS_SECS / 2))
  local SUNRISE_END=$((SUNRISE_EPOCH + TRANS_SECS / 2))
  local SUNSET_START=$((SUNSET_EPOCH - TRANS_SECS / 2))
  local SUNSET_END=$((SUNSET_EPOCH + TRANS_SECS / 2))

  if [ "$NOW_EPOCH" -lt "$SUNRISE_START" ]; then
    # Before sunrise transition - full night
    echo "$NIGHT_BRIGHTNESS"
  elif [ "$NOW_EPOCH" -lt "$SUNRISE_END" ]; then
    # During sunrise transition - gradually brighten
    local PROGRESS=$(( (NOW_EPOCH - SUNRISE_START) * 100 / TRANS_SECS ))
    local RANGE=$((DAY_BRIGHTNESS - NIGHT_BRIGHTNESS))
    echo $((NIGHT_BRIGHTNESS + RANGE * PROGRESS / 100))
  elif [ "$NOW_EPOCH" -lt "$SUNSET_START" ]; then
    # Daytime - full day
    echo "$DAY_BRIGHTNESS"
  elif [ "$NOW_EPOCH" -lt "$SUNSET_END" ]; then
    # During sunset transition - gradually dim
    local PROGRESS=$(( (NOW_EPOCH - SUNSET_START) * 100 / TRANS_SECS ))
    local RANGE=$((DAY_BRIGHTNESS - NIGHT_BRIGHTNESS))
    echo $((DAY_BRIGHTNESS - RANGE * PROGRESS / 100))
  else
    # After sunset transition - full night
    echo "$NIGHT_BRIGHTNESS"
  fi
}

set_brightness() {
  local level=$1
  # Clamp to valid range
  [ "$level" -lt 1 ] && level=1
  [ "$level" -gt 100 ] && level=100
  ddcutil setvcp 10 "$level" --noverify
  echo "$(date '+%H:%M'): Brightness set to $level%"
}

get_current_brightness() {
  ddcutil getvcp 10 | grep -o 'current value = *[0-9]*' | grep -o '[0-9]*'
}

# === MAIN ===

case "${1:-auto}" in
  day)
    load_config
    set_brightness "$DAY_BRIGHTNESS"
    ;;
  night)
    load_config
    set_brightness "$NIGHT_BRIGHTNESS"
    ;;
  set)
    set_brightness "${2:-50}"
    ;;
  auto)
    load_config
    get_sun_times || exit 1
    TARGET=$(calculate_brightness)
    CURRENT=$(get_current_brightness)

    # Only change if different (reduces DDC traffic)
    if [ "$CURRENT" != "$TARGET" ]; then
      set_brightness "$TARGET"
    else
      echo "$(date '+%H:%M'): Brightness already at $TARGET%"
    fi
    ;;
  status)
    echo "Current brightness: $(get_current_brightness)%"
    if [ -f "$CONFIG_FILE" ]; then
      load_config 2>/dev/null
      get_sun_times 2>/dev/null && \
        echo "Sunrise: $(date -d "@$SUNRISE_EPOCH" '+%H:%M' 2>/dev/null || date -r "$SUNRISE_EPOCH" '+%H:%M')" && \
        echo "Sunset: $(date -d "@$SUNSET_EPOCH" '+%H:%M' 2>/dev/null || date -r "$SUNSET_EPOCH" '+%H:%M')"
    else
      echo "No config - configure via dashboard"
    fi
    ;;
  *)
    echo "Usage: $0 [auto|day|night|set N|status]"
    echo "  auto   - Set brightness based on sun position (gradual)"
    echo "  day    - Set to day brightness"
    echo "  night  - Set to night brightness"
    echo "  set N  - Set brightness to N%"
    echo "  status - Show current brightness and sun times"
    echo ""
    echo "Configure via dashboard UI or edit: $CONFIG_FILE"
    ;;
esac
