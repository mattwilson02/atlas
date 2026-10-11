#!/usr/bin/env bash
# Stop and remove the background service. Your boards live in the browser, not here, so they are untouched.
set -euo pipefail
LABEL="tech.mattwilson.atlas"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
rm -rf "$HOME/.local/share/atlas"
echo "Atlas service removed. Your boards ($HOME/.local/share/atlas-data) and backups were left in place."
