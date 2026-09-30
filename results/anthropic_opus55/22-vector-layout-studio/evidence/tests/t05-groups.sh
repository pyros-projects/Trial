#!/usr/bin/env bash
# Check 5: groups & transforms (real clicks, keyboard shortcuts, inspector fields)
source "$(dirname "$0")/../ab.sh"
field() { $AB fill "[data-field=$1]" "$2" >/dev/null; $AB press Enter >/dev/null; $AB press Escape >/dev/null; }
wm() { printf '(()=>{const sc=document.getElementById("scene");const inv=sc.getCTM().inverse();const o={};for(const id of %s){const el=sc.querySelector("[data-id="+id+"]");if(!el){o[id]=null;continue;}const m=inv.multiply(el.getCTM());o[id]=[m.a,m.b,m.c,m.d,m.e,m.f].map(v=>Math.round(v*1e6)/1e6);}return JSON.stringify(o)})()' "$1" | $AB eval --stdin; }
order() { diag 'd.project.items.map(i=>i.id+(i.parent?"<"+i.parent:"")).join(",")'; }
multi() { $AB click "#addMode" >/dev/null; }
drift() { python3 - "$1" "$2" <<'PY'
import json,sys
a=json.loads(json.loads(sys.argv[1])); b=json.loads(json.loads(sys.argv[2]))
boxes={'slab':(0,0,420,140),'wedge':(560,520,820,780)}
mx=0
for k,(x0,y0,x1,y1) in boxes.items():
  for (x,y) in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]:
    pa=(a[k][0]*x+a[k][2]*y+a[k][4], a[k][1]*x+a[k][3]*y+a[k][5]); pb=(b[k][0]*x+b[k][2]*y+b[k][4], b[k][1]*x+b[k][3]*y+b[k][5])
    mx=max(mx,abs(pa[0]-pb[0]),abs(pa[1]-pb[1]))
print("max world-corner drift: %.6f units -> %s" % (mx, "PASS" if mx<=0.5 else "FAIL"))
PY
}
load_b() { $AB select "#compSelect" bauhaus >/dev/null; $AB find role button click --name "Load" >/dev/null; $AB wait 150 >/dev/null
  if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then $AB find role button click --name "Replace document" >/dev/null; fi; }
tst() { $AB eval 'document.querySelector("#toasts .toast.error:last-child")?.textContent'; }
L='["slab","wedge"]'
load_b; W0=$(wm "$L"); O0=$(order)
echo "== 5a group two contiguous siblings (slab, wedge)"
clk $(pt 300 470); multi; clk $(pt 600 560); multi
echo "selected: $(diag 'd.selection')"
$AB press Control+g >/dev/null
W1=$(wm "$L"); echo "sel=$(diag 'd.selection') world unchanged by grouping: $([ "$W0" = "$W1" ] && echo PASS || echo FAIL)"
echo "order before: $O0"; echo "order after : $(order)"
echo "== 5b translate/rotate/scale the group via inspector"
field bx 150; field rot 25; field scale 1.5
echo "group transform: $(diag 'd.project.items.find(i=>i.type==="group"&&i.name.startsWith("Group")).transform')"
W2=$(wm "$L"); echo "children world: $W2"
echo "== 5c ungroup (button) and compare world geometry"
$AB click "button[title^='Ungroup']" >/dev/null
W3=$(wm "$L"); drift "$W2" "$W3"; echo "order after ungroup: $(order)"; echo "sel after ungroup: $(diag 'd.selection')"
echo "== 5d undo/redo around ungroup"
$AB press Control+z >/dev/null; echo "undo ungroup -> $(diag '{sel:d.selection,group:!!d.project.items.find(i=>i.name==="Group 7")}')"
$AB press Control+Shift+z >/dev/null; echo "redo ungroup -> $(diag '{sel:d.selection,group:!!d.project.items.find(i=>i.name==="Group 7")}')"
drift "$W3" "$(wm "$L")"
echo "== 5e nested group (slab+wedge) -> (+arc), rotate outer, ungroup both levels"
$AB press Control+g >/dev/null
multi; clk $(pt 298 642); multi
echo "sel: $(diag 'd.selection')"; $AB press Control+g >/dev/null
echo "nest: $(order)"
field rot -40; W4=$(wm '["slab","wedge","arc"]')
$AB press Control+Shift+g >/dev/null; echo "after ungrouping outer, sel: $(diag 'd.selection')"
$AB press Control+Shift+g >/dev/null; echo "after ungrouping inner too: $(order)"
W5=$(wm '["slab","wedge","arc"]'); drift "$W4" "$W5"
$AB press Control+z >/dev/null; $AB press Control+z >/dev/null; echo "undo x2 -> nesting restored: $(order)"
echo "== 5f refuse noncontiguous siblings (disc + wedge; slab sits between)"
load_b; clk $(pt 700 200); multi; clk $(pt 600 560); multi
S0=$(diag 'd.selection'); P0=$(diag 'd.project'); echo "selected: $S0"
$AB press Control+g >/dev/null; echo "toast: $(tst)"
[ "$P0" = "$(diag 'd.project')" ] && [ "$S0" = "$(diag 'd.selection')" ] && echo "noncontiguous: scene+selection unchanged PASS" || echo "noncontiguous: CHANGED FAIL"
echo "== 5g refuse different parents (disc + a mark bar inside Registration marks > Mark top-left)"
lyclick() { $AB scrollintoview "$1" >/dev/null; $AB click "$1" >/dev/null; }
lyclick '#layers .lrow[data-id=reg] .twist'; lyclick '#layers .lrow[data-id=mk1] .twist'
clk $(pt 700 200); multi; lyclick '#layers .lrow[data-id=mk1h] .lname'; multi
S0=$(diag 'd.selection'); P0=$(diag 'd.project'); echo "selected: $S0"
$AB eval 'document.querySelectorAll("#toasts .toast").forEach(t=>t.remove())' >/dev/null
$AB scrollintoview "button[title^='Group (']" >/dev/null; $AB click "button[title^='Group (']" >/dev/null; echo "toast: $(tst)"
[ "$P0" = "$(diag 'd.project')" ] && [ "$S0" = "$(diag 'd.selection')" ] && echo "cross-parent: scene+selection unchanged PASS" || echo "cross-parent: CHANGED FAIL"
echo "== 5h ancestor + descendant selected together: transform applies once"
lyclick '#layers .lrow[data-id=reg] .lname'; multi; lyclick '#layers .lrow[data-id=mk1] .lname'; multi
echo "selected: $(diag 'd.selection') effective targets: $(diag 'd.targets')"
B0=$(diag 'd.bounds.mk1h'); $AB focus '#stage' >/dev/null; $AB press ArrowRight >/dev/null
echo "mk1h bounds before $B0 after $(diag 'd.bounds.mk1h') (expect x +1 exactly once)"
$AB scrollintoview "[data-field=rot]" >/dev/null; field rot 90; echo "after rotation 90 (inspector shows the single effective target) on [reg,mk1]: reg rot=$(diag 'd.project.items.find(i=>i.id==="reg").transform.rotation') mk1 rot=$(diag 'd.project.items.find(i=>i.id==="mk1").transform.rotation') (expect 90 and 0)"
$AB screenshot evidence/screens/05-groups.png >/dev/null
