#!/usr/bin/env bash
# Check 4: alignment & equal gaps on a blank 1200x800 artboard (real clicks, drags, typed fields)
source "$(dirname "$0")/../ab.sh"
$AB find role button click --name "New" >/dev/null
$AB wait 200 >/dev/null
# confirm modal if history exists
if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then $AB find role button click --name "Replace document" >/dev/null; fi
diag '{art:d.project.artboard, items:d.items, hist:d.history.undo}'
$AB find role button click --name "Fit" >/dev/null   # fit artboard
mk() { # draw rect with the tool then type exact values: x y w h
  $AB find role button click --name "Rectangle tool" >/dev/null
  read X Y <<< "$(pt $1 $2)"; drag $X $Y $((X+30)) $((Y+20)) 4
  for kv in "w:$3" "h:$4" "bx:$1" "by:$2"; do k=${kv%%:*}; v=${kv#*:}; $AB fill "[data-field=$k]" "$v" >/dev/null; $AB press Enter >/dev/null; done
}
mk 40 60 80 40; mk 180 100 60 40; mk 320 160 80 40
diag 'd.project.items.map(i=>[i.id,d.bounds[i.id]])'
clk $(pt 900 600)   # click empty canvas (blurs the field, clears selection)
$AB press Control+a >/dev/null
$AB find role button click --name "Align top" >/dev/null
diag 'd.project.items.map(i=>[i.id,d.bounds[i.id]])'
$AB find role button click --name "Distribute horizontally (equal gaps)" >/dev/null
diag '{b:d.project.items.map(i=>[i.id,d.bounds[i.id]]), order:d.project.items.map(i=>i.id), io:d.io.msg, hist:d.history.labels}'
# impossible distribution: widen B to 300 so extents (460) exceed span (360)
clk $(pt 220 80)
$AB fill "[data-field=w]" 300 >/dev/null; $AB press Enter >/dev/null
clk $(pt 900 600); $AB press Control+a >/dev/null
BEFORE=$(diag 'd.project'); HB=$(diag 'd.history.undo')
$AB find role button click --name "Distribute horizontally (equal gaps)" >/dev/null
AFTER=$(diag 'd.project'); HA=$(diag 'd.history.undo')
[ "$BEFORE" = "$AFTER" ] && echo "IMPOSSIBLE-DISTRIBUTE: scene unchanged (history $HB -> $HA)" || echo "IMPOSSIBLE-DISTRIBUTE: SCENE CHANGED"
$AB eval 'document.querySelector("#toasts .toast.error:last-child")?.textContent'
$AB screenshot evidence/screens/04-distribute-refused.png >/dev/null
