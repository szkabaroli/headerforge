#!/usr/bin/env bash
# Regenerate the Chrome Web Store graphic assets.
# Requires Google Chrome and ImageMagick (`magick`).
set -euo pipefail
cd "$(dirname "$0")"

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Screenshot (1280x800): render the REAL popup (popup.html/css/js) with mocked
# chrome.storage sample data, at 2x, then downscale for crisp text.
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1280,800 --screenshot=screenshot-2x.png "file://$PWD/preview.html"
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
