#!/bin/bash
# E4 DR-only voyage (no sights) must miss; E5 deliberate +5' misalignment; E6 poor cut / parallel LOPs
source "$(dirname "$0")/lib.sh"
$AB set viewport 1280 800 >/dev/null; fresh
echo "E4 DR only: steer for Bermuda from DR, then +6 h jumps, no sights"
tab "Helm & time"; clickSel "[data-act=steer]"; MIN=999
for i in $(seq 1 12); do clickSel '[data-skip="21600000"]'; S=$(summary '(s=>({t:s.t,status:s.status,d:+s.island.d.toFixed(1),range:+s.island.range.toFixed(1)}))'); echo "   +6h $S"; echo "$S" | grep -q 'status:sailing' || break; done
$AB wait 800 >/dev/null; shot 08-dr-only-out-of-water.png; $AB snapshot | grep -E "Out of water|lay .* nm away" | head -3
$AB find role button click --name "Close" >/dev/null 2>&1
echo "E5 deliberate misalignment (practice mode reveals truth)"
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null; tab "Helm & time"; $AB scrollintoview "#inReveal" >/dev/null; $AB check "#inReveal" >/dev/null
$T/face.sh Antares; $T/sight.sh Antares | grep -E "logged" | cut -c1-230
$T/face.sh Antares; P=$(q 'JSON.stringify(starfix.screenOf("Antares"))'); X=$(echo $P | sed -E "s/.*x:([0-9]+).*/\1/"); Y=$(echo $P | sed -E "s/.*y:([0-9]+).*/\1/")
$AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 200 >/dev/null; $AB find role button click --name "Take sight ⤵" >/dev/null; $AB wait 300 >/dev/null
$T/align.sh >/dev/null; $AB press Escape >/dev/null  # sight #2 aligned again (reference)
$AB mouse move $X $Y >/dev/null; $AB mouse down >/dev/null; $AB mouse up >/dev/null; $AB wait 200 >/dev/null; $AB find role button click --name "Take sight ⤵" >/dev/null; $AB wait 300 >/dev/null
for r in 1 2; do $AB wait --fn "Math.abs(starfix.summary().sextant.phi) < 0.12" >/dev/null; OFF=$(q 'starfix.summary().sextant.off'); N=$(uv run python -c "print(round($OFF/0.5))"); K=ArrowDown; [ "$N" -lt 0 ] && { K=ArrowUp; N=$((-N)); }; for i in $(seq 1 $N); do $AB press $K >/dev/null; done; done
for i in $(seq 1 10); do $AB press ArrowDown >/dev/null; done   # +5.0' more arc: image deliberately 5' below the horizon
$AB wait --fn "Math.abs(starfix.summary().sextant.phi) < 0.1" >/dev/null; echo "   at mark: $(summary '(s=>s.sextant)')"; $AB press Space >/dev/null; $AB wait 200 >/dev/null; $AB press Escape >/dev/null
echo "   sights: $(summary '(s=>s.sights.map(x=>({id:x.id,body:x.body,errArc:+x.errArc.toFixed(2),lopErr:+x.lopErr.toFixed(2),intercept:+x.intercept.toFixed(2)})))')"
tab "Sights & fix"; shot 09-practice-misaligned-sight.png
echo "E6 poor cut: Antares (Zn 213) + Rasalhague (Zn 225)"
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null
for b in Antares Rasalhague; do $T/face.sh $b; $T/sight.sh $b | grep -E "logged" | cut -c1-120; done
echo "   fix: $(summary '(s=>s.fix)')"; tab "Sights & fix"; $AB snapshot | grep -E "Poor cut|crossing angle" | head -3; shot 10-poor-cut.png
echo "E6b near-parallel: Arcturus (276) + Alphecca (276)"
$AB click "#btnReset" >/dev/null; $AB wait 300 >/dev/null
for b in Arcturus Alphecca; do $T/face.sh $b; $T/sight.sh $b | grep -E "logged" | cut -c1-120; done
echo "   fix: $(summary '(s=>s.fix)')"; tab "Sights & fix"; $AB snapshot | grep -E "almost parallel" | head -2; shot 11-parallel-lops.png
echo "   console errors: [$($AB errors | tr '\n' ' ')]"
