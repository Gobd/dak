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

mkdir -p _site/_spa

for app in "${apps[@]}"; do
  cp -r "$app/dist" "_site/$app"
  # Copy index.html into _spa/ subdirectory as the SPA fallback target.
  # Must live outside /$app/* to avoid Cloudflare detecting a redirect loop,
  # and inside a real directory so Pretty URLs doesn't strip the .html extension.
  cp "$app/dist/index.html" "_site/_spa/${app}"
done

# Generate _redirects for SPA client-side routing (Cloudflare Pages)
{
  for app in "${apps[@]}"; do
    echo "/$app/* /_spa/${app} 200"
  done
} > _site/_redirects
