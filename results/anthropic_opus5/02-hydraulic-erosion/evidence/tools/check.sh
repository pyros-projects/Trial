#!/bin/bash
# Extract the inline script from index.html and syntax-check it with node.
cd "$(dirname "$0")/../.." || exit 1
python3 - <<'PY'
import re
src = open('index.html').read()
m = re.search(r'<script>\n(.*)\n</script>', src, re.S)
open('/tmp/ero.js','w').write(m.group(1))
PY
node --check /tmp/ero.js && echo "SYNTAX OK"
