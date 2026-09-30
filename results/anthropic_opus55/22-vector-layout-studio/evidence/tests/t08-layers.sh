#!/usr/bin/env bash
# Check 8: layer order, visibility, locks (editor + exported PNG/SVG)
source "$(dirname "$0")/../ab.sh"
field() { $AB scrollintoview "[data-field=$1]" >/dev/null; $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
ly() { $AB scrollintoview "#layers .lrow[data-id=$1] $2" >/dev/null; $AB click "#layers .lrow[data-id=$1] $2" >/dev/null; }
top_at() { read X Y <<< "$(pt $1 $2)"; $AB eval "(()=>{const e=document.elementFromPoint($X,$Y);const g=e&&e.closest('[data-id]');return g?g.getAttribute('data-id'):(e?e.id||e.tagName:'none')})()"; }
lasttoast() { $AB eval 'document.querySelector("#toasts .toast:last-child")?.textContent'; }
png() { rm -f "$1"; $AB download '#btnExportPNG' "$1" >/dev/null; node "$(dirname "$0")/../tools/png.js" "$1" "${@:2}"; }
fresh
$AB select "#compSelect" bauhaus >/dev/null; $AB find role button click --name "Load" >/dev/null; $AB wait 150 >/dev/null
echo "== 8a occlusion follows layer order (overlap point 500,380: disc under slab)"
echo "   editor top item: $(top_at 500 380)"; echo "   PNG: $(png evidence/downloads/t08-order-a.png 500,380)"
ly slab .lname; $AB click '#lyDown' >/dev/null
echo "   after 'Send backward' on slab: order=$(diag 'd.project.items.filter(i=>!i.parent).map(i=>i.id).join(",")')"
echo "   editor top item: $(top_at 500 380)"; echo "   PNG: $(png evidence/downloads/t08-order-b.png 500,380)"
rm -f evidence/downloads/t08-order.svg; $AB download '#btnExportSVG' evidence/downloads/t08-order.svg >/dev/null
python3 -c "import re;s=open('evidence/downloads/t08-order.svg').read();print('   SVG paint order: slab-rect index',s.find('fill=\"#1f4aa8\"'),'< disc index',s.find('fill=\"#e1452d\"'))"
echo "   undo reorder: $($AB focus '#stage' >/dev/null; $AB press Control+z >/dev/null; diag 'd.project.items.filter(i=>!i.parent).map(i=>i.id).slice(1,4).join(",")')"
echo "== 8b hide / show (not deleted, not hit-testable, not exported)"
ly disc .vis
echo "   items=$(diag 'd.items') disc in project: $(diag 'd.project.items.find(i=>i.id==="disc").visible') ; editor top at disc-only point 700,150: $(top_at 700 150)"
clk $(pt 700 150); echo "   click there selects: $(diag 'd.selection')"
echo "   PNG at 700,150: $(png evidence/downloads/t08-hidden.png 700,150) (background #f2ede3 expected)"
ly disc .vis; echo "   shown again: top at 700,150 = $(top_at 700 150)"
echo "== 8c lock the slab: canvas drag, Delete, and still exported"
ly slab .lk; B0=$(diag 'd.bounds.slab'); H0=$(diag 'd.history.undo')
read X Y <<< "$(pt 300 470)"; drag $X $Y $((X+60)) $((Y+40)) 6
echo "   drag: bounds $B0 -> $(diag 'd.bounds.slab') ; toast: $(lasttoast)"
clk $(pt 300 470); echo "   click selects locked slab: $(diag 'd.selection')"; $AB press Delete >/dev/null
echo "   Delete: slab exists=$(diag '!!d.bounds.slab') toast: $(lasttoast) ; history $H0 -> $(diag 'd.history.undo')"
rm -f evidence/downloads/t08-locked.svg; $AB download '#btnExportSVG' evidence/downloads/t08-locked.svg >/dev/null
echo "   locked slab in SVG export: $(grep -c 'fill="#1f4aa8"' evidence/downloads/t08-locked.svg)"
echo "== 8d locked child inside a group: parent-group transform refused, then unlock & repeat"
ly dots .twist; ly d1 .lk; ly dots .lname
DB=$(diag 'd.bounds.dots'); field bx 200
echo "   group X edit: bounds $DB -> $(diag 'd.bounds.dots') toast: $(lasttoast)"
read X Y <<< "$(pt 97 343)"; drag $X $Y $((X+50)) $((Y+50)) 6
echo "   group canvas drag: bounds -> $(diag 'd.bounds.dots')"
ly d1 .lk; ly dots .lname; field bx 200
echo "   after unlock, X edit: bounds -> $(diag 'd.bounds.dots') d1=$(diag 'd.bounds.d1')"
$AB screenshot evidence/screens/08-layers-locks.png >/dev/null
