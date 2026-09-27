#!/bin/bash
# assemble single-file index.html from src parts
cd "$(dirname "$0")"
cat src/top.html src/style.css src/mid.html \
  src/js/const.js src/js/sim.js src/js/ser.js src/js/presets.js \
  src/js/audio.js src/js/render.js src/js/ui.js src/js/input.js src/js/main.js \
  src/bot.html > index.html
echo "built index.html: $(wc -c < index.html) bytes"
