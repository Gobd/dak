#!/bin/bash
# Auto brightness control using ddcutil
# Adjusts monitor brightness based on sunrise/sunset

# === CONFIGURATION ===
LAT="40.0"          # Your latitude
LON="-105.0"        # Your longitude
DAY_BRIGHTNESS=100  # Brightness during day (1-100)
NIGHT_BRIGHTNESS=30 # Brightness at night (1-100)

# === FUNCTIONS ===

get_sun_times() {
  # Calculate sunrise/sunset using sunwait or fallback to API
  if command -v sunwait &>/dev/null; then
    SUNRISE=$(sunwait list civil rise $LAT $LON | head -1)
    SUNSET=$(sunwait list civil set $LAT $LON | head -1)
  else
    # Fallback: use sunrise-sunset.org API
    DATA=$(curl -s "https://api.sunrise-sunset.org/json?lat=$LAT&lng=$LON&formatted=0" 2>/dev/null)
    SUNRISE=$(echo "$DATA" | grep -o '"sunrise":"[^"]*"' | cut -d'"' -f4 | cut -dT -f2 | cut -d+ -f1)
    SUNSET=$(echo "$DATA" | grep -o '"sunset":"[^"]*"' | cut -d'"' -f4 | cut -dT -f2 | cut -d+ -f1)
  fi
}

time_to_minutes() {
  # Convert HH:MM:SS to minutes since midnight
  local time=$1
  local hours=$(echo $time | cut -d: -f1)
  local mins=$(echo $time | cut -d: -f2)
  echo $((10#$hours * 60 + 10#$mins))
}

set_brightness() {
  local level=$1
  sudo ddcutil setvcp 10 $level --noverify 2>/dev/null
  echo "$(date): Brightness set to $level%"
}

# === MAIN ===

case "${1:-auto}" in
  day)
    set_brightness $DAY_BRIGHTNESS
    ;;
  night)
    set_brightness $NIGHT_BRIGHTNESS
    ;;
  set)
    set_brightness ${2:-50}
    ;;
  auto)
    get_sun_times

    NOW=$(date +%H:%M:%S)
    NOW_MINS=$(time_to_minutes $NOW)

    # Handle UTC conversion (API returns UTC)
    TZ_OFFSET=$(date +%z | sed 's/00$//' | sed 's/^+//')
    SUNRISE_MINS=$(time_to_minutes $SUNRISE)
    SUNSET_MINS=$(time_to_minutes $SUNSET)

    # Adjust for timezone
    SUNRISE_MINS=$((SUNRISE_MINS + TZ_OFFSET * 60))
    SUNSET_MINS=$((SUNSET_MINS + TZ_OFFSET * 60))

    if [ $NOW_MINS -ge $SUNRISE_MINS ] && [ $NOW_MINS -lt $SUNSET_MINS ]; then
      echo "Daytime (sunrise: $SUNRISE, sunset: $SUNSET)"
      set_brightness $DAY_BRIGHTNESS
    else
      echo "Nighttime (sunrise: $SUNRISE, sunset: $SUNSET)"
      set_brightness $NIGHT_BRIGHTNESS
    fi
    ;;
  status)
    sudo ddcutil getvcp 10 2>/dev/null
    ;;
  *)
    echo "Usage: $0 [auto|day|night|set N|status]"
    echo "  auto   - Set brightness based on sunrise/sunset"
    echo "  day    - Set to day brightness ($DAY_BRIGHTNESS%)"
    echo "  night  - Set to night brightness ($NIGHT_BRIGHTNESS%)"
    echo "  set N  - Set brightness to N%"
    echo "  status - Show current brightness"
    ;;
esac
