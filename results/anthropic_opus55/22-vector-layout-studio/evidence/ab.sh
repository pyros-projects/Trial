#!/usr/bin/env bash
# Test helpers around agent-browser (dev only). Source this file.
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-vls}
AB=agent-browser
# diag <js-expr on d> : evaluate an expression against VLS.diagnostics() (read-only)
diag() { printf "(()=>{const d = VLS.diagnostics(); return JSON.stringify(%s);})()" "$1" | $AB eval --stdin; }
# pt X Y : print page coordinates for document point (X,Y)
pt() { printf "(()=>{const d=VLS.diagnostics();const r=document.getElementById(\"stage\").getBoundingClientRect();return [Math.round(r.left+d.pan.x+(%s)*d.zoom), Math.round(r.top+d.pan.y+(%s)*d.zoom)].join(\" \");})()" "$1" "$2" | $AB eval --stdin | tr -d '"'; }
# drag X1 Y1 X2 Y2 [steps] : real mouse drag in page coordinates
drag() { local s=${5:-8}; $AB mouse move "$1" "$2" >/dev/null; $AB mouse down left >/dev/null;
  for i in $(seq 1 "$s"); do local x=$(python3 -c "print(round($1+($3-$1)*$i/$s))"); local y=$(python3 -c "print(round($2+($4-$2)*$i/$s))"); $AB mouse move "$x" "$y" >/dev/null; done
  $AB mouse up left >/dev/null; }
# click X Y : mouse click at page coordinates
clk() { $AB mouse move "$1" "$2" >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; }
# fresh() : open the app with a cache-busting URL at 1280x800
fresh() { $AB set viewport ${1:-1280} ${2:-800} >/dev/null; $AB open "http://127.0.0.1:8765/index.html?v=$(date +%s%N)" >/dev/null; $AB wait 200 >/dev/null; }
