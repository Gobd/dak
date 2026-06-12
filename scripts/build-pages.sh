#!/usr/bin/env bash
set -euo pipefail

# Build all packages
pnpm build

# Clean and create output directory
rm -rf _site
mkdir -p _site/_shared

# Copy root files
cp _site_index.html _site/index.html
cp _headers _site/

# Copy shared vendor bundle
cp packages/vite-shared-react/dist/* _site/_shared/

# Copy app builds
apps=(
  climate-display
  dashboard
  family-chores
  health-tracker
  kasa-controller
  maintenance-tracker
  notes-app
  recipe-org
  reddit-gallery
  tracker
)

for app in "${apps[@]}"; do
  cp -r "$app/dist" "_site/$app"
  # Create a copy of index.html outside the app directory to use as the SPA fallback
  # This prevents Cloudflare Pages from detecting an infinite loop (since the target won't match /$app/*)
  cp "$app/dist/index.html" "_site/${app}_spa.html"
done

# Generate _redirects for SPA client-side routing (Cloudflare Pages)
{
  for app in "${apps[@]}"; do
    echo "/$app/ /$app/index.html 200"
    echo "/$app/* /${app}_spa.html 200"
  done
} > _site/_redirects
