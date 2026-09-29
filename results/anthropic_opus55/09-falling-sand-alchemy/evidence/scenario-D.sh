#!/usr/bin/env bash
# Scenario D: salt/water, plant growth, heat & cool tools, pick, wind, explode, fill, gas & oil, diagnostics.
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
REF() { agent-browser snapshot -i 2>/dev/null | grep -E "slider \"$1\"" | sed -E 's/.*ref=(e[0-9]+).*/@\1/'; }
btn "Blank Canvas"; sleep 0.3
agent-browser focus "$(REF Amount)" >/dev/null; agent-browser press End >/dev/null
agent-browser focus "$(REF Spray)" >/dev/null; agent-browser press Home >/dev/null
btn "Wall tool"; for k in 1 2 3 4 5; do agent-browser press "[" >/dev/null; done; agent-browser press "]" >/dev/null   # radius 2
drag 10 235 300 235; drag 10 190 10 235; drag 80 190 80 235; drag 150 190 150 235; drag 220 150 220 235; drag 300 150 300 235
for k in 1 2 3; do agent-browser press "]" >/dev/null; done   # radius 5
echo "== D1 salt dissolves in water (bay 10-80)"
btn "Paint tool"; btn "Water"; drag 20 210 70 210 20 220 70 220; hold 45 215 1.5; sleep 1.5
btn "Salt"; drag 25 170 65 170; sleep 0.5
echo "t0: $(cnt)"; sleep 6; echo "t+6s: $(cnt)"; shot D1-salt-dissolves
echo "== D2 plants grow where water is available (bay 80-150)"
btn "Sand"; drag 90 228 140 228; sleep 1.5
btn "Water"; drag 95 215 135 215; sleep 1
btn "Plant"; for k in 1 2 3 4; do agent-browser press "[" >/dev/null; done   # radius 1 seeds
click_at 100 200; click_at 115 200; click_at 130 200
P0=$(ev 'alchemy.counts().Plant'); W0=$(ev '(()=>{let n=0;for(let y=150;y<235;y++)for(let x=81;x<150;x++)if(alchemy.cell(x,y).type==="Water")n++;return n;})()')
sleep 12; P1=$(ev 'alchemy.counts().Plant'); W1=$(ev '(()=>{let n=0;for(let y=150;y<235;y++)for(let x=81;x<150;x++)if(alchemy.cell(x,y).type==="Water")n++;return n;})()')
echo "plant cells $P0 -> $P1 ; water in plant bay $W0 -> $W1"; shot D2-plant-growth
echo "== D3 heat & cool tools (bay 150-220: ice block + metal bar)"
for k in 1 2 3 4; do agent-browser press "]" >/dev/null; done   # radius 5
btn "Ice"; drag 160 225 175 225; btn "Metal"; drag 190 225 210 225
echo "before: ice=$(ev 'alchemy.counts().Ice') water=$(ev 'alchemy.counts().Water') metal=$(ev 'alchemy.counts().Metal')"
btn "Heat tool"; hold 167 225 4
echo "after heating ice 4s: ice=$(ev 'alchemy.counts().Ice') probe=$(ev 'JSON.stringify(alchemy.cell(167,225))')"
hold 200 225 7
echo "after heating metal 7s: metal=$(ev 'alchemy.counts().Metal') molten=$(ev 'alchemy.counts()["Molten metal"]||0') probe=$(ev 'JSON.stringify(alchemy.cell(200,225))')"
agent-browser select "#viewMode" temp >/dev/null; shot D3a-heat-tool-temperature-view; agent-browser select "#viewMode" normal >/dev/null; shot D3b-heat-tool-normal-view
btn "Cool tool"; hold 45 215 5
echo "after cooling the brine bay 5s: ice=$(ev 'alchemy.counts().Ice') probe=$(ev 'JSON.stringify(alchemy.cell(45,225))')"
echo "== D4 eyedropper (Pick)"
btn "Pick tool"; click_at 200 228; echo "picked -> $(ev 'document.querySelector("#matGrid .mat[aria-pressed=true]").getAttribute("aria-label")') tool=$(ev 'document.querySelector("#toolGrid .btn[aria-pressed=true]").dataset.tool')"
echo "== D5 gas rises, oil floats, gas ignites (bay 220-300)"
btn "Water"; drag 230 220 290 220; sleep 1; btn "Oil"; drag 235 190 285 190; sleep 3
echo "oil above water? $(ev '(()=>{let oy=0,on=0,wy=0,wn=0;for(let y=150;y<235;y++)for(let x=221;x<300;x++){const t=alchemy.cell(x,y).type;if(t==="Oil"){oy+=y;on++;}if(t==="Water"){wy+=y;wn++;}}return JSON.stringify({oilMeanY:(oy/on).toFixed(1),waterMeanY:(wy/wn).toFixed(1)});})()')"
btn "Gas"; hold 260 120 1; sleep 0.3; G0=$(ev '(()=>{let s=0,n=0;for(let y=0;y<252;y++)for(let x=200;x<313;x++)if(alchemy.cell(x,y).type==="Gas"){s+=y;n++;}return (s/n).toFixed(1)+" n="+n;})()')
sleep 2; G1=$(ev '(()=>{let s=0,n=0;for(let y=0;y<252;y++)for(let x=200;x<313;x++)if(alchemy.cell(x,y).type==="Gas"){s+=y;n++;}return (s/n).toFixed(1)+" n="+n;})()')
echo "gas mean y $G0 -> $G1 (smaller = higher)"
btn "Fire"; click_at 260 100; sleep 2; echo "after igniting gas cloud: $(cnt)"; shot D5-gas-oil
echo "== D6 wind tool pushes loose material"
btn "Sand"; drag 170 60 200 60 170 66 200 66; sleep 0.2
btn "Wind tool"; drag 160 62 215 62 270 62
sleep 0.3; echo "sand velocity sample: $(ev '(()=>{let n=0,s=0;for(let y=0;y<252;y++)for(let x=0;x<313;x++){const c=alchemy.cell(x,y);if(c.type==="Sand"&&y<120){n++;s+=c.vx;}}return JSON.stringify({airborneSand:n, meanVx:n?(s/n).toFixed(2):0});})()')"
echo "== D7 explode tool"
E0=$(ev 'alchemy.stats().explosionsTotal'); btn "Explode tool"; click_at 115 215; sleep 0.5
echo "explosions $E0 -> $(ev 'alchemy.stats().explosionsTotal')"; shot D7-explosion
echo "== D8 fill tool (enclosed wall box)"
btn "Wall tool"; for k in 1 2 3 4; do agent-browser press "[" >/dev/null; done
drag 30 20 70 20 70 50 30 50 30 20
btn "Water"; btn "Fill tool"; click_at 50 35
echo "water inside box: $(ev '(()=>{let n=0;for(let y=21;y<50;y++)for(let x=31;x<70;x++)if(alchemy.cell(x,y).type==="Water")n++;return n;})()') (interior=$(( (70-31)*(50-21) )))"
shot D8-fill
echo "== D9 every diagnostic view"
for v in normal temp velocity density charge fuel corrosion order; do agent-browser select "#viewMode" $v >/dev/null; sleep 0.3; shot D9-view-$v >/dev/null; echo "view $v: legend='$(ev 'document.getElementById("legend").innerText.split("\n")[0]')'"; done
agent-browser select "#viewMode" normal >/dev/null
echo "errors: $(agent-browser errors 2>&1 | head -3)"
