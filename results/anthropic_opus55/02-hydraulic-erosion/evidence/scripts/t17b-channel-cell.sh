#!/usr/bin/env bash
# Pin the probe on the most-incised *wet* visible cell (a channel) and track its bed while water flows through it.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
PT=$($AB eval "(()=>{let best=null; for(let y=260;y<=700;y+=8) for(let x=120;x<=900;x+=8){const p=lab.api.pick(x,y); if(!p) continue; const S=lab.S,N=S.N,k=Math.round(p.gy)*N+Math.round(p.gx); if(S.d[k]<0.05) continue; const dh=S.h[k]-S.h0[k]; if(!best||dh<best.dh) best={x,y,dh}; } return best.x+' '+best.y})()" | tr -d '"')
set -- $PT
$AB click "#toolbar button[data-tool=inspect]" >/dev/null
$AB mouse move $1 $2 >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; $AB mouse move 20 790 >/dev/null
CELL="(()=>{const S=lab.S,N=S.N,k=Math.round(lab.probe.gy)*N+Math.round(lab.probe.gx); return JSON.stringify({t:+S.time.toFixed(1), probeCell:[Math.round(lab.probe.gx),Math.round(lab.probe.gy)], bed_h:+S.h[k].toFixed(3), dh_since_t0:+(S.h[k]-S.h0[k]).toFixed(3), water_d:+S.d[k].toFixed(3), speed:+Math.hypot(S.u[k],S.v[k]).toFixed(2), suspended_mm:+(S.s[k]*1000).toFixed(1), probePanel:document.querySelector('#probeTitle').textContent})})()"
$AB eval "$CELL"
$AB click "#btnPause" >/dev/null
T0=$($AB eval "lab.S.time" | tr -d '"')
$AB wait --fn "lab.S.time >= $T0 + 30" --timeout 200000 >/dev/null; $AB eval "$CELL"
$AB wait --fn "lab.S.time >= $T0 + 60" --timeout 200000 >/dev/null; $AB eval "$CELL"
$AB click "#btnPause" >/dev/null
$AB screenshot evidence/screenshots/44-channel-probe.png >/dev/null
