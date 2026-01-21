#!/usr/bin/env bash
set -euo pipefail

# Run all CI checks locally with auto-fix
# Usage: ./scripts/ci.sh

cd "$(dirname "$0")/.."

echo "==> Linting (oxlint --fix)..."
pnpm lint

echo ""
echo "==> Formatting (oxfmt --write)..."
pnpm format

echo ""
echo "==> Syncing Python dependencies..."
(cd dashboard/services/home-relay && uv sync --group dev)

echo ""
echo "==> Running ruff check --fix..."
(cd dashboard/services/home-relay && uv run ruff check --fix .)

echo ""
echo "==> Running ruff format..."
(cd dashboard/services/home-relay && uv run ruff format .)

echo ""
echo "==> Running pyright..."
(cd dashboard/services/home-relay && uv run pyright)

echo ""
echo "==> Regenerating API client..."
(cd dashboard && pnpm gen:api)

echo ""
echo "==> Type checking..."
pnpm typecheck

echo ""
echo "==> Building..."
pnpm build

echo ""
echo "✓ All checks passed. Review changes and commit."
