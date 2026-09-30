#!/usr/bin/env bash
# Check 12: session boundary, Reset and reload
source "$(dirname "$0")/../ab.sh"
ly() { $AB scrollintoview "#layers .lrow[data-id=$1] $2" >/dev/null; $AB click "#layers .lrow[data-id=$1] $2" >/dev/null; }
D=$PWD/evidence/downloads
fresh; INIT=$(diag 'd.project'); echo "initial composition captured ($(diag 'd.items') items)"
echo "== 12a modify, import a project, then leave a text edit pending and press Reset"
read X Y <<< "$(pt 300 120)"; drag $X $Y $((X+80)) $((Y+40)) 6
$AB upload '#fileImport' $D/t10-project.vls.json >/dev/null; $AB wait 300 >/dev/null; $AB find role button click --name "Replace document" >/dev/null; $AB wait 200 >/dev/null
echo "   imported: $(diag 'd.io.msg') docName=$(diag 'd.docName')"
ly sub .lname; $AB focus '#stage' >/dev/null; $AB press ArrowRight >/dev/null
$AB scrollintoview '#insText' >/dev/null; $AB click '#insText' >/dev/null; $AB keyboard type ' PENDING' >/dev/null
echo "   pending: live=$(diag 'd.liveTransaction') history=$(diag 'd.history.undo') sel=$(diag 'd.selection')"
$AB click '#btnReset' >/dev/null; $AB wait 150 >/dev/null
echo "   reset dialog: $($AB eval 'document.getElementById("modalBody").textContent' | cut -c1-120)"
$AB find role button click --name "Reset session" >/dev/null; $AB wait 200 >/dev/null
R=$(diag 'd.project')
echo "   after reset: identical to initial=$([ "$R" = "$INIT" ] && echo yes || echo NO) sel=$(diag 'd.selection') history=$(diag 'd.history.undo+"/"+d.history.redo') live=$(diag 'd.liveTransaction') op=$(diag 'd.op') docName=$(diag 'd.docName') modal=$($AB eval '!document.getElementById("modal").hidden') preview=$($AB eval '!document.getElementById("preview").hidden')"
echo "== 12b pending import at Reset: start an import and reset before it can apply"
$AB upload '#fileImport' $D/t10-project.vls.json >/dev/null; $AB click '#btnReset' >/dev/null 2>&1
if [ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ]; then
  echo "   modal after import+reset click: $($AB eval 'document.getElementById("modalTitle").textContent')"
  $AB find role button click --name "Reset session" >/dev/null 2>&1 || $AB find role button click --name "Cancel" >/dev/null 2>&1
fi
$AB wait 200 >/dev/null
[ "$($AB eval '!document.getElementById("modal").hidden')" = "true" ] && { $AB find role button click --name "Reset session" >/dev/null 2>&1; }
$AB wait 2500 >/dev/null
echo "   2.5 s later: identical to initial=$([ "$(diag 'd.project')" = "$INIT" ] && echo yes || echo NO) history=$(diag 'd.history.undo') modal=$($AB eval '!document.getElementById("modal").hidden') io=$(diag 'd.io.msg')"
echo "== 12c reload starts from the same composition"
read X Y <<< "$(pt 300 120)"; drag $X $Y $((X+80)) $((Y+40)) 6
$AB reload >/dev/null; $AB wait 300 >/dev/null
echo "   after reload: identical to initial=$([ "$(diag 'd.project')" = "$INIT" ] && echo yes || echo NO) history=$(diag 'd.history.undo')"
echo "   storage used by app: localStorage keys=$($AB eval 'localStorage.length') sessionStorage keys=$($AB eval 'sessionStorage.length') cookies='$($AB eval 'document.cookie')'"
echo "   console errors: $($AB errors 2>&1 | head -3)"
