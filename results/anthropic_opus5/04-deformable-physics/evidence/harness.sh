#!/usr/bin/env bash
# Test harness helpers for driving the Deformable Lab through agent-browser.
# Kept outside index.html on purpose: the delivered artifact has no test hooks.
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-deflab}
URL=${URL:-http://127.0.0.1:8917/index.html}
ab() { agent-browser "$@"; }
# open the app and wait until the sim object exists
boot() {
  agent-browser set viewport "${1:-1280}" "${2:-800}" >/dev/null 2>&1
  agent-browser open "$URL" >/dev/null 2>&1
  for i in $(seq 1 25); do
    [ "$(agent-browser eval 'typeof S' 2>/dev/null | tail -1)" = '"object"' ] && return 0
    sleep 0.3
  done
  echo "BOOT FAILED"; return 1
}
# evaluate a JS snippet from stdin, print the last line
js() { agent-browser eval --stdin 2>&1 | tail -1; }
# world (wx,wy) -> viewport client px, printed as "X Y"
w2s() {
  agent-browser eval "(()=>{const r=document.getElementById('stage').getBoundingClientRect();
    return Math.round(r.left+view.ox+($1)*view.scale)+' '+Math.round(r.top+view.oy+($2)*view.scale);})()" 2>&1 \
    | tail -1 | tr -d '"'
}
drag() { # drag x1 y1 x2 y2 steps  (client px)
  local x1=$1 y1=$2 x2=$3 y2=$4 n=${5:-14}
  agent-browser mouse move "$x1" "$y1" >/dev/null
  agent-browser mouse down left >/dev/null
  for i in $(seq 1 "$n"); do
    local x=$(( x1 + (x2-x1)*i/n )) y=$(( y1 + (y2-y1)*i/n ))
    agent-browser mouse move "$x" "$y" >/dev/null
  done
  agent-browser mouse up left >/dev/null
}
