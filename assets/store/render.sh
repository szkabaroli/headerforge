#!/usr/bin/env bash
# Regenerate the Chrome Web Store graphic assets.
# Requires Google Chrome and ImageMagick (`magick`).
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

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

# Screenshot (1280x800): render the REAL popup (popup.html/css/js) with mocked
# chrome.storage sample data, at 2x, then downscale for crisp text.
# Served over HTTP (not file://) because popup.js is an ES module and Chrome
# refuses to load modules over file://. Light color scheme is forced so the
# store shot is deterministic across systems.
PORT=8791
python3 -m http.server "$PORT" --directory ../.. >/dev/null 2>&1 &
SRV=$!
trap 'kill "$SRV" 2>/dev/null || true' EXIT
URL="http://localhost:$PORT/assets/store/preview.html"
for _ in $(seq 1 50); do curl -sf "$URL" >/dev/null 2>&1 && break; sleep 0.1; done

"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1280,800 --blink-settings=preferredColorScheme=1 \
  --virtual-time-budget=1500 \
  --screenshot=screenshot-2x.png "$URL"

kill "$SRV" 2>/dev/null || true
trap - EXIT
magick screenshot-2x.png -resize 1280x800 screenshot-1280x800.png
rm -f screenshot-2x.png

# Promo tiles from SVG.
magick -background none marquee.svg -resize 2800x1120 -resize 1400x560 marquee-1400x560.png
magick -background none small-promo.svg -resize 880x560 -resize 440x280 small-promo-440x280.png

# Chrome Web Store rejects alpha — flatten to 8-bit RGB.
for f in screenshot-1280x800 marquee-1400x560 small-promo-440x280; do
  magick "$f.png" -background white -alpha remove -alpha off -depth 8 -define png:color-type=2 "$f.png"
done

echo "Rendered: screenshot-1280x800.png, marquee-1400x560.png, small-promo-440x280.png"
