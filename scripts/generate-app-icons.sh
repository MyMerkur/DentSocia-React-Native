#!/usr/bin/env bash
# Generates iOS AppIcon.appiconset and Android mipmap launcher icons from a
# single SVG glyph source, using only macOS's built-in `sips` (no rsvg-convert
# / ImageMagick / Inkscape dependency).
#
# The source SVG is expected to be a monochrome glyph drawn with
# stroke="currentColor" and no background (see DentSociaLogo/dentsocia-d.svg).
# This script flattens it onto an opaque square with an explicit background
# and foreground color, then rasterizes it at every required app-icon size.
#
# Usage:
#   scripts/generate-app-icons.sh [svg_source] [bg_hex] [fg_hex]
#
# Defaults: DentSociaLogo/dentsocia-d.svg, background #FFFFFF, glyph #000000.
set -euo pipefail

SVG_SOURCE="${1:-DentSociaLogo/dentsocia-d.svg}"
BG_HEX="${2:-#FFFFFF}"
FG_HEX="${3:-#000000}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SVG_SOURCE="$REPO_ROOT/$SVG_SOURCE"
IOS_ICONSET="$REPO_ROOT/apps/mobile/ios/DentSociaMobile/Images.xcassets/AppIcon.appiconset"
ANDROID_RES="$REPO_ROOT/apps/mobile/android/app/src/main/res"

if ! command -v sips >/dev/null 2>&1; then
  echo "error: sips not found (this script is macOS-only)" >&2
  exit 1
fi
if [ ! -f "$SVG_SOURCE" ]; then
  echo "error: SVG source not found at $SVG_SOURCE" >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

