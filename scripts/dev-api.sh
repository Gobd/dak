#!/bin/bash
# Run Cloudflare Pages Functions locally for testing
# All apps using @dak/vite-shared-react will auto-load from monorepo .env.local

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(dirname "$SCRIPT_DIR")"
PORT="${1:-8788}"
ENV_FILE="$MONOREPO_ROOT/.env.local"

# Create/update .env.local with local API URL
echo "VITE_API_URL=http://localhost:$PORT" > "$ENV_FILE"
echo "VITE_APP_URL=http://localhost:$PORT" >> "$ENV_FILE"

echo "Created $ENV_FILE with local API URLs"
echo "All apps will use http://localhost:$PORT"
echo ""
echo "Starting wrangler on port $PORT..."
echo "(Ctrl+C to stop, .env.local will remain for next run)"
echo ""

cd "$MONOREPO_ROOT" || exit
npx wrangler pages dev . --port "$PORT"
