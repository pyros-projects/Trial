#!/usr/bin/env bash
# Check 2: creation tools, handles, inspector refinement, pan/zoom/resize continuity, bounds vs visible geometry
source "$(dirname "$0")/../ab.sh"
field() { $AB scrollintoview "[data-field=$1]" >/dev/null; $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
newdoc() { $AB find role button click --name "New" >/dev/null; $AB wait 150 >/dev/null
  if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then $AB find role button click --name "Replace document" >/dev/null; fi; }
tool() { $AB find role button click --name "$1 tool" >/dev/null; }
# compare doc-space bounds (diag) with the rendered shape's on-screen box, for an unrotated item
vis() { printf '(()=>{const d=VLS.diagnostics();const b=d.bounds["%s"];const el=document.querySelector("#scene [data-id=%s] > :not(.hit)");const r=el.getBoundingClientRect(),s=document.getElementById("stage").getBoundingClientRect();const ex={x:s.left+d.pan.x+b.x*d.zoom,y:s.top+d.pan.y+b.y*d.zoom,w:b.w*d.zoom,h:b.h*d.zoom};const e=Math.max(Math.abs(ex.x-r.left),Math.abs(ex.y-r.top),Math.abs(ex.w-r.width),Math.abs(ex.h-r.height));return "bounds "+JSON.stringify(b)+" | screen box vs mapped bounds max err "+e.toFixed(3)+"px"})()' "$1" "$1" | $AB eval --stdin; }
fresh; newdoc; $AB find role button click --name "Fit" >/dev/null
$AB click '#snapObj' >/dev/null   # object snap off so pointer deltas are measured exactly
echo "== 2a create with the tools"
tool Ellipse; read X Y <<< "$(pt 100 100)"; drag $X $Y $((X+140)) $((Y+90)) 6; E=$(diag 'd.selection[0]' | tr -d '"\\')
tool Line; read X Y <<< "$(pt 400 100)"; drag $X $Y $((X+150)) $((Y+60)) 6; L=$(diag 'd.selection[0]' | tr -d '"\\')
tool Rectangle; read X Y <<< "$(pt 100 350)"; drag $X $Y $((X+120)) $((Y+80)) 6; R=$(diag 'd.selection[0]' | tr -d '"\\')
tool Text; clk $(pt 600 400); $AB keyboard type "Hello layout" >/dev/null; $AB press Control+Enter >/dev/null; T=$(diag 'd.selection[0]' | tr -d '"\\')
echo "   created: $(diag 'd.project.items.map(i=>i.type+":"+i.id+(i.text?"("+i.text+")":"")).join(" ")') history=$(diag 'd.history.labels')"
echo "== 2b move and resize with handles (zoom $(diag 'd.zoom'))"
Z=$(diag 'd.zoom' | tr -d '"'); B0=$(diag "d.bounds['$R']")
tool "Select / move"; read X Y <<< "$(pt 150 380)"; drag $X $Y $((X+50)) $((Y+30)) 8
echo "   drag +50,+30 px: $B0 -> $(diag "d.bounds['$R']") (expect +$(python3 -c "print(round(50/$Z,4), round(30/$Z,4))"))"
read HX HY <<< "$($AB eval '(()=>{const h=document.querySelector("#overlay [data-handle=\"resize:se\"]").getBoundingClientRect();return Math.round(h.left+h.width/2)+" "+Math.round(h.top+h.height/2)})()' | tr -d '"')"
drag $HX $HY $((HX+40)) $((HY+20)) 6; echo "   SE handle +40,+20 px: $(diag "d.project.items.find(i=>i.id==='$R')" | python3 -c "import json,sys;i=json.loads(json.loads(sys.stdin.read()));print('w',i['width'],'h',i['height'])")"
read HX HY <<< "$($AB eval '(()=>{const h=document.querySelector("#overlay [data-handle=\"resize:w\"]").getBoundingClientRect();return Math.round(h.left+h.width/2)+" "+Math.round(h.top+h.height/2)})()' | tr -d '"')"
drag $HX $HY $((HX-30)) $HY 6; echo "   W handle -30 px: bounds $(diag "d.bounds['$R']") (right edge fixed)"
field w 150; field h 90; echo "   inspector W=150 H=90: $(diag "d.bounds['$R']")"
echo "   $(vis $R)"
echo "== 2c pan, zoom, resize the browser, drag again: no jump"
$AB click "#layers .lrow[data-id=$R] .lname" >/dev/null; tool "Hand — pan"; drag 500 400 760 360 5; tool "Select / move"; $AB focus "#stage" >/dev/null; $AB press + >/dev/null; $AB press + >/dev/null
$AB set viewport 1100 720 >/dev/null; $AB wait 300 >/dev/null
Z=$(diag 'd.zoom' | tr -d '"'); B1=$(diag "d.bounds['$R']"); read X Y <<< "$(pt 200 430)"
echo "   zoom=$Z selection kept: $(diag 'd.selection')"
drag $X $Y $((X+37)) $((Y+23)) 9
echo "   drag +37,+23 px: $B1 -> $(diag "d.bounds['$R']") (expect +$(python3 -c "print(round(37/$Z,4), round(23/$Z,4))"))"
echo "   $(vis $R)"
$AB screenshot evidence/screens/02-after-resize-1100.png >/dev/null
$AB set viewport 1280 800 >/dev/null; $AB wait 200 >/dev/null
echo "== 2d rotated ellipse bounds = AABB of transformed local box"
$AB click "#layers .lrow[data-id=$E] .lname" >/dev/null; field rot 30
python3 - "$(diag "d.project.items.find(i=>i.id==='$E')")" "$(diag "d.bounds['$E']")" <<'PY'
import json,sys,math
i=json.loads(json.loads(sys.argv[1])); b=json.loads(json.loads(sys.argv[2]))
w,h=i['width'],i['height']; a=math.radians(30)
print("   expected w,h %.4f %.4f | reported %.4f %.4f" % (w*math.cos(a)+h*math.sin(a), w*math.sin(a)+h*math.cos(a), b['w'], b['h']))
PY
echo "== 2e multi-select (marquee), duplicate, delete, keyboard, typing safety"
$AB find role button click --name "Fit" >/dev/null; clk $(pt 1150 780); read X Y <<< "$(pt 60 60)"; read X2 Y2 <<< "$(pt 580 200)"; drag $X $Y $X2 $Y2 6
echo "   marquee selected: $(diag 'd.selection')"
$AB press Control+d >/dev/null; echo "   Ctrl+D: selection $(diag 'd.selection') items=$(diag 'd.items')"
$AB press Delete >/dev/null; echo "   Delete: items=$(diag 'd.items') selection=$(diag 'd.selection')"
$AB click "#layers .lrow[data-id=$T] .lname" >/dev/null; B2=$(diag "d.bounds['$T']"); $AB focus '#stage' >/dev/null
$AB press ArrowRight >/dev/null; $AB press Shift+ArrowDown >/dev/null; echo "   nudge → +1, Shift+↓ +10: $B2 -> $(diag "d.bounds['$T']")"
$AB scrollintoview "[data-field=font-size]" >/dev/null; $AB click "[data-field=font-size]" >/dev/null
for k in Backspace Delete Backspace ArrowLeft; do $AB press $k >/dev/null; done; $AB keyboard type "x" >/dev/null
echo "   typing Backspace/Delete/arrows in a field: items=$(diag 'd.items') text item exists=$(diag "!!d.bounds['$T']") field shows '$($AB get value '[data-field=font-size]')'"
$AB press Escape >/dev/null; echo "   Escape restores field: '$($AB get value '[data-field=font-size]')' fontSize=$(diag "d.project.items.find(i=>i.id==='$T').fontSize")"
$AB screenshot evidence/screens/02-create-1280.png >/dev/null
echo "== 2f narrow viewport 390x844"
$AB set viewport 390 844 >/dev/null; $AB wait 300 >/dev/null; $AB find role button click --name "Fit" >/dev/null
echo "   page scrollWidth=$($AB eval 'document.documentElement.scrollWidth') bodyScroll=$($AB eval 'document.body.scrollWidth') stage=$($AB eval 'JSON.stringify(document.getElementById("stage").getBoundingClientRect())')"
echo "   $(vis $R)"
read X Y <<< "$(pt 200 430)"; B3=$(diag "d.bounds['$R']"); Z=$(diag 'd.zoom' | tr -d '"'); drag $X $Y $((X+30)) $((Y+15)) 6
echo "   narrow drag +30,+15 px at zoom $Z: $B3 -> $(diag "d.bounds['$R']") sel=$(diag 'd.selection')"
$AB screenshot evidence/screens/02-narrow-inspect.png >/dev/null
$AB click '#tabLayers' >/dev/null; $AB screenshot evidence/screens/02-narrow-layers.png >/dev/null
echo "   layers tab visible rows: $($AB eval 'document.querySelectorAll("#layers .lrow").length') inspector hidden: $($AB eval 'getComputedStyle(document.getElementById("inspector")).display')"
$AB click '#tabInspect' >/dev/null; $AB set viewport 1280 800 >/dev/null
