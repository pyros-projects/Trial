# Dev-only helpers for agent-browser driven checks (source this file).
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-pps}
center() { # print "x y" viewport center of first element matching selector (after scrolling it into view)
  agent-browser scrollintoview "$1" >/dev/null 2>&1
  printf '(()=>{const r=document.querySelector(%s).getBoundingClientRect(); return `${Math.round(r.x+r.width/2)} ${Math.round(r.y+r.height/2)}`;})()' "$(printf '%s' "$1" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')" | agent-browser eval --stdin | tr -d '"'
}
mclick() { read -r X Y <<<"$(center "$1")"; agent-browser mouse move "$X" "$Y" >/dev/null && agent-browser mouse down left >/dev/null && agent-browser mouse up left >/dev/null; echo "clicked $1 at $X,$Y"; }
snap() { agent-browser eval "JSON.stringify(PPS.snapshot())" ; }
state() { agent-browser eval "JSON.stringify({s: PPS.snapshot().source, i: PPS.snapshot().intervals, u: PPS.snapshot().undo, r: PPS.snapshot().redo})"; }
msg() { agent-browser eval "document.getElementById('msgBar').innerText" | head -c 400; echo; }
# try_edit <selector> <text> : fill + Enter, report whether model/history stayed identical, show message
try_edit() { local B A; B=$(state); agent-browser fill "$1" "$2" >/dev/null; agent-browser press Enter >/dev/null; agent-browser wait 120 >/dev/null; A=$(state);
  if [ "$B" = "$A" ]; then echo "[$1 <- $2] UNCHANGED"; else echo "[$1 <- $2] CHANGED"; fi; msg; }
