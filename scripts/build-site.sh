#!/usr/bin/env sh
# PYTHON may name an executable path; it is never evaluated as shell code.
set -eu
cd "$(dirname "$0")/.."
if [ -n "${PYTHON:-}" ]; then
    python_bin=$PYTHON
elif command -v python3 >/dev/null 2>&1; then
    python_bin=python3
elif command -v python >/dev/null 2>&1; then
    python_bin=python
else
    printf '%s\n' 'Python 3.11 or newer is required. Set PYTHON to its executable path.' >&2
    exit 1
fi
exec "$python_bin" tools/build_site.py "$@"
