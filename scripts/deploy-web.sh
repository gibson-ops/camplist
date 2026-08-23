#!/usr/bin/env bash
#
# Builds the web app for production and publishes it to the directory Caddy serves.
#
# THIS IS THE BUILD JARED'S HOME SCREEN POINTS AT, and it is deliberately not the dev server.
# A dev bundle is ~12MB, needs Metro alive on this machine, and — the reason it matters most —
# keeps __DEV__ on, which means @expo/log-box paints a red error overlay over the app for anything
# that reaches console.error. An app you packed a real trip with should not do that. The export
# strips __DEV__, minifies to ~4.6MB, and once published needs no process of ours running at all:
# Caddy serves files, and Caddy is a systemd service that survives a reboot.
#
# Caddy runs as `caddy` and cannot traverse /home/jared (0750), which is why the build is copied
# out to /srv/camplist rather than served from the worktree.
#
# Usage:  scripts/deploy-web.sh [--skip-build]
# Exit:   0 published, 1 build or publish failed, 2 smoke test failed
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVE_DIR="${CAMPLIST_SERVE_DIR:-/srv/camplist}"
URL="${CAMPLIST_URL:-https://cl-alpha.argo.gibsonops.com}"

# Only node 22.22.2 has a working npm on this machine.
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"

if [[ "${1:-}" != "--skip-build" ]]; then
  echo "==> building (expo export -p web)"
  cd "$REPO/mobile"
  rm -rf dist
  npx expo export -p web >/dev/null
fi

[[ -f "$REPO/mobile/dist/index.html" ]] || {
  echo "!! no build at mobile/dist — nothing to publish" >&2
  exit 1
}

echo "==> publishing to $SERVE_DIR"
# --delete so a renamed hashed bundle doesn't leave its predecessor behind forever.
rsync -a --delete "$REPO/mobile/dist/" "$SERVE_DIR/"

# Smoke test the things that make it installable, because a missing manifest fails silently:
# the app still loads and "Add to Home Screen" quietly goes back to saving a screenshot.
echo "==> checking $URL"
fail=0
for path in / /manifest.json /icons/apple-touch-icon.png /icons/icon-512.png; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$URL$path" || echo 000)
  printf '    %-32s %s\n' "$path" "$code"
  [[ "$code" == "200" ]] || fail=1
done

# A deep link has to return the app rather than a 404, or a reload inside the installed app is a
# dead end. That is the SPA fallback in the Caddyfile, and it is easy to lose.
code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 20 "$URL/trip/does-not-exist" || echo 000)
printf '    %-32s %s (SPA fallback)\n' "/trip/…" "$code"
[[ "$code" == "200" ]] || fail=1

if [[ "$fail" != "0" ]]; then
  echo "!! published, but the smoke test failed — check the Caddy route for $URL" >&2
  exit 2
fi

echo "==> $URL is live"
