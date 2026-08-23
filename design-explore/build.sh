#!/usr/bin/env bash
# Generate SVG comparison sheets and rasterize to PNG with resvg.
set -euo pipefail
cd "$(dirname "$0")"
FONTS=fonts
mkdir -p out

python3 compose.py

render() {  # <name> <zoom>
  local n="$1" z="${2:-1}"
  resvg --skip-system-fonts --use-fonts-dir "$FONTS" --font-family "Source Sans 3" \
        --zoom "$z" "out/$n.svg" "out/$n.png" 2>&1 | grep -v '^$' || true
}

render 01-directions 1.4
render 02-home-dark 1
render 02-home-light 1
render 03-small 1.4

ls -la out/*.png
