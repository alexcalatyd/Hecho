#!/bin/zsh
# Builds Hecho.app: the web interface, the native shell and the icon.
#   ./build.sh            → build/Hecho.app
#   ./build.sh --install  → also copies it to /Applications and opens it
set -e
cd "$(dirname "$0")"
ROOT=$(pwd)
APP=$ROOT/build/Hecho.app

echo "› interface"
(cd web && { [ -d node_modules ] || npm install --silent; } && npm run build --silent >/dev/null)

echo "› native shell"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
swiftc -O -target arm64-apple-macos14 -o "$APP/Contents/MacOS/Hecho" native/main.swift
cp -R web/dist "$APP/Contents/Resources/web"
cp native/Info.plist "$APP/Contents/Info.plist"

echo "› icon"
TMP=$(mktemp -d); mkdir "$TMP/Hecho.iconset"
qlmanage -t -s 1024 -o "$TMP" web/public/favicon.svg >/dev/null 2>&1 || true
if [ -f "$TMP/favicon.svg.png" ]; then
  for s in 16 32 128 256 512; do
    sips -z $s $s "$TMP/favicon.svg.png" --out "$TMP/Hecho.iconset/icon_${s}x${s}.png" >/dev/null
    sips -z $((s*2)) $((s*2)) "$TMP/favicon.svg.png" --out "$TMP/Hecho.iconset/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$TMP/Hecho.iconset" -o "$APP/Contents/Resources/Hecho.icns"
fi
rm -rf "$TMP"

codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
echo "✓ $APP"

if [ "$1" = "--install" ]; then
  pkill -x Hecho 2>/dev/null || true
  rm -rf /Applications/Hecho.app
  cp -R "$APP" /Applications/
  open /Applications/Hecho.app
  echo "✓ installed in /Applications"
fi
