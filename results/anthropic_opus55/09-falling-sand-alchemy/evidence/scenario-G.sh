#!/usr/bin/env bash
# Scenario G: world-physics sliders and remaining brush settings, driven through the real controls.
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
btn "Blank Canvas"; sleep 0.3
REF() { agent-browser snapshot -i 2>/dev/null | grep -E "slider \"$1\"" | sed -E 's/.*ref=(e[0-9]+).*/@\1/'; }
agent-browser click "summary:has-text('World physics')" >/dev/null 2>&1 || ev 'document.getElementById("secWorld").open=true' >/dev/null
AIR='(()=>{let s=0,n=0;for(let y=20;y<120;y+=4)for(let x=20;x<290;x+=4){const c=alchemy.cell(x,y);if(c.type==="Air"){s+=c.temp;n++;}}return (s/n).toFixed(1);})()'
echo "== G1 ambient temperature slider"; A=$(REF "Ambient temp"); agent-browser focus "$A" >/dev/null; agent-browser press Home >/dev/null
echo "ambient $(ev 'document.getElementById("o-ambient").textContent'); open-air mean temp now $(ev "$AIR")"; sleep 4; echo "after 4s: $(ev "$AIR") °C"
agent-browser press End >/dev/null; sleep 4; echo "ambient $(ev 'document.getElementById("o-ambient").textContent'): open air after 4s $(ev "$AIR") °C"
agent-browser press Home >/dev/null; for k in $(seq 1 80); do agent-browser press ArrowRight >/dev/null; done; echo "restored ambient $(ev 'document.getElementById("o-ambient").textContent')"
echo "== G2 heat-transfer rate 0 vs 1 (hot metal slab next to cold metal)"
btn "Metal"; btn "Paint tool"; for k in 1 2 3 4 5 6 7 8 9 10; do agent-browser press "[" >/dev/null; done; for k in 1 2 3; do agent-browser press "]" >/dev/null; done
agent-browser click "#useTemp" >/dev/null; T=$(REF Temperature); agent-browser focus "$T" >/dev/null; agent-browser press End >/dev/null
echo "custom brush temperature: $(ev 'document.getElementById("o-brushTemp").textContent') useTemp=$(ev 'document.getElementById("useTemp").checked')"
drag 60 150 75 150; agent-browser click "#useTemp" >/dev/null; drag 80 150 95 150
echo "painted hot bar: $(ev 'JSON.stringify(alchemy.cell(67,150))')"
HR=$(REF "Heat transfer"); agent-browser focus "$HR" >/dev/null; agent-browser press Home >/dev/null; echo "heat transfer $(ev 'document.getElementById("o-heatRate").textContent')"
C0=$(ev 'alchemy.cell(88,150).temp'); sleep 3; C1=$(ev 'alchemy.cell(88,150).temp'); echo "cold bar with transfer 0: $C0 -> $C1"
for k in $(seq 1 20); do agent-browser press ArrowRight >/dev/null; done; echo "heat transfer $(ev 'document.getElementById("o-heatRate").textContent')"; sleep 3; echo "cold bar with transfer 1: -> $(ev 'alchemy.cell(88,150).temp')"
echo "== G3 reaction rate 0 stops dissolution"
RR=$(REF "Reaction rate"); agent-browser focus "$RR" >/dev/null; agent-browser press Home >/dev/null; echo "reaction rate $(ev 'document.getElementById("o-reactRate").textContent')"
for k in 1 2 3; do agent-browser press "]" >/dev/null; done; btn "Water"; drag 150 200 250 200; hold 200 200 1; sleep 1.5; btn "Salt"; drag 160 170 240 170; sleep 3
echo "rate 0: $(ev 'JSON.stringify([alchemy.counts().Salt, alchemy.counts()["Salt water"]||0])') [salt, brine]"
agent-browser focus "$RR" >/dev/null; for k in $(seq 1 20); do agent-browser press ArrowRight >/dev/null; done; sleep 3
echo "rate $(ev 'document.getElementById("o-reactRate").textContent'): $(ev 'JSON.stringify([alchemy.counts().Salt, alchemy.counts()["Salt water"]||0])') [salt, brine]"
echo "== G4 brush shape + velocity"
btn "Blank Canvas"; btn "Pause" >/dev/null; agent-browser focus "$(REF Amount)" >/dev/null; agent-browser press End >/dev/null; agent-browser focus "$(REF Spray)" >/dev/null; agent-browser press Home >/dev/null
echo "brush: radius $(ev 'document.getElementById("o-brushR").textContent') amount $(ev 'document.getElementById("o-amount").textContent') spray $(ev 'document.getElementById("o-spray").textContent')"
agent-browser select "#brushShape" square >/dev/null; btn "Sand"; click_at 100 100; echo "square footprint cells: $(ev 'alchemy.counts().Sand') (radius 7 square = 13x13 = 169)"
agent-browser select "#brushShape" diamond >/dev/null; click_at 150 100; echo "+ diamond: $(ev 'alchemy.counts().Sand') (radius 7 diamond adds 2*6*6+2*6+1 = 85)"
agent-browser select "#brushShape" circle >/dev/null
V=$(REF Velocity); agent-browser focus "$V" >/dev/null; agent-browser press End >/dev/null; agent-browser select "#velDir" right >/dev/null
btn "Water"; click_at 200 60; echo "velocity brush: $(ev 'document.getElementById("o-vel").textContent') -> painted water vx sample $(ev 'alchemy.cell(200,60).vx')"
agent-browser focus "$V" >/dev/null; agent-browser press Home >/dev/null; agent-browser select "#velDir" stroke >/dev/null; btn "Resume" >/dev/null
shot G4-brush-shapes
echo "errors: $(agent-browser errors 2>&1 | head -3)"
