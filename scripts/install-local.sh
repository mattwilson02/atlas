#!/usr/bin/env bash
# Build Atlas and run it as a login-time background service on http://localhost:5181.
# Re-run any time to update it. Undo with scripts/uninstall-local.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${ATLAS_PORT:-5181}"
DEST="$HOME/.local/share/atlas"
DATA="$HOME/.local/share/atlas-data"   # boards + snapshots, kept apart from the app so updates never touch them
BACKUP="${ATLAS_BACKUP_DIR:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Atlas Backups}"
LABEL="tech.mattwilson.atlas"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
NODE="$(command -v node)"

echo "Building…"
pnpm install --frozen-lockfile >/dev/null
pnpm build >/dev/null

echo "Installing to $DEST"
mkdir -p "$DEST" "$DATA"
rsync -a --delete dist/ "$DEST/dist/"
cp scripts/serve.mjs "$DEST/serve.mjs"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array>
    <string>$NODE</string><string>$DEST/serve.mjs</string><string>$DEST/dist</string><string>$PORT</string><string>$DATA</string><string>$BACKUP</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DEST/atlas.log</string>
  <key>StandardErrorPath</key><string>$DEST/atlas.log</string>
</dict></plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

sleep 1
if curl -fsS -o /dev/null "http://localhost:$PORT/"; then
  echo "Atlas is running: http://localhost:$PORT"
else
  echo "Started, but not answering yet. Check $DEST/atlas.log" >&2
  exit 1
fi
