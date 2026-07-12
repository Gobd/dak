#!/bin/bash
# Backup/restore a Raspberry Pi SD card via macOS's SD slot or a USB reader.
# Usage:
#   ./sd-backup.sh backup <output-file.img.gz>
#   ./sd-backup.sh restore <input-file.img.gz>
#
# Safety: only ever lists/accepts disks that are External + Removable/Ejectable.
# Internal disks (including the boot disk) are never shown or allowed as a target,
# even if you type their identifier - restore is a destructive dd, mistakes here
# are unrecoverable, so this refuses to touch anything that looks like a system disk.

set -euo pipefail

MODE="${1:-}"
FILE="${2:-}"
MAX_SIZE_GB=256

if [[ "$MODE" != "backup" && "$MODE" != "restore" ]] || [[ -z "$FILE" ]]; then
  echo "Usage: $0 backup <output-file.img.gz>"
  echo "       $0 restore <input-file.img.gz>"
  exit 1
fi

is_safe_target() {
  local disk="$1"
  local info
  info="$(diskutil info "$disk" 2>/dev/null)" || return 1

  grep -q "Device Location:\s*External" <<<"$info" || return 1
  grep -qE "Removable Media:\s*(Removable|Yes)|Ejectable:\s*Yes" <<<"$info" || return 1

  local size_bytes
  size_bytes="$(diskutil info -plist "$disk" 2>/dev/null | plutil -extract Size xml1 -o - - 2>/dev/null | grep -oE '[0-9]+' || echo 0)"
  local size_gb=$(( size_bytes / 1000 / 1000 / 1000 ))
  [[ "$size_gb" -gt 0 && "$size_gb" -le "$MAX_SIZE_GB" ]] || return 1

  return 0
}

echo "=== Candidate SD/USB disks (external + removable only, <= ${MAX_SIZE_GB}GB) ==="
FOUND=0
for disk in $(diskutil list -plist physical 2>/dev/null | plutil -extract WholeDisks xml1 -o - - | grep -oE '<string>disk[0-9]+</string>' | sed -E 's#</?string>##g'); do
  if is_safe_target "$disk"; then
    echo ""
    diskutil info "$disk" | grep -E "Device Node|Media Name|Disk Size"
    FOUND=1
  fi
done

if [[ "$FOUND" -eq 0 ]]; then
  echo "No external removable disks found. Is the SD card inserted?"
  exit 1
fi

echo ""
read -rp "Enter the disk identifier to use (e.g. disk4): " DISK

if [[ ! "$DISK" =~ ^disk[0-9]+$ ]]; then
  echo "ERROR: expected something like 'disk4', got '$DISK'"
  exit 1
fi

if ! is_safe_target "$DISK"; then
  echo "ERROR: /dev/$DISK is not an external removable disk under ${MAX_SIZE_GB}GB."
  echo "Refusing to proceed - this guard exists to prevent wiping an internal/system drive."
  exit 1
fi

echo ""
echo "=== Selected: /dev/$DISK ==="
diskutil info "$DISK" | grep -E "Device Node|Media Name|Disk Size|Device Location|Removable Media"
echo ""

if [[ "$MODE" == "restore" ]]; then
  echo "!!! THIS WILL ERASE EVERYTHING ON /dev/$DISK !!!"
fi
read -rp "Type the disk identifier again to confirm ($DISK): " CONFIRM
if [[ "$CONFIRM" != "$DISK" ]]; then
  echo "Confirmation did not match, aborting."
  exit 1
fi

RAW_DISK="/dev/r${DISK}"

echo "Unmounting $DISK..."
diskutil unmountDisk "$DISK"

if [[ "$MODE" == "backup" ]]; then
  echo "=== Backing up $RAW_DISK -> $FILE ==="
  sudo dd if="$RAW_DISK" bs=4m status=progress | gzip -1 > "$FILE"
  echo "Done. Backup saved to $FILE ($(du -h "$FILE" | cut -f1))"
else
  if [[ ! -f "$FILE" ]]; then
    echo "ERROR: $FILE not found"
    exit 1
  fi
  echo "=== Restoring $FILE -> $RAW_DISK ==="
  gunzip -c "$FILE" | sudo dd of="$RAW_DISK" bs=4m status=progress
  sync
  echo "Done. Ejecting $DISK..."
  diskutil eject "$DISK"
fi
