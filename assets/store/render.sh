#!/usr/bin/env bash
# Regenerate the Chrome Web Store graphic assets.
# Requires Google Chrome and ImageMagick (`magick`).
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# Flags shared by every headless render. Uses the default profile (a fresh
# --user-data-dir triggers slow first-run/updater work); the two renders run
# sequentially so they never hold the profile lock at the same time.
CHROME_FLAGS=(--headless=new --disable-gpu --hide-scrollbars
  --force-device-scale-factor=2 --window-size=1280,800
  --disable-background-networking --virtual-time-budget=1500)

# Regenerate preview-popup.html from the REAL popup.html so the screenshot never
# drifts from the shipped markup: point CSS/JS at the repo root and inject the
# chrome.storage mock before popup.js.
node -e '
const fs = require("fs");
let h = fs.readFileSync("../../popup.html","utf8");
h = h.replace("href=\"popup.css\"", "href=\"../../popup.css\"");
// mock-chrome.js (classic) runs first; popup.js is a module that imports
// ../../rules.js relative to itself. Point it at the repo root.
h = h.replace("<script type=\"module\" src=\"popup.js\"></script>",
  "<script src=\"mock-chrome.js\"></script>\n    <script type=\"module\" src=\"../../popup.js\"></script>");
fs.writeFileSync("preview-popup.html", h);
'

# Render the REAL popup (popup.html/css/js) with mocked chrome.storage sample
# data into a store scene, at 2x, then downscale for crisp text. Served over
# HTTP (not file://) because popup.js is an ES module and Chrome won't load
# modules over file://. preferredColorScheme: 1 = light, 0 = dark.
#
# Each screenshot gets its own throwaway server + port + profile so the two
# headless runs can't interfere (a shared server dropped the second render).
shoot() {
  local page=$1 final=$2 scheme=$3 port=$4
  python3 -m http.server "$port" --directory ../.. >/dev/null 2>&1 &
  local srv=$!
  local url="http://localhost:$port/assets/store/$page"
  for _ in $(seq 1 50); do curl -sf "$url" >/dev/null 2>&1 && break; sleep 0.1; done
  "$CHROME" "${CHROME_FLAGS[@]}" \
    --blink-settings=preferredColorScheme="$scheme" --screenshot=_2x.png "$url"
  kill "$srv" 2>/dev/null || true
  wait "$srv" 2>/dev/null || true
  magick _2x.png -resize 1280x800 "$final"
  rm -f _2x.png
}

shoot preview.html screenshot-1280x800.png 1 8791
shoot preview-dark.html screenshot-dark-1280x800.png 0 8792

# Promo tiles from SVG.
magick -background none marquee.svg -resize 2800x1120 -resize 1400x560 marquee-1400x560.png
magick -background none small-promo.svg -resize 880x560 -resize 440x280 small-promo-440x280.png

# Chrome Web Store rejects alpha, so flatten to 8-bit RGB.
for f in screenshot-1280x800 screenshot-dark-1280x800 marquee-1400x560 small-promo-440x280; do
  magick "$f.png" -background white -alpha remove -alpha off -depth 8 -define png:color-type=2 "$f.png"
done

echo "Rendered: screenshot-1280x800.png, screenshot-dark-1280x800.png, marquee-1400x560.png, small-promo-440x280.png"
