#!/bin/bash
# Install Chrome virtual keyboard extension
# Usage: install-keyboard.sh [version|branch]
#   version: semver like v3.0.1 or 3.0.1 - downloads from GitHub releases
#   branch:  branch name like main - downloads nightly build from GitHub Actions
#   default: v3.0.1

set -e

INPUT="${1:-v3.0.1}"

mkdir -p ~/.config/chromium-extensions

if [[ "$INPUT" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  # Semver - download from GitHub releases
  VERSION="${INPUT#v}"
  VERSION="v$VERSION"
  echo "=== Installing virtual keyboard extension ($VERSION) ==="
  curl -Lo /tmp/smartkey.zip "https://github.com/Gobd/chrome-virtual-keyboard/releases/download/${VERSION}/smartkey-${VERSION}.zip"
else
  # Branch name - download nightly build via nightly.link
  BRANCH="$INPUT"
  echo "=== Installing virtual keyboard extension (nightly: $BRANCH) ==="
  curl -Lo /tmp/smartkey.zip "https://nightly.link/Gobd/chrome-virtual-keyboard/workflows/build.yml/${BRANCH}/smartkey-${BRANCH}.zip"
fi

# Extract to temp dir first to handle varying zip structures
rm -rf /tmp/smartkey-extract
mkdir -p /tmp/smartkey-extract
unzip -o /tmp/smartkey.zip -d /tmp/smartkey-extract/
rm /tmp/smartkey.zip

# Determine what we got: single folder or flat files
ITEMS=(/tmp/smartkey-extract/*)
if [[ ${#ITEMS[@]} -eq 1 && -d "${ITEMS[0]}" ]]; then
  # Single folder - use it directly
  SRC="${ITEMS[0]}"
else
  # Flat files - use the extract dir itself
  SRC="/tmp/smartkey-extract"
fi

# Move to final destination
rm -rf ~/.config/chromium-extensions/smartkey
mv "$SRC" ~/.config/chromium-extensions/smartkey
rm -rf /tmp/smartkey-extract
