#!/bin/bash
set -e
cat head.html part_sim.js part_render.js part_ui.js > /tmp/asm.html
printf '</script>\n</body>\n</html>\n' >> /tmp/asm.html
mv /tmp/asm.html index.html
