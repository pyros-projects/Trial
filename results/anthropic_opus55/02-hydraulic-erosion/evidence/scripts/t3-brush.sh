#!/usr/bin/env bash
# Brush tool checks with real pointer input (agent-browser, session "erosion"). Sim is paused so only the brush changes state.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
X=480; Y=430
probe() { $AB eval "(()=>{const p=lab.api.pick($X,$Y); if(!p) return 'no-hit'; const S=lab.S,N=S.N,i=Math.round(p.gy)*N+Math.round(p.gx); let d=0,s=0,soil=0; for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++){const k=i+y*N+x; d+=S.d[k]; s+=S.s[k]; soil+=S.soil[k];} return JSON.stringify({label:'$1', cell:[Math.round(p.gx),Math.round(p.gy)], h:+S.h[i].toFixed(3), d_sum7x7:+d.toFixed(4), s_sum7x7:+s.toFixed(4), soil_sum7x7:+soil.toFixed(3), brushM:+S.bal.brushM.toFixed(1), brushW:+S.bal.brushW.toFixed(1), radius:lab.brush.radius, tool:lab.brush.tool, t:+S.time.toFixed(2)})})()"; }
hold() { $AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null; $AB wait $1 >/dev/null; $AB mouse up left >/dev/null; $AB wait 300 >/dev/null; }
$AB press Home >/dev/null
$AB eval "lab.paused || document.querySelector('#btnPause').click(); lab.paused" >/dev/null
$AB mouse move $X $Y >/dev/null; $AB wait 400 >/dev/null
$AB press b >/dev/null; probe before-raise; hold 1200; probe after-raise
$AB screenshot evidence/screenshots/14-after-raise.png >/dev/null
# right-drag with a brush tool active must orbit, not edit
$AB eval "window.__h=lab.S.h.slice(); 1" >/dev/null
$AB mouse move $X $Y >/dev/null; $AB mouse down right >/dev/null; $AB mouse move 520 430 >/dev/null; $AB mouse move 560 430 >/dev/null; $AB mouse up right >/dev/null
$AB eval "(()=>{let ch=0; for(let i=0;i<lab.S.h.length;i++) if(lab.S.h[i]!==window.__h[i]) ch++; return 'right-drag with raise tool: terrain cells changed = '+ch+', yaw='+lab.api.cam.yaw.toFixed(2)})()"
$AB press Home >/dev/null; $AB wait 300 >/dev/null
$AB press l >/dev/null; probe before-lower; hold 1500; probe after-lower
$AB press w >/dev/null; probe before-water; hold 1200; probe after-water
$AB screenshot evidence/screenshots/15-after-add-water.png >/dev/null
$AB press e >/dev/null; probe before-sediment; hold 800; probe after-sediment
$AB press d >/dev/null; probe before-dry; hold 1200; probe after-dry
# smooth: roughness (laplacian energy) in a 15x15 patch
rough() { $AB eval "(()=>{const p=lab.api.pick($X,$Y),S=lab.S,N=S.N,c=Math.round(p.gy)*N+Math.round(p.gx); let e=0; for(let y=-7;y<=7;y++)for(let x=-7;x<=7;x++){const i=c+y*N+x; const l=S.h[i-1]+S.h[i+1]+S.h[i-N]+S.h[i+N]-4*S.h[i]; e+=l*l;} return 'roughness $1: '+e.toFixed(3)})()"; }
$AB press s >/dev/null; rough before-smooth; hold 2000; rough after-smooth
# flatten: stroke from center outward, heights should approach the start height
$AB press f >/dev/null
$AB eval "(()=>{const a=lab.api.pick($X,$Y), b=lab.api.pick($X+120,$Y+40); window.__fa=a; window.__fb=b; const S=lab.S,N=S.N; const h=(p)=>S.h[Math.round(p.gy)*N+Math.round(p.gx)]; return 'flatten start h='+h(a).toFixed(2)+' target-area h='+h(b).toFixed(2)})()"
$AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null; for i in 1 2 3 4 5 6; do $AB mouse move $((X+20*i)) $((Y+7*i)) >/dev/null; $AB wait 250 >/dev/null; done; $AB wait 1500 >/dev/null; $AB mouse up left >/dev/null
$AB eval "(()=>{const S=lab.S,N=S.N; const h=(p)=>S.h[Math.round(p.gy)*N+Math.round(p.gx)]; return 'after flatten: area h='+h(window.__fb).toFixed(2)+' (moved toward start height)'})()"
# inspect: click pins probe
$AB press i >/dev/null; $AB mouse move 400 500 >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; $AB wait 300 >/dev/null
$AB mouse move 30 780 >/dev/null; $AB wait 400 >/dev/null
$AB eval "JSON.stringify({probe:lab.probe && [lab.probe.gx.toFixed(1),lab.probe.gy.toFixed(1)], title:document.querySelector('#probeTitle').textContent, text:document.querySelector('#probeGrid').innerText.replace(/\n/g,' | ')})"
$AB screenshot evidence/screenshots/16-probe-pinned.png >/dev/null
