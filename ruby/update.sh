#!/bin/zsh
# Keeps /Applications/Paseo.app on the `ruby-highlighting` branch: pulls it, builds it,
# and swaps the app in while Paseo is closed. launchd runs this every hour.
set -euo pipefail

STATE="$HOME/.paseo-ruby"
REPO="$STATE/paseo"
APP=/Applications/Paseo.app
STAGED="$STATE/staged/Paseo.app"
if [[ "$(uname -m)" == arm64 ]]; then ARCH=arm64 OUT=mac-arm64; else ARCH=x64 OUT=mac; fi
BUILT="packages/desktop/release/$OUT/Paseo.app"

log() { print -r -- "$(date '+%F %T') $1"; }
notify() { log "$1"; osascript -e "display notification \"$1\" with title \"Paseo Ruby\"" || true; }

install() {
  [[ -d "$STAGED" ]] || return 0
  pgrep -qf "$APP/Contents/" && return 0
  if [[ -e "$APP/Contents/Resources/app-update.yml" ]]; then
    rm -rf "$STATE/official" && mkdir -p "$STATE/official" && mv "$APP" "$STATE/official/"
  else
    rm -rf "$APP"
  fi
  mv "$STAGED" "$APP"
  mv "$STATE/staged.commit" "$STATE/installed.commit"
  notify "Paseo updated with Ruby highlighting."
}

install

cd "$REPO"
git fetch -q origin ruby-highlighting
git reset -q --hard origin/ruby-highlighting
cp ruby/update.sh "$STATE/update.sh.new" && mv "$STATE/update.sh.new" "$STATE/update.sh"

commit="$(git rev-parse HEAD)"
for f in installed staged failed; do
  [[ "$(cat "$STATE/$f.commit" 2>/dev/null)" == "$commit" ]] && exit 0
done

log "building $commit"
if npm ci --no-audit --no-fund &&
  npm run build:app-deps:clean &&
  (cd packages/app && PASEO_WEB_PLATFORM=electron npx expo export --platform web) &&
  rm -rf packages/desktop/release &&
  CSC_IDENTITY_AUTO_DISCOVERY=false npm run build --workspace=@getpaseo/desktop -- \
    --mac dir --$ARCH -c.mac.notarize=false -c.mac.identity=null -c.publish=null &&
  codesign --force --deep --sign - "$BUILT"
then
  rm -rf "$STATE/staged" && mkdir -p "$STATE/staged" && ditto "$BUILT" "$STAGED"
  echo "$commit" > "$STATE/staged.commit"
  pgrep -qf "$APP/Contents/" && notify "Paseo update ready. It installs the next time you quit Paseo."
  install
else
  echo "$commit" > "$STATE/failed.commit"
  notify "Paseo Ruby build failed. See ~/.paseo-ruby/update.log."
fi
