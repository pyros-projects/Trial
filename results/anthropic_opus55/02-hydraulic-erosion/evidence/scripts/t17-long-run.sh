#!/usr/bin/env bash
# Default preset from t=0: terrain geometry (not only shading) must evolve; track a channel cell through the pinned probe.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
$AB set viewport 1280 800 1 >/dev/null
$AB reload >/dev/null; $AB wait 800 >/dev/null
$AB click "#btnReset" >/dev/null
$AB eval "lab.renderScale=1; lab.api.cam.yaw=-0.75; lab.api.cam.pitch=0.62; lab.api.cam.dist=760; 1" >/dev/null
$AB wait 700 >/dev/null
$AB screenshot evidence/screenshots/40-longrun-t0-shaded.png >/dev/null
$AB eval "JSON.stringify({t:+lab.S.time.toFixed(1), maxDelta:+lab.stats.maxDelta.toFixed(3), eroded:+lab.S.bal.eroded.toFixed(0)})"
$AB wait --fn "lab.S.time >= 60" --timeout 200000 >/dev/null
# choose the visible screen point whose cell has been eroded most, pin it with the Inspect tool (real click)
PT=$($AB eval "(()=>{let best=null; for(let y=260;y<=700;y+=12) for(let x=120;x<=900;x+=12){const p=lab.api.pick(x,y); if(!p) continue; const S=lab.S,N=S.N,k=Math.round(p.gy)*N+Math.round(p.gx); const dh=S.h[k]-S.h0[k]; if(!best||dh<best.dh) best={x,y,dh}; } return best.x+' '+best.y})()" | tr -d '"')
set -- $PT
$AB click "#toolbar button[data-tool=inspect]" >/dev/null
$AB mouse move $1 $2 >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null
$AB mouse move 20 790 >/dev/null
CELL="(()=>{const S=lab.S,N=S.N,k=Math.round(lab.probe.gy)*N+Math.round(lab.probe.gx); return JSON.stringify({t:+S.time.toFixed(1), probeCell:[Math.round(lab.probe.gx),Math.round(lab.probe.gy)], h:+S.h[k].toFixed(3), dh_since_t0:+(S.h[k]-S.h0[k]).toFixed(3), water_d:+S.d[k].toFixed(3), speed:+Math.hypot(S.u[k],S.v[k]).toFixed(2), sediment_mm:+(S.s[k]*1000).toFixed(1), maxDelta:+lab.stats.maxDelta.toFixed(2), eroded_m3:+S.bal.eroded.toFixed(0), deposited_m3:+S.bal.deposited.toFixed(0), massRel:lab.stats.matRel.toExponential(1)})})()"
$AB eval "$CELL"
$AB wait --fn "lab.S.time >= 120" --timeout 200000 >/dev/null; $AB eval "$CELL"
$AB wait --fn "lab.S.time >= 180" --timeout 200000 >/dev/null; $AB eval "$CELL"
$AB click "#btnPause" >/dev/null
$AB screenshot evidence/screenshots/41-longrun-t180-shaded.png >/dev/null
$AB press 5 >/dev/null; $AB wait 600 >/dev/null; $AB screenshot evidence/screenshots/42-longrun-t180-delta.png >/dev/null
$AB press 3 >/dev/null; $AB wait 600 >/dev/null; $AB screenshot evidence/screenshots/43-longrun-t180-water.png >/dev/null
$AB press 1 >/dev/null
