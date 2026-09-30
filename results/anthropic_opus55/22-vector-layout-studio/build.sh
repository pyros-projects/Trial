#!/usr/bin/env bash
# Dev-only build: inlines src/*.js into src/shell.html -> index.html (single self-contained file).
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
import re, pathlib
shell = pathlib.Path('src/shell.html').read_text()
js = "\n".join(pathlib.Path(f'src/{n}').read_text() for n in ['core.js','comps.js','app.js'])
assert '</script' not in js.lower(), 'script terminator inside JS'
body = "(() => {\n" + js + "\n})();"
out = shell.replace('/*__APP__*/', body)
pathlib.Path('index.html').write_text(out)
print('index.html', len(out), 'bytes')
PY
