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

rm -rf ~/.config/chromium-extensions/smartkey
unzip -o /tmp/smartkey.zip -d ~/.config/chromium-extensions/
rm /tmp/smartkey.zip

# Normalize folder name to 'smartkey' for branch builds
if [[ -d ~/.config/chromium-extensions/"smartkey-${INPUT}" ]]; then
  mv ~/.config/chromium-extensions/"smartkey-${INPUT}" ~/.config/chromium-extensions/smartkey
fi
