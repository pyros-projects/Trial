#!/usr/bin/env bash
# Scenario P: every preset for ~8 s at 1280x800 — screenshot + live stats; electrical-lab lamp check.
source "$(dirname "$0")/lib.sh"
fresh_open 1280 800 1
agent-browser select "#viewMode" normal >/dev/null
for p in "Volcano & Ocean" "Burning Building" "Electrical Lab" "Acid Factory" "Steam Engine" "Frozen Lake" "Plant Ecosystem" "Fireworks Chain" "Dense Stress Test"; do
  slug=$(echo "$p" | tr -d '&' | tr 'A-Z ' 'a-z-' | tr -s '-')
  btn "$p"; sleep 8; shot "P-$slug" >/dev/null
  echo "$p | $(ev '(()=>{const s=alchemy.stats();return `tick ${s.tick} fps ${s.fps} tps ${s.tps} active ${s.processed} reactions Σ${s.reactionsTotal} blasts ${s.explosionsTotal} sim ${(s.ms.sweep+s.ms.heat).toFixed(1)}ms draw ${s.ms.render.toFixed(1)}ms`})()')"
done
btn "Electrical Lab"; sleep 1
LAMP='(()=>{const g=alchemy.grid;const x0=Math.round(0.93*(g.W-1)),x1=Math.round(0.98*(g.W-1)),y0=Math.round(0.8*(g.H-1)),y1=Math.round(0.86*(g.H-1));let m=0,n=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const c=alchemy.cell(x,y);if(c.type==="Metal"){n++;m=Math.max(m,c.charge);}}return n+" cells, max charge "+m;})()'
hits=0; for k in $(seq 1 25); do r=$(ev "$LAMP"); case "$r" in *"max charge 0\""*) ;; *) hits=$((hits+1));; esac; sleep 0.2; done
echo "lab lamp (fed only through the water bridge) energized in $hits of 25 samples over 5 s"
agent-browser select "#viewMode" charge >/dev/null; sleep 0.2; shot P-electrical-lab-charge-view >/dev/null; agent-browser select "#viewMode" normal >/dev/null
echo "errors: $(agent-browser errors 2>&1 | head -3)"
