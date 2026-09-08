#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
shell = open('dev/shell.html').read()
css = open('dev/style.css').read()
js = "\n".join(open(f'dev/app.part{i}.js').read() for i in range(1, 6))
out = shell.replace('/*STYLE*/', css).replace('/*SCRIPT*/', js)
open('index.html', 'w').write(out)
print(f"index.html: {len(out)} bytes")
PY
