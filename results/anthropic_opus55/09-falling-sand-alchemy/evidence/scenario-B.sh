#!/usr/bin/env bash
# Scenario B: stroke continuity — one pointer jump across the grid must paint every cell on the path.
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
REF() { agent-browser snapshot -i 2>/dev/null | grep -E "slider \"$1\"" | sed -E 's/.*ref=(e[0-9]+).*/@\1/'; }
btn "Blank Canvas"; btn "Pause"
agent-browser focus "$(REF Amount)" >/dev/null; agent-browser press End >/dev/null
agent-browser focus "$(REF Spray)" >/dev/null; agent-browser press Home >/dev/null
agent-browser focus "$(REF Radius)" >/dev/null; agent-browser press Home >/dev/null
btn "Water"; btn "Paint tool"
echo "brush: radius $(ev 'document.getElementById("o-brushR").textContent') amount $(ev 'document.getElementById("o-amount").textContent') spray $(ev 'document.getElementById("o-spray").textContent') paused=$(ev 'alchemy.grid.paused')"
drag 20 40 290 40      # press at x=20, ONE mouse move to x=290, release
echo "horizontal jump: $(ev '(()=>{let n=0,gaps=[];for(let x=20;x<=290;x++){if(alchemy.cell(x,40).type==="Water")n++;else gaps.push(x);}return JSON.stringify({painted:n,expected:271,gaps:gaps.slice(0,10)});})()')"
drag 30 60 280 200     # one diagonal jump
echo "diagonal jump: $(ev '(()=>{let miss=0;for(let k=0;k<=250;k++){const x=30+k,y=Math.round(60+140*k/250);let ok=false;for(let dy=-1;dy<=1;dy++)if(alchemy.cell(x,y+dy).type==="Water")ok=true;if(!ok)miss++;}return JSON.stringify({columnsMissing:miss,of:251});})()')"
shot B1-continuous-strokes-paused
echo "errors: $(agent-browser errors 2>&1 | head -3)"
