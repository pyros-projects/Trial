#!/bin/bash
# E1–E3: first impression, three hand-taken star sights, fix, full Bermuda voyage to landfall (real clicks/keys)
source "$(dirname "$0")/lib.sh"
$AB set viewport 1280 800 >/dev/null; fresh
echo "E1 initial: $(summary '(s=>({voyage:s.voyage,t:s.t,sights:s.sights.length,running:s.running}))')"; shot 01-initial-desktop.png
echo "   console errors: [$($AB errors | tr '\n' ' ')]"
echo "E2 dusk star sights (planner click -> deck click -> Take sight -> arrow keys -> Space at bottom of swing)"
$T/face.sh Antares; P=$(q 'JSON.stringify(starfix.screenOf("Antares"))'); X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/")
$AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 250 >/dev/null; shot 02-body-card.png
$AB find role button click --name "Take sight ⤵" >/dev/null; $AB wait 500 >/dev/null; shot 03-sextant-eyepiece.png
$T/align.sh | grep -E "at mark|logged" | cut -c1-230
$AB press Escape >/dev/null
for b in Arcturus Eltanin; do $T/face.sh $b; $T/sight.sh $b | grep -E "logged" | cut -c1-230; done
echo "   fix: $(summary '(s=>s.fix)')"; tab "Sights & fix"; shot 04-three-lops-fix.png
adopt "Adopt fix as new DR"; tab "Helm & time"; clickSel "[data-act=steer]"
echo "   legs after steer: $(summary '(s=>s.legs.map(l=>l.crs))')"
echo "E3 night passage -> morning twilight"; clickSel "[data-act=twilight]"; $AB wait 300 >/dev/null; echo "   t=$(summary '(s=>s.t)')"; shot 05-morning-twilight.png
$T/shoot_suggested.sh | cut -c1-200
echo "   morning fix: $(summary '(s=>s.fix)')"; adopt "Adopt fix as new DR"; tab "Helm & time"; clickSel "[data-act=steer]"
for i in $(seq 1 14); do clickSel '[data-skip="3600000"]'; S=$(summary '(s=>({t:s.t,status:s.status,d:+s.island.d.toFixed(1),range:+s.island.range.toFixed(1)}))'); echo "   +1h $S"; echo "$S" | grep -q 'status:sailing' || break; done
$AB wait 2200 >/dev/null; shot 06-landfall-debrief.png
$AB snapshot | grep -E "Land ho|time at sea|sights taken|mean" | head -8
$AB find role button click --name "Inspect the chart" >/dev/null; $AB wait 300 >/dev/null; shot 07-true-track-revealed.png
echo "   console errors: [$($AB errors | tr '\n' ' ')]"
