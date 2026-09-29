#!/usr/bin/env bash
# Helper functions for driving the sandbox with agent-browser (real mouse/keyboard input).
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-alchemy}
EVD="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="file://$(dirname "$EVD")/index.html"
ev()   { agent-browser eval "$1" 2>&1 | tail -1; }                      # evaluate JS, print result
st()   { ev 'JSON.stringify(alchemy.stats())'; }                          # live stats
cnt()  { ev "JSON.stringify(alchemy.counts())"; }                         # material counts
scr()  { ev "(()=>{const p=alchemy.toScreen($1,$2);return Math.round(p.x)+' '+Math.round(p.y)})()" | tr -d '"'; }
btn()  { # click a labelled button via its snapshot ref (scrolls into view); fail loudly
  local ref; ref=$(agent-browser snapshot -i 2>/dev/null | grep -F "button \"$1\" [ref=" | head -1 | sed -E 's/.*ref=(e[0-9]+).*/@\1/')
  if [ -z "$ref" ] || ! agent-browser click "$ref" >/dev/null 2>&1; then echo "!! button not clicked: $1"; return 1; fi; }
shot() { agent-browser screenshot "$EVD/screenshots/$1.png" >/dev/null 2>&1 && echo "screenshot: screenshots/$1.png"; }
# drag x1 y1 x2 y2 ... : press at the first grid cell, move through the rest, release
drag() {
  local sx sy; read -r sx sy <<< "$(scr "$1" "$2")"
  agent-browser mouse move "$sx" "$sy" >/dev/null; agent-browser mouse down left >/dev/null; shift 2
  while [ $# -ge 2 ]; do read -r sx sy <<< "$(scr "$1" "$2")"; agent-browser mouse move "$sx" "$sy" >/dev/null; shift 2; done
  agent-browser mouse up left >/dev/null
}
# hold x y ms : press and hold in place (continuous emission)
hold() { local sx sy; read -r sx sy <<< "$(scr "$1" "$2")"; agent-browser mouse move "$sx" "$sy" >/dev/null; agent-browser mouse down left >/dev/null; sleep "$3"; agent-browser mouse up left >/dev/null; }
click_at() { local sx sy; read -r sx sy <<< "$(scr "$1" "$2")"; agent-browser mouse move "$sx" "$sy" >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; }
# fresh_open WxH [dpr]: open the app with default settings (deletes any autosave first, then reloads)
fresh_open() {
  agent-browser set viewport ${1:-1280} ${2:-800} ${3:-1} >/dev/null; agent-browser open "$APP" >/dev/null; sleep 1.2
  btn "Delete autosave" >/dev/null; agent-browser reload >/dev/null; sleep 1.5
}
