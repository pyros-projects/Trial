#!/usr/bin/env bash
# Check 9: coherent history and cancellation (real pointer + keyboard)
source "$(dirname "$0")/../ab.sh"
ly() { $AB scrollintoview "#layers .lrow[data-id=$1] $2" >/dev/null; $AB click "#layers .lrow[data-id=$1] $2" >/dev/null; }
H() { diag 'd.history.undo+"/"+d.history.redo'; }
fresh
echo "start history=$(H)"
echo "== 9a one long drag (40 pointer moves) = one step"
read X Y <<< "$(pt 400 160)"; B0=$(diag 'd.bounds.title'); drag $X $Y $((X+120)) $((Y+60)) 40
echo "   title $B0 -> $(diag 'd.bounds.title') ; history=$(H) labels=$(diag 'd.history.labels')"
echo "== 9b opacity slider scrub (pointer drag on the range) = one step"
$AB scrollintoview '[data-field=opacity-range]' >/dev/null
read RX RY <<< "$($AB eval '(()=>{const r=document.querySelector("[data-field=opacity-range]").getBoundingClientRect();return Math.round(r.right-4)+" "+Math.round(r.top+r.height/2)})()' | tr -d '"')"
drag $RX $RY $((RX-70)) $RY 12
echo "   opacity=$(diag 'd.project.items.find(i=>i.id==="title").opacity') history=$(H) last=$(diag 'd.history.labels.at(-1)')"
echo "== 9c label scrub on a numeric field (font size 'Size' label) = one step"
$AB scrollintoview '[data-field=font-size]' >/dev/null
read LX LY <<< "$($AB eval '(()=>{const l=document.querySelector("[data-field=font-size]").parentElement.querySelector("label");const r=l.getBoundingClientRect();return Math.round(r.left+r.width/2)+" "+Math.round(r.top+r.height/2)})()' | tr -d '"')"
drag $LX $LY $((LX+20)) $LY 10
echo "   fontSize=$(diag 'd.project.items.find(i=>i.id==="title").fontSize') history=$(H) last=$(diag 'd.history.labels.at(-1)')"
echo "== 9d layer reorder = one step"
ly title .lname; $AB click '#lyBack' >/dev/null
echo "   root order head=$(diag 'd.project.items.filter(i=>!i.parent).map(i=>i.id).slice(0,2)') history=$(H)"
echo "== 9e undo each unit (pan/zoom/selection changes between steps consume nothing)"
$AB focus '#stage' >/dev/null
$AB press Control+z >/dev/null; echo "   undo reorder -> root head=$(diag 'd.project.items.filter(i=>!i.parent).map(i=>i.id)[0]') sel=$(diag 'd.selection') history=$(H)"
$AB press h >/dev/null; drag 500 300 540 330 4; $AB press v >/dev/null; $AB press + >/dev/null; clk $(pt 400 500); echo "   after pan+zoom+select: history=$(H) sel=$(diag 'd.selection')"
$AB press Control+z >/dev/null; echo "   undo scrub -> fontSize=$(diag 'd.project.items.find(i=>i.id==="title").fontSize') sel=$(diag 'd.selection') history=$(H)"
$AB press Control+z >/dev/null; echo "   undo slider -> opacity=$(diag 'd.project.items.find(i=>i.id==="title").opacity') history=$(H)"
$AB press Control+z >/dev/null; echo "   undo drag -> title=$(diag 'd.bounds.title') history=$(H)"
$AB press Control+Shift+z >/dev/null; echo "   redo drag -> title=$(diag 'd.bounds.title') sel=$(diag 'd.selection') history=$(H)"
echo "== 9f new edit after undo clears the redo branch"
$AB press ArrowDown >/dev/null; echo "   nudge -> history=$(H) (redo must be 0)"
$AB press Control+Shift+z >/dev/null; echo "   redo attempt -> history=$(H) toast=$($AB eval 'document.querySelector("#toasts .toast:last-child")?.textContent')"
echo "== 9g Escape during a drag restores geometry, no history"
B1=$(diag 'd.bounds.title'); H1=$(H)
read X Y <<< "$(pt 420 200)"; $AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null
for i in 1 2 3 4 5; do $AB mouse move $((X+i*20)) $((Y+i*10)) >/dev/null; done
echo "   mid-drag: title=$(diag 'd.bounds.title') op=$(diag 'd.op')"
$AB press Escape >/dev/null; $AB mouse move $((X+140)) $((Y+70)) >/dev/null; $AB mouse up left >/dev/null
echo "   after Esc+release: title=$(diag 'd.bounds.title') (was $B1) history $H1 -> $(H)"
echo "== 9h focus loss during a drag (switch to another tab mid-drag) cancels"
$AB mouse move $X $Y >/dev/null; $AB mouse down left >/dev/null
for i in 1 2 3 4; do $AB mouse move $((X+i*25)) $Y >/dev/null; done
echo "   mid-drag: title=$(diag 'd.bounds.title')"
$AB tab new about:blank >/dev/null; $AB wait 300 >/dev/null; $AB tab t1 >/dev/null 2>&1 || $AB tab "$($AB tab | grep -o 't[0-9]*' | head -1)" >/dev/null
$AB mouse up left >/dev/null
echo "   after focus loss: title=$(diag 'd.bounds.title') (was $B1) history=$(H) op=$(diag 'd.op')"
$AB tab | cat
