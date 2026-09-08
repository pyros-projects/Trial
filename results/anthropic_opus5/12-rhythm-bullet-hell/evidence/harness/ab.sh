#!/usr/bin/env bash
# Fixed launch options for every agent-browser call in this validation run.
# The dead proxy blocks all external internet; localhost is bypassed so the
# local test server stays reachable.
exec agent-browser --session pulse \
  --proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1,localhost \
  --args --autoplay-policy=no-user-gesture-required,--mute-audio "$@"
