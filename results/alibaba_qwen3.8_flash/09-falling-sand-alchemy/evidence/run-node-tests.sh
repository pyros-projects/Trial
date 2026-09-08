#!/usr/bin/env bash
# Dev harness: sim.js is DOM-free, so the engine can be tested headless.
set -e
cd "$(dirname "$0")/.."
cat src/sim.js evidence/test-sim.js > /tmp/fsa-test.js
node /tmp/fsa-test.js "$@"
