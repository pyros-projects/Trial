#!/usr/bin/env bash
# Dev-only build: concatenates src/ parts into a single self-contained index.html.
# The delivered index.html has zero runtime dependencies.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=index.html
{
  cat src/01-head.html
  echo '<style>'
  cat src/02-style.css
  echo '</style>'
  echo '</head>'
  cat src/03-body.html
  echo '<script>'
  for f in src/[1-9][0-9]-*.js; do
    echo "/* ==================== $(basename "$f") ==================== */"
    cat "$f"
  done
  echo '</script>'
  cat src/99-tail.html
} > "$OUT"
BYTES=$(wc -c < "$OUT"); LINES=$(wc -l < "$OUT")
echo "built $OUT: ${BYTES} bytes, ${LINES} lines"
# Guard: no external references allowed in the delivered artifact
if grep -nE '(src|href)="(https?:)?//|@import|fetch\(|XMLHttpRequest|importScripts' "$OUT" | grep -v 'NO-EXTERNAL-OK'; then
  echo "!! EXTERNAL REFERENCE DETECTED" >&2; exit 1
fi
echo "self-containment guard: OK"