# --- Parse the source SVG -------------------------------------------------
VIEWBOX="$(grep -o 'viewBox="[^"]*"' "$SVG_SOURCE" | head -1 | sed -E 's/viewBox="([0-9. ]+)"/\1/')"
VB_W="$(echo "$VIEWBOX" | awk '{print $3}')"
VB_H="$(echo "$VIEWBOX" | awk '{print $4}')"
PATHS="$(grep -o '<path[^/]*/>' "$SVG_SOURCE" | sed -E 's/ ?stroke="currentColor"//')"

# --- Build flattened SVG templates (square, and circular-clip for round) --
{
  echo "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${VB_W} ${VB_H}\" width=\"__SIZE__\" height=\"__SIZE__\">"
  echo "  <rect width=\"${VB_W}\" height=\"${VB_H}\" fill=\"${BG_HEX}\"/>"
  echo "  <g fill=\"none\" stroke=\"${FG_HEX}\">"
  echo "$PATHS"
  echo "  </g>"
  echo "</svg>"
} > "$WORKDIR/square.svg.tmpl"

{
  R="$(awk "BEGIN { print ${VB_W}/2 }")"
  echo "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${VB_W} ${VB_H}\" width=\"__SIZE__\" height=\"__SIZE__\">"
  echo "  <defs><clipPath id=\"round\"><circle cx=\"${R}\" cy=\"${R}\" r=\"${R}\"/></clipPath></defs>"
  echo "  <g clip-path=\"url(#round)\">"
  echo "    <rect width=\"${VB_W}\" height=\"${VB_H}\" fill=\"${BG_HEX}\"/>"
  echo "    <g fill=\"none\" stroke=\"${FG_HEX}\">"
  echo "$PATHS"
  echo "    </g>"
  echo "  </g>"
  echo "</svg>"
} > "$WORKDIR/round.svg.tmpl"

# render_opaque <template> <size> <out.png>  -- rasterizes then strips the
# alpha channel via a JPEG round-trip (required for the iOS 1024 App Store
# icon; harmless for every other opaque square icon).
render_opaque() {
  local tmpl="$1" size="$2" out="$3"
  sed "s/__SIZE__/${size}/g" "$tmpl" > "$WORKDIR/render.svg"
  sips -s format png "$WORKDIR/render.svg" --out "$WORKDIR/render.png" >/dev/null
  sips -s format jpeg "$WORKDIR/render.png" --out "$WORKDIR/render.jpg" >/dev/null
  sips -s format png "$WORKDIR/render.jpg" --out "$out" >/dev/null
}

# render_alpha <template> <size> <out.png>  -- rasterizes keeping transparency
# (used for the Android round icon, whose corners must stay transparent).
render_alpha() {
  local tmpl="$1" size="$2" out="$3"
  sed "s/__SIZE__/${size}/g" "$tmpl" > "$WORKDIR/render.svg"
  sips -s format png "$WORKDIR/render.svg" --out "$out" >/dev/null
}

echo "== iOS AppIcon.appiconset ($IOS_ICONSET) =="
mkdir -p "$IOS_ICONSET"
# pointSize:scale:pixels:filename
IOS_SPECS=(
  "20:2:40:icon-20@2x.png"
  "20:3:60:icon-20@3x.png"
  "29:2:58:icon-29@2x.png"
  "29:3:87:icon-29@3x.png"
  "40:2:80:icon-40@2x.png"
  "40:3:120:icon-40@3x.png"
  "60:2:120:icon-60@2x.png"
  "60:3:180:icon-60@3x.png"
)
for spec in "${IOS_SPECS[@]}"; do
  IFS=: read -r pt scale px filename <<< "$spec"
  render_opaque "$WORKDIR/square.svg.tmpl" "$px" "$IOS_ICONSET/$filename"
  echo "  $filename (${px}x${px}, ${pt}pt@${scale}x)"
done
render_opaque "$WORKDIR/square.svg.tmpl" 1024 "$IOS_ICONSET/icon-1024.png"
echo "  icon-1024.png (1024x1024, App Store marketing)"

cat > "$IOS_ICONSET/Contents.json" << JSON
{
  "images" : [
    { "idiom" : "iphone", "scale" : "2x", "size" : "20x20", "filename" : "icon-20@2x.png" },
    { "idiom" : "iphone", "scale" : "3x", "size" : "20x20", "filename" : "icon-20@3x.png" },
    { "idiom" : "iphone", "scale" : "2x", "size" : "29x29", "filename" : "icon-29@2x.png" },
    { "idiom" : "iphone", "scale" : "3x", "size" : "29x29", "filename" : "icon-29@3x.png" },
    { "idiom" : "iphone", "scale" : "2x", "size" : "40x40", "filename" : "icon-40@2x.png" },
    { "idiom" : "iphone", "scale" : "3x", "size" : "40x40", "filename" : "icon-40@3x.png" },
    { "idiom" : "iphone", "scale" : "2x", "size" : "60x60", "filename" : "icon-60@2x.png" },
    { "idiom" : "iphone", "scale" : "3x", "size" : "60x60", "filename" : "icon-60@3x.png" },
    { "idiom" : "ios-marketing", "scale" : "1x", "size" : "1024x1024", "filename" : "icon-1024.png" }
  ],
  "info" : { "author" : "xcode", "version" : 1 }
}
JSON
echo "  Contents.json updated with filename references"

echo
echo "== Android mipmap ($ANDROID_RES) =="
ANDROID_SPECS=(
  "mdpi:48"
  "hdpi:72"
  "xhdpi:96"
  "xxhdpi:144"
  "xxxhdpi:192"
)
for spec in "${ANDROID_SPECS[@]}"; do
  IFS=: read -r density px <<< "$spec"
  dir="$ANDROID_RES/mipmap-$density"
  mkdir -p "$dir"
  render_opaque "$WORKDIR/square.svg.tmpl" "$px" "$dir/ic_launcher.png"
  render_alpha "$WORKDIR/round.svg.tmpl" "$px" "$dir/ic_launcher_round.png"
  echo "  mipmap-$density/ic_launcher.png + ic_launcher_round.png (${px}x${px})"
done

echo
echo "Done. Background ${BG_HEX}, glyph ${FG_HEX}, source $(basename "$SVG_SOURCE")."
