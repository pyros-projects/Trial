#!/bin/bash
# dev-only build: assemble the self-contained index.html from src/ parts
set -e
cd "$(dirname "$0")"
cat src/00_head.html src/10_core.js src/20_gl.js src/30_tools.js src/40_ui.js src/50_main.js src/99_tail.html > index.html
echo "built index.html ($(wc -c < index.html) bytes, $(wc -l < index.html) lines)"
