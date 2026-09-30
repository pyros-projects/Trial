#!/usr/bin/env bash
# Check 6: actual curve editing and bounds (path tool, node tool, numeric point controls)
source "$(dirname "$0")/../ab.sh"
newdoc() { $AB find role button click --name "New" >/dev/null; $AB wait 150 >/dev/null
  if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then $AB find role button click --name "Replace document" >/dev/null; fi; }
field() { $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; }
newdoc
$AB find role button click --name "Path (cubic Bézier pen) tool" >/dev/null
# anchor 1: press at (300,300) and drag out a handle; anchor 2: press at (500,300) and drag
read X Y <<< "$(pt 300 300)"; drag $X $Y $((X+40)) $((Y-60)) 6
read X Y <<< "$(pt 500 300)"; drag $X $Y $((X+40)) $((Y+60)) 6
$AB press Enter >/dev/null
diag '{sel:d.selection, item:d.project.items[0], hist:d.history.labels}'
# numeric point controls
field pt-a-x 100; field pt-a-y 100; field pt-out-x 100; field pt-out-y 0
$AB find role button click --name "Next point" >/dev/null
field pt-a-x 200; field pt-a-y 100; field pt-in-x 200; field pt-in-y 0
echo "BOUNDS after numeric edit (expect 100,25,100,75):"; diag 'd.bounds[d.selection[0]]'
$AB screenshot evidence/screens/06-curve-numeric.png >/dev/null
# node tool: drag the outgoing handle of point 1 from (100,0) to (60,-20) on canvas
$AB press Escape >/dev/null
$AB find role button click --name "Node — edit path points & handles tool" >/dev/null
$AB find role button click --name "Fit" >/dev/null
read X Y <<< "$(pt 100 0)"; read X2 Y2 <<< "$(pt 60 -20)"; drag $X $Y $X2 $Y2 6
echo "After handle drag:"; diag '{a:d.project.items[0].anchors, b:d.bounds[d.selection[0]], h:d.history.labels.slice(-1)}'
$AB screenshot evidence/screens/06-curve-node-drag.png >/dev/null
