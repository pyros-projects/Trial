# helpers for agent-browser pointer tests
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-wavelab}
ev() { agent-browser eval "$1" | tr -d '"'; }
# world -> client "x y"
wc() { ev "(()=>{const p=waveLab.toClient($1,$2);return Math.round(p.x)+' '+Math.round(p.y)})()"; }
# drag in world coords: wdrag x1 y1 x2 y2 [steps] [button]
wdrag() {
  local a=($(wc $1 $2)) b=($(wc $3 $4)) n=${5:-12} btn=${6:-left}
  agent-browser mouse move ${a[0]} ${a[1]} >/dev/null
  agent-browser mouse down $btn >/dev/null
  for ((i=1;i<=n;i++)); do
    local x=$(( a[0] + (b[0]-a[0])*i/n )) y=$(( a[1] + (b[1]-a[1])*i/n ))
    agent-browser mouse move $x $y >/dev/null
  done
  agent-browser mouse up $btn >/dev/null
}
wclick() { local a=($(wc $1 $2)); agent-browser mouse move ${a[0]} ${a[1]} >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; }
