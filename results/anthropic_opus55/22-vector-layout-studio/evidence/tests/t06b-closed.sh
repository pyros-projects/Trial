#!/usr/bin/env bash
# Check 6b: closed filled path, reopen, node edit after rotation and inside a rotated group, export geometry
source "$(dirname "$0")/../ab.sh"
field() { $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; }
$AB find role button click --name "Path (cubic Bézier pen) tool" >/dev/null
for p in "500 400" "700 400" "650 600"; do read X Y <<< "$(pt $p)"; clk $X $Y; done
read X Y <<< "$(pt 500 400)"; clk $X $Y      # click first point -> close
diag '{sel:d.selection, closed:d.project.items.at(-1).closed, n:d.project.items.at(-1).anchors.length, fill:d.project.items.at(-1).fill}'
PID=$(diag 'd.selection[0]' | tr -d '"\\')
echo "closed path id=$PID; fill painted? $($AB eval "document.querySelector('#scene [data-id=$PID] path').getAttribute('fill')")"
# reopen then close via checkbox
$AB find role checkbox click --name "Closed path" >/dev/null 2>&1 || $AB click "[data-field=closed]" >/dev/null
echo "after uncheck: closed=$(diag 'd.project.items.at(-1).closed') svg-fill=$($AB eval "document.querySelector('#scene [data-id=$PID] path').getAttribute('fill')")"
$AB click "[data-field=closed]" >/dev/null
echo "after re-check: closed=$(diag 'd.project.items.at(-1).closed')"
# rotate 30 degrees via inspector
field rot 30
echo "rotated: $(diag 'd.project.items.at(-1).transform')"
# node tool: drag anchor 2 to doc (760,380); the anchor must land under the pointer
$AB find role button click --name "Node — edit path points & handles tool" >/dev/null
A2=$(printf '(()=>{const d=VLS.diagnostics();const it=d.project.items.at(-1);const t=it.transform,a=it.anchors[1];const r=t.rotation*Math.PI/180,c=Math.cos(r)*t.scale,s=Math.sin(r)*t.scale;return [c*a.x-s*a.y+t.x, s*a.x+c*a.y+t.y].map(v=>Math.round(v*100)/100).join(" ")})()' | $AB eval --stdin | tr -d '"')
echo "anchor2 world before: $A2"
read AX AY <<< "$A2"; read X Y <<< "$(pt $AX $AY)"; read X2 Y2 <<< "$(pt 760 380)"; drag $X $Y $X2 $Y2 6
echo "Point fields after drag (doc space): X=$($AB get value '[data-field=pt-a-x]') Y=$($AB get value '[data-field=pt-a-y]')  (pointer target 760,380; px rounding ±1/zoom)"
# group it with nothing else, rotate the group, then node-edit again
$AB find role button click --name "Select / move tool" >/dev/null
$AB press Control+g >/dev/null
field rot 15
echo "group: $(diag '{sel:d.selection, g:d.project.items.find(i=>i.type==="group").transform}')"
$AB find role button click --name "Expand Group 1" >/dev/null 2>&1
$AB click "#layers .lrow[data-id=$PID]" >/dev/null
$AB find role button click --name "Node — edit path points & handles tool" >/dev/null
read X Y <<< "$(pt $($AB get value '[data-field=pt-a-x]') $($AB get value '[data-field=pt-a-y]'))"
read X2 Y2 <<< "$(pt 520 360)"; drag $X $Y $X2 $Y2 6
echo "In rotated group, point 1 fields: X=$($AB get value '[data-field=pt-a-x]') Y=$($AB get value '[data-field=pt-a-y]') (target 520,360)"
$AB screenshot evidence/screens/06-node-in-rotated-group.png >/dev/null
echo "SVG path export snippet:"; printf '(()=>{const d=VLS.diagnostics();return d.history.labels.join(", ")})()' | $AB eval --stdin
