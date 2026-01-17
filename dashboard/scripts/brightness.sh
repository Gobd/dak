#!/bin/bash
# Auto brightness control using ddcutil
# Gradual transitions at sunrise/sunset
#
# Usage:
#   ./brightness.sh auto    - Auto-adjust based on sun (run via cron)
#   ./brightness.sh day     - Set day brightness
#   ./brightness.sh night   - Set night brightness
#   ./brightness.sh set 50  - Set to specific level (1-100)
#   ./brightness.sh status  - Show current level and sun times

# ╔════════════════════════════════════════════════════════════════╗
# ║                      CONFIGURATION                             ║
# ║  Edit these values for your location and preferences           ║
# ╚════════════════════════════════════════════════════════════════╝

# Your location (get from Google Maps)
LAT="40.63"                # Latitude  (e.g., 40.7128 for NYC)
LON="-111.90"              # Longitude (e.g., -74.0060 for NYC)

# Brightness levels (1-100)
DAY_BRIGHTNESS=100        # Daytime brightness
NIGHT_BRIGHTNESS=1        # Nighttime brightness

# Transition settings
TRANSITION_MINS=60        # How long to fade (30-90 recommended)

# Cache file for sun times (avoids API calls every run)
CACHE_FILE="/tmp/brightness_sun_cache"

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
    set_brightness "$DAY_BRIGHTNESS"
    ;;
  night)
    set_brightness "$NIGHT_BRIGHTNESS"
    ;;
  set)
    set_brightness "${2:-50}"
    ;;
  auto)
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
    get_sun_times && echo "Sunrise: $(date -d "@$SUNRISE_EPOCH" '+%H:%M' 2>/dev/null || date -r "$SUNRISE_EPOCH" '+%H:%M')" && echo "Sunset: $(date -d "@$SUNSET_EPOCH" '+%H:%M' 2>/dev/null || date -r "$SUNSET_EPOCH" '+%H:%M')"
    ;;
  *)
    echo "Usage: $0 [auto|day|night|set N|status]"
    echo "  auto   - Set brightness based on sun position (gradual)"
    echo "  day    - Set to day brightness ($DAY_BRIGHTNESS%)"
    echo "  night  - Set to night brightness ($NIGHT_BRIGHTNESS%)"
    echo "  set N  - Set brightness to N%"
    echo "  status - Show current brightness and sun times"
    ;;
esac
