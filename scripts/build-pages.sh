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
done

# Generate _redirects for SPA client-side routing (Cloudflare Pages)
{
  for app in "${apps[@]}"; do
    echo "/$app/*  /$app/index.html  200"
  done
} > _site/_redirects
