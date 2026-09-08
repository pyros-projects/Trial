#!/usr/bin/env bash
exec agent-browser --session filetest \
  --proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1,localhost \
  --args --autoplay-policy=no-user-gesture-required,--mute-audio "$@"
