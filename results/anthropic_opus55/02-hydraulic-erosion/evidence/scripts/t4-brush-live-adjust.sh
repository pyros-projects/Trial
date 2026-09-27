#!/usr/bin/env bash
# Radius/strength changes while the pointer stays pressed (one continuous stroke). Keys sent as literal characters.
export AGENT_BROWSER_SESSION=erosion
AB=agent-browser
X=520; Y=470
changed() { $AB eval "(()=>{const h=lab.S.h,o=window.__h; let n=0,m=0; for(let i=0;i<h.length;i++){const d=Math.abs(h[i]-o[i]); if(d>1e-6){n++; if(d>m)m=d;}} window.__h=h.slice(); return JSON.stringify({seg:'$1', cellsChanged:n, maxDh:+m.toFixed(3), radius:+lab.brush.radius.toFixed(1), strength:+lab.brush.strength.toFixed(2), sliderRadius:document.querySelector('#b-radius').value})})()"; }
$AB press Home >/dev/null
$AB press b >/dev/null
$AB eval "lab.brush.radius=20; lab.brush.strength=0.3; window.__h=lab.S.h.slice(); 1" >/dev/null
$AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null
$AB wait 700 >/dev/null; changed seg1-r20-s030
for k in 1 2 3 4 5 6; do $AB press "]" >/dev/null; done
$AB mouse move $((X+2)) $Y >/dev/null
$AB wait 700 >/dev/null; changed seg2-after-6x-bracket-right
$AB screenshot evidence/screenshots/17-mid-stroke-bigger-brush.png >/dev/null
for k in 1 2 3 4 5 6 7 8; do $AB press "=" >/dev/null; done
$AB wait 700 >/dev/null; changed seg3-after-8x-equal
for k in 1 2 3 4 5 6 7 8 9 10; do $AB press "[" >/dev/null; done
$AB wait 700 >/dev/null; changed seg4-after-10x-bracket-left
$AB mouse up left >/dev/null
