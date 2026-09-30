# helpers for driving Logic Lab through agent-browser with real pointer input
export AGENT_BROWSER_SESSION=${AGENT_BROWSER_SESSION:-logiclab}
AB=agent-browser
# port position in viewport coords: pp <label-or-id> <port>
pp() { $AB eval "(()=>{const L=window.LogicLab,A=L.App,r=document.getElementById('cv').getBoundingClientRect();const cd=A.doc.components.find(c=>c.label==='$1'||c.id==='$1');const p=L.portPos({c:cd.id,p:'$2'});return Math.round(r.left+p.x*A.view.z+A.view.x)+' '+Math.round(r.top+p.y*A.view.z+A.view.y)})()" | tr -d '"'; }
# component point (fractional position inside bbox): cp <label-or-id> <fx> <fy>
cp() { $AB eval "(()=>{const L=window.LogicLab,A=L.App,r=document.getElementById('cv').getBoundingClientRect();const cd=A.doc.components.find(c=>c.label==='$1'||c.id==='$1');const Lo=L.layoutOf(cd);return Math.round(r.left+(cd.x+Lo.w*$2)*A.view.z+A.view.x)+' '+Math.round(r.top+(cd.y+Lo.h*$3)*A.view.z+A.view.y)})()" | tr -d '"'; }
# value seen at a port: pv <label-or-id> <port>
pv() { $AB eval "(()=>{const L=window.LogicLab,A=L.App;const cd=A.doc.components.find(c=>c.label==='$1'||c.id==='$1');const v=A.sim.portValue({c:cd.id,p:'$2'});return L.fmtVal(v.v,v.x,v.w,'hex')})()" | tr -d '"'; }
drag() { $AB mouse move $1 $2 >/dev/null; $AB mouse down left >/dev/null; for i in 1 2 3 4 5 6; do $AB mouse move $(( $1 + ($3-$1)*i/6 )) $(( $2 + ($4-$2)*i/6 )) >/dev/null; done; $AB mouse up left >/dev/null; }
click() { $AB mouse move $1 $2 >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; }
state() { $AB eval "$1" | tr -d '"'; }
CDP=$(dirname ${BASH_SOURCE[0]})/cdp.js
tap() { node $CDP "$($AB get cdp-url)" "[[\"Input.dispatchTouchEvent\",{\"type\":\"touchStart\",\"touchPoints\":[{\"x\":$1,\"y\":$2,\"id\":1}]},40],[\"Input.dispatchTouchEvent\",{\"type\":\"touchEnd\",\"touchPoints\":[]},40]]" >/dev/null; }
tdrag() { local seq="[\"Input.dispatchTouchEvent\",{\"type\":\"touchStart\",\"touchPoints\":[{\"x\":$1,\"y\":$2,\"id\":1}]},40]"; for i in 1 2 3 4 5 6 7 8; do seq="$seq,[\"Input.dispatchTouchEvent\",{\"type\":\"touchMove\",\"touchPoints\":[{\"x\":$(( $1 + ($3-$1)*i/8 )),\"y\":$(( $2 + ($4-$2)*i/8 )),\"id\":1}]},25]"; done; node $CDP "$($AB get cdp-url)" "[$seq,[\"Input.dispatchTouchEvent\",{\"type\":\"touchEnd\",\"touchPoints\":[]},40]]" >/dev/null; }
elc() { state "(()=>{const e=$1;if(!e)return 'none';const r=e.getBoundingClientRect();return (r.left+r.width/2|0)+' '+(r.top+r.height/2|0)})()"; }
