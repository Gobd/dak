#!/bin/bash
# Install Chrome virtual keyboard extension
# Usage: install-keyboard.sh [version|branch|local] [user@host|dir] [user@host]
#   version: semver like v3.0.1 or 3.0.1 - downloads from GitHub releases
#   branch:  branch name like main - downloads nightly build from GitHub Actions
#   local:   'local /path/to/repo' - builds extension from local source directory
#   user@host: optional remote host to install on via SSH
#   default: v3.0.8

set -e

INPUT="${1:-v3.0.8}"
DEST_DIR=~/.config/chromium-extensions

if [[ "$INPUT" == "local" ]]; then
  LOCAL_DIR="$2"
  REMOTE="$3"
  if [[ -z "$LOCAL_DIR" || ! -d "$LOCAL_DIR" ]]; then
    echo "Error: Valid directory must be provided when using 'local'."
    echo "Usage: install-keyboard.sh local /path/to/dir [user@host]"
    exit 1
  fi
else
  REMOTE="$2"
fi

if [[ -n "$REMOTE" ]]; then
  DEST_DIR="/home/${REMOTE%%@*}/.config/chromium-extensions"
fi

rm -rf /tmp/smartkey-extract /tmp/smartkey-final
mkdir -p /tmp/smartkey-extract

if [[ "$INPUT" == "local" ]]; then
  echo "=== Building virtual keyboard extension locally from $LOCAL_DIR ==="
  (
    cd "$LOCAL_DIR"
    if ! command -v pnpm &> /dev/null; then
      echo "Error: pnpm is required to build the extension. Please install it first."
      exit 1
    fi
    pnpm install
    pnpm run build
  )
  cp -R "$LOCAL_DIR/dist" /tmp/smartkey-final
elif [[ "$INPUT" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  VERSION="${INPUT#v}"
  VERSION="v$VERSION"
  echo "=== Downloading virtual keyboard extension ($VERSION) ==="
  curl -Lo /tmp/smartkey.zip "https://github.com/Gobd/chrome-virtual-keyboard/releases/download/${VERSION}/smartkey-${VERSION}.zip"
  unzip -q -o /tmp/smartkey.zip -d /tmp/smartkey-extract/
  rm /tmp/smartkey.zip

  # Handle nested folder from release zips
  ITEMS=(/tmp/smartkey-extract/*)
  if [[ ${#ITEMS[@]} -eq 1 && -d "${ITEMS[0]}" ]]; then
    mv "${ITEMS[0]}" /tmp/smartkey-final
    rm -rf /tmp/smartkey-extract
  else
    mv /tmp/smartkey-extract /tmp/smartkey-final
  fi
else
  BRANCH="$INPUT"
  echo "=== Downloading virtual keyboard extension (nightly: $BRANCH) ==="
  gh run download -R Gobd/chrome-virtual-keyboard -n "smartkey-${BRANCH}" -D /tmp/smartkey-extract
  mv /tmp/smartkey-extract /tmp/smartkey-final
fi

# Install locally or remotely
if [[ -z "$REMOTE" ]]; then
  echo "=== Installing locally ==="
  mkdir -p "$DEST_DIR"
  rm -rf "$DEST_DIR/smartkey"
  mv /tmp/smartkey-final "$DEST_DIR/smartkey"
else
  echo "=== Installing on $REMOTE ==="
  # shellcheck disable=SC2029  # DEST_DIR is intentionally expanded client-side
  ssh "$REMOTE" "mkdir -p $DEST_DIR && rm -rf $DEST_DIR/smartkey"
  scp -r /tmp/smartkey-final "$REMOTE:$DEST_DIR/smartkey"
  rm -rf /tmp/smartkey-final
fi

echo "=== Done ==="
