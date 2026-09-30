#!/bin/bash
# E7 Clipperton: Sun-only running fix -> landfall;  E8 Pitcairn: unknown chronometer error -> latitude sailing -> landfall
source "$(dirname "$0")/lib.sh"
$AB set viewport 1280 800 >/dev/null; fresh
echo "E7 Clipperton (voyage chosen through the Voyages dialog)"
$AB click "#btnVoyages" >/dev/null; $AB click '[data-voy="clipperton"]' >/dev/null; $AB wait 400 >/dev/null
$T/sunsight.sh; tab "Helm & time"; clickSel "[data-act=noon]"; $AB wait 300 >/dev/null; echo "   local noon jump -> $(summary '(s=>s.t)')"
$T/face.sh Sun; $AB find role button click --name "Take sight ⤵" >/dev/null; $AB wait 400 >/dev/null; shot 12-sun-lower-limb.png; $T/align.sh | grep logged | cut -c1-200; $AB press Escape >/dev/null
echo "   running fix: $(summary '(s=>s.fix)')"; tab "Sights & fix"; shot 13-running-fix.png
adopt "Adopt fix as new DR"; tab "Helm & time"; clickSel "[data-act=steer]"
for i in $(seq 1 10); do clickSel '[data-skip="3600000"]'; S=$(summary '(s=>({t:s.t,status:s.status,d:+s.island.d.toFixed(1),range:+s.island.range.toFixed(1)}))'); echo "   +1h $S"; echo "$S" | grep -q 'status:sailing' || break; done
$AB wait 2000 >/dev/null; shot 14-clipperton-landfall.png; $AB find role button click --name "Inspect the chart" >/dev/null 2>&1
echo "E8 Pitcairn"
$AB click "#btnVoyages" >/dev/null; $AB click '[data-voy="pitcairn"]' >/dev/null; $AB wait 400 >/dev/null
$T/shoot_suggested.sh | cut -c1-110; echo "   first fix vs truth: $(summary '(s=>({fix:s.fix.pos,truth:s.truePos,dLonDeg:+(s.fix.pos[1]-s.truePos[1]).toFixed(3),dLatMin:+((s.fix.pos[0]-s.truePos[0])*60).toFixed(2)}))')"
adopt "Adopt fix as new DR"; DR=$(q 'starfix.summary().dr.join(" ")'); CRS=$(node $T/crs.js $DR -25.067 -129.0); echo "   aim for the island's parallel 60 nm east of it (by the fix): course $CRS"; setcrs $CRS
tab "Helm & time"; clickSel "[data-act=twilight]"; $AB wait 300 >/dev/null; echo "   evening twilight: $(summary '(s=>s.t)')"
$T/shoot_suggested.sh | grep -c logged; adopt "Adopt fix as new DR"; DR=$(q 'starfix.summary().dr.join(" ")'); CRS=$(node $T/crs.js $DR -25.067 -129.0); setcrs $CRS; echo "   re-steer $CRS"
PHASE=south
for i in $(seq 1 60); do
  clickSel '[data-skip="3600000"]'
  S=$(summary '(s=>({t:s.t,status:s.status,drLat:+s.dr[0].toFixed(3),d:+s.island.d.toFixed(1)}))'); LAT=$(echo $S | sed -E 's/.*drLat:(-?[0-9.]+).*/\1/')
  if [ "$PHASE" = south ] && uv run python -c "import sys;sys.exit(0 if $LAT <= -25.05 else 1)"; then PHASE=west; setcrs 270; echo "   on the parallel -> run west: $S"; fi
  [ $((i % 6)) -eq 0 ] && echo "   $S"; echo "$S" | grep -q 'status:sailing' || { echo "   END $S"; break; }
done
$AB wait 2000 >/dev/null; shot 15-pitcairn-debrief.png; $AB snapshot | grep -E "chronometer was|Land ho" | head -3
$AB find role button click --name "Inspect the chart" >/dev/null 2>&1; $AB wait 300 >/dev/null; shot 16-pitcairn-chart-truth.png
echo "   console errors: [$($AB errors | tr '\n' ' ')]"
