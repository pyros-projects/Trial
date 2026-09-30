# helpers for driving the game with real key events (time-based polling)
export AGENT_BROWSER_SESSION=echoloop
st() { agent-browser eval "JSON.stringify(EchoLoop.state()$1)" 2>/dev/null | sed 's/^"//; s/"$//; s/\\"/"/g'; }
# waitFor <js-cond> [maxSeconds]  -> 0 if condition met, 1 on timeout
waitFor() { local cond="$1" max="${2:-8}"; local end=$(( $(date +%s%N) + ${max%.*}000000000 )); while [ $(date +%s%N) -lt $end ]; do [ "$(agent-browser eval "($cond)?1:0" 2>/dev/null)" = "1" ] && return 0; sleep 0.02; done; echo "  (waitFor timeout: $cond)"; return 1; }
holdUntil() { agent-browser keydown "$1" >/dev/null; waitFor "$2" "${3:-8}"; local r=$?; agent-browser keyup "$1" >/dev/null; return $r; }
fresh() { agent-browser open "about:blank" >/dev/null; agent-browser open "file://$PWD/index.html#level$1" >/dev/null; sleep 1; }
# page coords of the centre of editor cell (x,y)
cellxy() { agent-browser eval "(()=>{const r=document.getElementById('cv').getBoundingClientRect();const p=EchoLoop.worldToScreen($1*32+16,$2*32+16);return Math.round(r.left+p[0])+' '+Math.round(r.top+p[1]);})()" | tr -d '"'; }
clickCell() { local xy; xy=$(cellxy $1 $2); agent-browser mouse move $xy >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; }
dragCells() { local a b; a=$(cellxy $1 $2); b=$(cellxy $3 $4); agent-browser mouse move $a >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse move $b >/dev/null; agent-browser mouse up left >/dev/null; }
# page x,y on the timeline for tick t (lane y = player lane)
tlxy() { agent-browser eval "(()=>{const c=document.getElementById('tlcv'),r=c.getBoundingClientRect(),s=EchoLoop.state();return Math.round(r.left+58+($1/s.loopTicks)*(r.width-58-8))+' '+Math.round(r.top+24)})()" | tr -d '"'; }
pcx() { agent-browser eval "Math.round(EchoLoop.state().player.x+11)" | tr -d '"'; }
goto() { local t=$1; for i in $(seq 1 12); do local c; c=$(pcx); if [ $c -lt $((t-6)) ]; then holdUntil ArrowRight "EchoLoop.state().player.x+11 > $t-8" 3 >/dev/null; elif [ $c -gt $((t+6)) ]; then holdUntil ArrowLeft "EchoLoop.state().player.x+11 < $t+8" 3 >/dev/null; else return 0; fi; waitFor "Math.abs(EchoLoop.state().player.vx) < 0.1" 2 >/dev/null; done; }
