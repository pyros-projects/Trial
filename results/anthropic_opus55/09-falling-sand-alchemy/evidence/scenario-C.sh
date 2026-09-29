#!/usr/bin/env bash
# Scenario C: paint materials with real mouse strokes and verify cross-system interactions.
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
REF() { agent-browser snapshot -i 2>/dev/null | grep -E "slider \"$1\"" | sed -E 's/.*ref=(e[0-9]+).*/@\1/'; }
R=$(REF Radius); A=$(REF Amount); SP=$(REF Spray)
btn "Blank Canvas"; sleep 0.3
agent-browser focus "$A" >/dev/null; agent-browser press End >/dev/null        # amount 100%
agent-browser focus "$SP" >/dev/null; agent-browser press Home >/dev/null      # spray 0
agent-browser focus "$R" >/dev/null; agent-browser press Home >/dev/null; agent-browser press ArrowRight >/dev/null  # radius 2
echo "== C0 walls (Wall tool)"
btn "Wall tool"; drag 15 232 305 232; drag 15 175 15 232; drag 95 175 95 232; drag 160 195 160 232; drag 230 150 230 232
for k in 1 2 3; do agent-browser press "]" >/dev/null; done  # radius 5 via the ] shortcut
echo "counts: $(cnt) radius=$(ev 'document.getElementById("o-brushR").textContent')"
echo "== C1 lava + water"
btn "Water"; btn "Paint tool"; drag 25 190 85 190 25 200 85 200 25 210 85 210; hold 55 195 2; sleep 2
echo "before lava: $(cnt)"
btn "Lava"; drag 30 150 80 150 30 155 80 155; hold 55 150 1
sleep 1; echo "t+1s: $(cnt)"; shot C1a-lava-hits-water
echo "== C2 fire + wood"
btn "Wood"; drag 105 205 150 205 105 215 150 215 105 225 150 225
W0=$(ev 'alchemy.counts().Wood'); echo "wood painted: $W0"
btn "Fire"; drag 110 200 145 200
sleep 1; shot C2a-wood-ignites
echo "== C3 electricity through metal to explosive"
btn "Explosive"; drag 296 118 302 118 296 124 302 124
btn "Metal"; for k in 1 2 3 4 5; do agent-browser press "[" >/dev/null; done   # radius 1 wire via [ shortcut
drag 170 121 294 121
echo "wire+tnt: $(cnt)"; echo "stats before spark: $(st)"
btn "Electricity"; click_at 172 121   # paint a spark directly onto the wire end
sleep 0.4; echo "charge wave: $(ev '(()=>{let c=0,maxX=0;for(let x=160;x<300;x++){const q=alchemy.cell(x,121);if(q.charge>0){c++;maxX=x;}}return JSON.stringify({chargedWireCells:c, frontX:maxX, heads:alchemy.stats().nHeads});})()')"
agent-browser select "#viewMode" charge >/dev/null; sleep 0.2; shot C3a-charge-view; agent-browser select "#viewMode" normal >/dev/null
sleep 2; echo "after spark: $(st)"; shot C3b-tnt-detonated
echo "== C4 acid on metal vs wood"
for k in 1 2 3 4; do agent-browser press "]" >/dev/null; done   # radius 5 via the ] shortcut
btn "Metal"; drag 180 215 200 215 180 225 200 225
btn "Wood"; drag 250 215 270 215 250 225 270 225
M0=$(ev 'alchemy.counts().Metal'); WD0=$(ev '(()=>{let n=0;for(let y=200;y<232;y++)for(let x=235;x<300;x++)if(alchemy.cell(x,y).type==="Wood")n++;return n;})()')
btn "Acid"; drag 175 190 205 190; drag 245 190 275 190
sleep 6
M1=$(ev 'alchemy.counts().Metal'); WD1=$(ev '(()=>{let n=0;for(let y=200;y<232;y++)for(let x=235;x<300;x++)if(alchemy.cell(x,y).type==="Wood")n++;return n;})()')
echo "metal cells (incl. wire): $M0 -> $M1 ; wood block cells: $WD0 -> $WD1"
echo "metal integrity in block: $(ev 'JSON.stringify((()=>{let n=0,hs=0,dam=0;for(let y=205;y<232;y++)for(let x=175;x<205;x++){const c=alchemy.cell(x,y);if(c.type==="Metal"){n++;hs+=c.hp;if(c.hp<220)dam++;}}return {n,meanHp:n?Math.round(hs/n):0,damaged:dam};})())')"
agent-browser select "#viewMode" corrosion >/dev/null; sleep 0.2; shot C4a-corrosion-view; agent-browser select "#viewMode" normal >/dev/null
echo "== persistence check after 8 more seconds"
sleep 8; echo "final counts: $(cnt)"; echo "final stats: $(st)"
shot C5-after-all
echo "basin A stone: $(ev '(()=>{let n=0;for(let y=140;y<232;y++)for(let x=16;x<95;x++)if(alchemy.cell(x,y).type==="Stone")n++;return n;})()')"
echo "errors: $(agent-browser errors 2>&1 | head -3)"
