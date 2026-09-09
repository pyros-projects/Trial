#!/usr/bin/env bash
# Dev build: bundles src/ into a single self-contained index.html (no runtime deps).
set -euo pipefail
cd "$(dirname "$0")"
{
  cat src/head.html
  echo '<style>'
  cat src/style.css
  echo '</style>'
  echo '</head><body>'
  cat src/body.html
  echo '<script>'
  cat src/*.js
  echo ';window.__BUILD_OK__=true;'
  echo '</script></body></html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
