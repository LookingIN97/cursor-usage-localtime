#!/usr/bin/env bash
# Copies extension/ to a folder on the Windows side, so Chrome can "Load unpacked" from a plain Windows path
# (Chrome is happier with C:\... than with \\wsl.localhost\...). Run it again after every change; then press the
# reload button of the extension on chrome://extensions.
#
#   scripts/sync-to-windows.sh [target-dir]      default: %USERPROFILE%\chrome-extensions\cursor-usage-localtime
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -ge 1 ]; then
  target="$1"
else
  profile="$(cmd.exe /c "echo %USERPROFILE%" 2>/dev/null | tr -d '\r')"
  [ -n "$profile" ] || { echo "could not resolve %USERPROFILE%; pass a target directory" >&2; exit 1; }
  target="$(wslpath -u "$profile")/chrome-extensions/cursor-usage-localtime"
fi

mkdir -p "$target"
# --delete keeps the copy identical to extension/ (no stale files); it only ever touches $target.
rsync -a --delete "$here/extension/" "$target/"

echo "synced to: $(wslpath -w "$target")"
echo "version:   $(grep -m1 '"version"' "$target/manifest.json" | tr -d ' ,')"
