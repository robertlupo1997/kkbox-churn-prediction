#!/usr/bin/env bash
# Build the dashboard as a static site that needs no server (issue #24).
#
#   scripts/build_static_site.sh [OUT_DIR]     # default: static-site/
#
# 1. scripts/export_static_bundle.py records the API's answers for every
#    holdout member into static-bundle/.
# 2. The dashboard is built with VITE_DATA_MODE=static, so it reads those files
#    instead of calling /api.
# 3. The bundle is copied next to the built app as data-bundle/.
#
# The result is plain files: serve OUT_DIR with any static host or
# `python -m http.server`. Routing is hash-based (#/lookup), so no rewrite
# rules are needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$ROOT/static-site}"
FRONTEND="$ROOT/brutalist-aesthetic-kkbox-churn-analysis-pro"
PY="${PYTHON:-python3}"

"$PY" "$ROOT/scripts/export_static_bundle.py" --out "$ROOT/static-bundle" > /dev/null

cd "$FRONTEND"
[ -d node_modules ] || npm ci --legacy-peer-deps
VITE_DATA_MODE=static npx vite build --base ./ --outDir "$OUT" --emptyOutDir

rm -rf "$OUT/data-bundle"
cp -r "$ROOT/static-bundle" "$OUT/data-bundle"
echo "Static site written to $OUT ($(du -sh "$OUT" | cut -f1))"
