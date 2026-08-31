#!/usr/bin/env bash
# Renders each widget's embed page in headless Chrome and writes the homepage card
# thumbnails to src/assets/thumbnails/. Zero dependencies beyond Chrome and python3.
#
# The PNGs it writes are committed, and the homepage crops them to the card's aspect ratio
# in CSS. This is a manual tool, not part of the build: run `npm run build && npm run
# thumbnails` when a widget's appearance changes, then commit the updated images.
#
# It serves dist/, so the site must be built first, with the default base "/". Pages are
# requested by their built filename (embed.html): the static server does no extensionless
# URL rewriting.
#
# Determinism: --force-prefers-reduced-motion makes the widgets skip their self-playing
# tours (they already check for it), so every capture is the same canonical initial frame,
# and --virtual-time-budget fast-forwards timers while waiting out network fetches.
#
# A page that renders no canvas — or shows the SST widget's data-unavailable notice —
# keeps the committed thumbnail instead of overwriting it with a broken image; that only
# warns, but a missing thumbnail at the end fails the script, since the homepage build
# would then reference a file that does not exist.
set -uo pipefail

cd "$(dirname "$0")/.."

OUT=src/assets/thumbnails
PORT="${THUMBNAIL_PORT:-8123}"

if [ ! -f dist/index.html ]; then
  echo "dist/ is not built — run npm run build first" >&2
  exit 1
fi

CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done
if [ -z "$CHROME" ]; then
  echo "no Chrome or Chromium binary found" >&2
  exit 1
fi

python3 -m http.server "$PORT" --directory dist --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

mkdir -p "$OUT"

CHROME_FLAGS=(--headless=new --disable-gpu --no-sandbox --hide-scrollbars
  --force-prefers-reduced-motion --force-device-scale-factor=2
  --virtual-time-budget=15000)

# shoot <name> <path> <WxH window size> <error text that must not appear>
shoot() {
  local name=$1 path=$2 size=$3 must_not=$4
  local url="http://127.0.0.1:$PORT/$path"
  local dom
  dom=$("$CHROME" "${CHROME_FLAGS[@]}" --dump-dom "$url" 2>/dev/null)
  # The two maps are SVG widgets; the rest render a canvas. The class marker is set by
  # the widget itself, so a page whose module failed to load has neither.
  local must_have="<canvas"
  case $name in belief-map|policy-support-map) must_have="class=\"$name\"" ;; esac
  if ! grep -q "$must_have" <<<"$dom"; then
    echo "WARN: $name rendered no figure — keeping the existing thumbnail" >&2
    return
  fi
  if [ -n "$must_not" ] && grep -q "$must_not" <<<"$dom"; then
    echo "WARN: $name shows its error notice — keeping the existing thumbnail" >&2
    return
  fi
  if "$CHROME" "${CHROME_FLAGS[@]}" --window-size="$size" \
      --screenshot="$OUT/$name.png" "$url" 2>/dev/null; then
    echo "wrote $OUT/$name.png"
  else
    echo "WARN: Chrome failed to screenshot $name — keeping the existing thumbnail" >&2
  fi
}

# Captured square at the widgets' own 640 px cap, so the PNGs are already card-shaped and
# the homepage does not have to crop them. Anything past 640 px of height is simply out of
# frame: for the two tall widgets that trims the bottom axis label and the outer edge of
# the month ring, neither of which a thumbnail needs.
#
# Do not ask for a narrower window: Chrome clamps --window-size to a minimum window width
# (about 500 px on macOS), so a smaller number silently yields a wider viewport than
# requested and a figure that overflows the capture.
for name in draw-the-future temperature-trend sst-daily belief-map policy-support-map; do
  case $name in
    sst-daily) guard="Could not load the daily sea surface temperature" ;;
    *) guard="" ;;
  esac
  shoot "$name" "$name/embed.html" 640,640 "$guard"
done

status=0
for name in draw-the-future temperature-trend sst-daily belief-map policy-support-map; do
  if [ ! -f "$OUT/$name.png" ]; then
    echo "ERROR: $OUT/$name.png does not exist and could not be generated" >&2
    status=1
  fi
done
exit $status
