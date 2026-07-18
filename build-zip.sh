#!/usr/bin/env bash
# Build a Chrome Web Store upload package containing only the files the
# extension ships at runtime.
set -euo pipefail

cd "$(dirname "$0")"

OUT_DIR="dist"
OUT_ZIP="$OUT_DIR/headerforge.zip"

# Files/dirs that are part of the shipped extension.
INCLUDE=(
  manifest.json
  background.js
  popup.html
  popup.css
  popup.js
  icons/icon16.png
  icons/icon32.png
  icons/icon48.png
  icons/icon128.png
)

mkdir -p "$OUT_DIR"
rm -f "$OUT_ZIP"

# -X strips extra file attributes so the zip is reproducible-ish.
zip -X -q "$OUT_ZIP" "${INCLUDE[@]}"

echo "Built $OUT_ZIP"
unzip -l "$OUT_ZIP"
