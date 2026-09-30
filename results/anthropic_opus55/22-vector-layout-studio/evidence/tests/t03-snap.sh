#!/usr/bin/env bash
# Check 3: snapping with real pointer drags at 100% and 200% zoom
source "$(dirname "$0")/../ab.sh"
field() { $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
newdoc() { $AB find role button click --name "New" >/dev/null; $AB wait 150 >/dev/null
  if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then $AB find role button click --name "Replace document" >/dev/null; fi; }
mk() { $AB find role button click --name "Rectangle tool" >/dev/null; read X Y <<< "$(pt $1 $2)"; drag $X $Y $((X+30)) $((Y+20)) 4
  field w $3; field h $4; field bx $1; field by $2; diag 'd.selection[0]' | tr -d '"\\'; }
bx() { diag "d.bounds['$1'].x" ; }
by() { diag "d.bounds['$1'].y" ; }
# drag an object by (dx,dy) CSS px starting at doc point (sx,sy); report guides seen before release
undo1() { [ "$(diag 'd.history.undo')" != "$HB" ] && $AB press Control+z >/dev/null; }
dragby() { HB=$(diag 'd.history.undo'); read X Y <<< "$(pt $1 $2)"; $AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null
  for i in 1 2 3 4 5 6; do $AB mouse move $((X + $3*i/6)) $((Y + $4*i/6)) >/dev/null; done
  G=$($AB eval '[...document.querySelectorAll("#overlay [data-guide]")].map(e=>e.getAttribute("data-guide")).join(" ")')
  $AB mouse up left >/dev/null; echo "   guides during drag: $G"; }
$AB set viewport 1280 800 >/dev/null
newdoc
$AB find role button click --name "Fit" >/dev/null
A=$(mk 300 200 100 100); C=$(mk 100 620 100 100); B=$(mk 600 120 100 100)
echo "A=$A B=$B C=$C  snap grid=$(diag 'd.snap.grid') object=$(diag 'd.snap.object')"
clk $(pt 900 700); $AB press 1 >/dev/null; echo "zoom=$(diag 'd.zoom')"
echo "== 3a 100%: move B left so its left edge is proposed 5px right of A's right edge (400)"
dragby 650 170 -195 0; echo "   B.x=$(bx $B) (expect 400 snapped)"; undo1
echo "== 3b 100%: proposed 8px away (408) must not snap"
dragby 650 170 -192 0; echo "   B.x=$(bx $B) (expect 408 unsnapped)"; undo1
$AB screenshot evidence/screens/03-snap-100.png >/dev/null
echo "== 3c 200%"
clk $(pt 900 700); $AB press 2 >/dev/null; $AB press h >/dev/null; drag 500 150 500 450 4; drag 500 150 500 450 4; $AB press v >/dev/null; echo "zoom=$(diag 'd.zoom') pan=$(diag 'd.pan')"
dragby 650 170 -395 0; echo "   5px (proposed 402.5): B.x=$(bx $B) (expect 400)"; undo1
dragby 650 170 -392 0; echo "   8px (proposed 404): B.x=$(bx $B) (expect 404 unsnapped)"; undo1
$AB find role button click --name "Fit" >/dev/null; clk $(pt 900 700); $AB press 1 >/dev/null
echo "== 3d grid snapping only (object snap off, grid 10)"
$AB click "#snapObj" >/dev/null; $AB click "#snapGrid" >/dev/null
dragby 650 170 -147 0; echo "   B.x=$(bx $B) (unsnapped 453 -> expect 450)"; undo1
dragby 650 170 -156 0; echo "   B.x=$(bx $B) (unsnapped 444 -> expect 440 or 445? nearest grid feature)"; undo1
$AB click "#snapGrid" >/dev/null; $AB click "#snapObj" >/dev/null
echo "== 3e hidden objects are not targets: hide A, repeat 3a"
$AB scrollintoview "#layers .lrow[data-id=$A] .vis" >/dev/null; $AB click "#layers .lrow[data-id=$A] .vis" >/dev/null
dragby 650 170 -195 0; echo "   B.x=$(bx $B) (expect 405: hidden A ignored)"; undo1
$AB click "#layers .lrow[data-id=$A] .vis" >/dev/null
echo "== 3f objects inside the moving selection do not attract: select A+B, move by 4px right"
clk $(pt 350 250); $AB click "#addMode" >/dev/null; clk $(pt 650 170); $AB click "#addMode" >/dev/null
dragby 650 170 4 0; echo "   A.x=$(bx $A) B.x=$(bx $B) (expect 304/604; they do not snap to each other)"; undo1
echo "== 3g nested child selected through Layers: ancestor group not a target, sibling is"
clk $(pt 350 250); $AB click "#addMode" >/dev/null; clk $(pt 150 670); $AB click "#addMode" >/dev/null
$AB press Control+g >/dev/null; G=$(diag 'd.selection[0]' | tr -d '"\\'); echo "   group $G bounds $(diag "d.bounds['$G']") (centre y=460 is unique to the group)"
[ "$($AB get attr "#layers .lrow[data-id=$G]" aria-expanded)" = "true" ] || $AB click "#layers .lrow[data-id=$G] .twist" >/dev/null; $AB click "#layers .lrow[data-id=$A] .lname" >/dev/null
echo "   selected: $(diag 'd.selection')"
dragby 350 250 0 257; echo "   A.y=$(by $A) (proposed 457, 3px from ancestor-group centre 460 -> expect 457, no snap)"; undo1
$AB click "#layers .lrow[data-id=$A] .lname" >/dev/null
dragby 350 250 0 324; echo "   A.y=$(by $A) (proposed bottom 624, 4px from sibling C top 620 -> expect 520)"
$AB screenshot evidence/screens/03-snap-nested.png >/dev/null
echo "== 3h keyboard nudge and numeric edit stay exact (no resnap)"
$AB focus '#stage' >/dev/null; $AB press ArrowDown >/dev/null; echo "   A.y after nudge=$(by $A) (expect 521)"
$AB scrollintoview "[data-field=by]" >/dev/null; field by 318.5; echo "   A.y after typing 318.5 = $(by $A)"
