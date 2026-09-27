#!/usr/bin/env bash
# Water painted on a slope must run downhill and collect in lower ground.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
$AB find role button click --name "Mountain Drainage rain on a ridged massif" >/dev/null; $AB wait 1500 >/dev/null
$AB find role button click --name "Pause" >/dev/null
$AB focus "#p-rain" >/dev/null; $AB press Home >/dev/null
$AB focus "#p-evaporation" >/dev/null; $AB press Home >/dev/null
$AB eval "JSON.stringify({rain:lab.P.rain, evaporation:lab.P.evaporation, rainOut:document.querySelector('#p-rain').parentElement.querySelector('output').textContent})"
# find a steep, visible screen point
PT=$($AB eval "(()=>{let best=null; for(let y=300;y<=650;y+=25) for(let x=250;x<=750;x+=25){const p=lab.api.pick(x,y); if(!p) continue; const S=lab.S,N=S.N,i=Math.round(p.gx), j=Math.round(p.gy); if(i<30||j<30||i>N-30||j>N-30) continue; const k=j*N+i; const g=Math.hypot(S.h[k+1]-S.h[k-1], S.h[k+N]-S.h[k-N])/(2*S.dx); if(!best||g>best.g) best={x,y,g,i,j}; } return best.x+' '+best.y+' '+best.g.toFixed(2)+' '+best.i+' '+best.j})()" | tr -d '"')
set -- $PT; X=$1; Y=$2
echo "steepest visible point: screen $X,$Y slope(rise/run)=$3 cell $4,$5"
$AB eval "window.__c=[$4,$5]; 1" >/dev/null
M="(()=>{const S=lab.S,N=S.N,[ci,cj]=window.__c; let V=0,Vh=0,maxd=0,mi=0; for(let j=cj-60;j<=cj+60;j++) for(let i=ci-60;i<=ci+60;i++){ if(i<0||j<0||i>=N||j>=N) continue; const k=j*N+i, d=S.d[k]; V+=d; Vh+=d*S.h[k]; if(d>maxd){maxd=d;mi=k;} } return JSON.stringify({label:'LBL', t:+S.time.toFixed(1), regionWater_m3:+(V*S.dx*S.dx).toFixed(0), waterWeightedBedElev:+(Vh/V).toFixed(2), deepestCell:[mi%N,(mi/N)|0], deepest_h:+S.h[mi].toFixed(2), deepest_d:+maxd.toFixed(3), paintCell_d:+S.d[cj*N+ci].toFixed(3), paintCell_h:+S.h[cj*N+ci].toFixed(2)})})()"
$AB find role button click --name "Add water" >/dev/null; $AB eval "lab.brush.radius=20; lab.brush.strength=1; lab.brush.tool" 
$AB eval "${M/LBL/before-paint}"
$AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null; $AB wait 1500 >/dev/null; $AB mouse up left >/dev/null
$AB eval "${M/LBL/after-paint}"
$AB screenshot evidence/screenshots/18-water-painted-on-slope.png >/dev/null
$AB find role button click --name "Resume" >/dev/null || true
$AB wait --fn "lab.S.time > 12" >/dev/null; $AB eval "${M/LBL/running}"
$AB wait --fn "lab.S.time > 25" >/dev/null; $AB eval "${M/LBL/running}"
$AB wait --fn "lab.S.time > 45" >/dev/null; $AB eval "${M/LBL/running}"
$AB find role button click --name "Pause" >/dev/null || true
$AB screenshot evidence/screenshots/19-water-after-flowing.png >/dev/null
