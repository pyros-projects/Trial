#!/usr/bin/env bash
# Compact browser regression for Spreadsheet & Chart Studio (agent-browser 0.31.1).
# Drives the real UI with clicks/keys; asserts on rendered DOM text. Usage: bash evidence/tests/regression.sh
cd "$(dirname "$0")/../.." || exit 1
ROOT="$PWD"
export AGENT_BROWSER_SESSION=regress
source evidence/tests/ab-helpers.sh
P=0; F=0
check() { # label, got, want
  if [ "$2" == "$3" ]; then P=$((P+1)); echo "PASS $1"; else F=$((F+1)); echo "FAIL $1: got [$2] want [$3]"; fi
}
reset() { agent-browser click "#btn-reset" >/dev/null; }
mkdir -p evidence/downloads/regress
agent-browser --download-path "$ROOT/evidence/downloads/regress" open "file://$ROOT/index.html" >/dev/null
agent-browser set viewport 1280 800 >/dev/null
agent-browser wait 300 >/dev/null

echo "== SHEET-01"
check "seed values" "$(cells C1 C2 D1 E1 F1)" "C1=6 C2=20 D1=26 E1=10 F1=11 "
clickcell F1 >/dev/null; check "F1 raw" "$(fbar)" '=$A1+B$1+$C$1'
check "chart seed" "$(marks)" '"Alpha, Current: 6, source I2 | Alpha, Plan: 8, source J2 | Beta, Current: 20, source I3 | Beta, Plan: 18, source J3 | Total, Current: 26, source I4 | Total, Plan: 26, source J4"'
typecell A1 5
check "A1=5 cascade" "$(cells C1 D1 F1)" "C1=15 D1=35 F1=23 "
check "A1=5 chart" "$(agent-browser eval "Array.from(document.querySelectorAll('#chart-host .mark')).filter(m=>m.dataset.s==='0').map(m=>m.getAttribute('aria-label').split(': ')[1].split(',')[0]).join(',')")" '"15,20,35"'
agent-browser click "#btn-undo" >/dev/null
check "undo grid" "$(cells A1 C1 D1 F1)" "A1=2 C1=6 D1=26 F1=11 "
check "undo chart" "$(agent-browser eval "Array.from(document.querySelectorAll('#chart-host .mark')).filter(m=>m.dataset.s==='0').map(m=>m.getAttribute('aria-label').split(': ')[1].split(',')[0]).join(',')")" '"6,20,26"'
agent-browser hover '#chart-host .mark[data-s="0"][data-c="1"]' >/dev/null
check "tooltip" "$(agent-browser get text '#chart-tip' | paste -sd'|')" "Category: Beta|Series: Current|Value: 20|Source: I3"
agent-browser click '#chart-host .mark[data-s="0"][data-c="1"]' >/dev/null
check "bar selects source" "$(namebox)" "I3"

echo "== SHEET-02"
reset
clickcell F1 >/dev/null; agent-browser click "#btn-copy" >/dev/null; clickcell F2 >/dev/null; agent-browser click "#btn-paste" >/dev/null
check "F2 raw" "$(fbar)" '=$A2+B$1+$C$1'
check "F2 value" "$(cells F2)" "F2=13 "
agent-browser scrollintoview "#c-A1" >/dev/null; agent-browser drag "#c-A1" "#c-C2" >/dev/null; agent-browser press Control+c >/dev/null; clickcell A5 >/dev/null; agent-browser press Control+v >/dev/null
clickcell C5 >/dev/null; check "C5 raw" "$(fbar)" "=A5*B5"
clickcell C6 >/dev/null; check "C6 raw" "$(fbar)" "=A6*B6"
check "C5/C6 values" "$(cells C5 C6)" "C5=6 C6=20 "
agent-browser click "#btn-undo" >/dev/null
check "one undo clears rect, keeps F2" "$(cells A5 B5 C5 A6 B6 C6 F2)" "A5= B5= C5= A6= B6= C6= F2=13 "
agent-browser click "#btn-redo" >/dev/null
check "redo restores rect" "$(cells A5 C6)" "A5=2 C6=20 "
u0=$(agent-browser eval 'window.__studio.state.undo.length')
clickcell Y99 >/dev/null; agent-browser press Control+v >/dev/null
check "oversize paste rejected" "$(cells Y99 Z99 Y100 Z100)|$(agent-browser eval 'window.__studio.state.undo.length')" "Y99= Z99= Y100= Z100= |$u0"
typecell B10 "=A10"; clickcell B10 >/dev/null; agent-browser click "#btn-copy" >/dev/null; clickcell A10 >/dev/null; agent-browser click "#btn-paste" >/dev/null
check "A10 raw #REF!" "$(fbar)" "=#REF!"
check "A10 value" "$(cells A10)" "A10=#REF! "
agent-browser click "#btn-undo" >/dev/null; clickcell A10 >/dev/null
check "undo A10 blank" "$(fbar)|$(cells A10)" "|A10= "

echo "== SHEET-03"
reset
typecell A1 "=C1"
check "cycle cells" "$(cells A1 C1 D1 F1 I2 I4 C2)" "A1=#CYCLE! C1=#CYCLE! D1=#CYCLE! F1=#CYCLE! I2=#CYCLE! I4=#CYCLE! C2=20 "
check "chart reports errors" "$(agent-browser get text '#chart-notes' | grep -c 'error #CYCLE!')" "2"
typecell A1 2
check "cycle recovery" "$(cells A1 C1 D1 F1 I2 I4)" "A1=2 C1=6 D1=26 F1=11 I2=6 I4=26 "
typecell G1 "=IF(FALSE,G1,7)"; check "lazy branch" "$(cells G1)" "G1=7 "
clickcell G1 >/dev/null; agent-browser fill "#formula-input" "=IF(TRUE,G1,7)" >/dev/null; agent-browser press Enter >/dev/null
check "active self-ref" "$(cells G1)" "G1=#CYCLE! "
clickcell G1 >/dev/null; agent-browser fill "#formula-input" "=IF(FALSE,G1,7)" >/dev/null; agent-browser press Enter >/dev/null
check "back to 7" "$(cells G1)" "G1=7 "

echo "== SHEET-04"
reset
declare -a FORMS=('=2+3*4' '=(2+3)*4' '=SUM(A1:B2)' '=MIN(A1:B2)' '=MAX(A1:B2)' '=TRUE+2' '=IF(FALSE,1/0,9)' '=#REF!' '=IF(FALSE,#REF!,9)' '=1/0' '=AA1' '=NOPE(1)' '=SUM("text")' '=1+' '=(A2-B1)*C1/4')
declare -a WANTS=(14 20 14 2 5 3 9 '#REF!' 9 '#DIV/0!' '#REF!' '#NAME?' '#VALUE!' '#PARSE!' 1.5)
r=1; for f in "${FORMS[@]}"; do typecell "L$r" "$f"; r=$((r+1)); done
r=1; for f in "${FORMS[@]}"; do check "L$r $f" "$(agent-browser get text "#c-L$r")" "${WANTS[$((r-1))]}"; r=$((r+1)); done
typecell B2 "=1/0"; check "range error propagates" "$(cells L3 D1)" "L3=#DIV/0! D1=#DIV/0! "
typecell B2 5; check "range error recovers" "$(cells L3 D1)" "L3=14 D1=26 "
agent-browser download "#btn-export-json" "$ROOT/evidence/downloads/regress/sheet04.json" >/dev/null
check "export keeps #REF! formulas" "$(python3 -c "import json;d=json.load(open('evidence/downloads/regress/sheet04.json'));print(d['cells']['L8']['formula'],d['cells']['L9']['formula'])")" '=#REF! =IF(FALSE,#REF!,9)'
reset
agent-browser upload "#file-json" "$ROOT/evidence/downloads/regress/sheet04.json" >/dev/null; agent-browser wait 300 >/dev/null
clickcell L8 >/dev/null; check "import L8" "$(fbar)|$(cells L8)" "=#REF!|L8=#REF! "
clickcell L9 >/dev/null; check "import L9" "$(fbar)|$(cells L9)" "=IF(FALSE,#REF!,9)|L9=9 "

echo "== SHEET-05"
reset
agent-browser scrollintoview "#c-H1" >/dev/null; agent-browser drag "#c-H1" "#c-J4" >/dev/null; agent-browser click "#btn-new-chart" >/dev/null; agent-browser select "#chart-type" line >/dev/null
check "line chart created" "$(agent-browser eval "window.__studio.state.charts.map(c=>c.type+':'+c.range).join(',')")" '"column:H1:J4,line:H1:J4"'
typecell B2 7
check "Current [6,28,34]" "$(agent-browser eval "Array.from(document.querySelectorAll('#chart-host .mark')).filter(m=>m.dataset.s==='0').map(m=>m.getAttribute('aria-label').split(': ')[1].split(',')[0]).join(',')")" '"6,28,34"'
agent-browser fill "#chart-title" "Regression line" >/dev/null; agent-browser press Enter >/dev/null
agent-browser fill '#chart-colors input.hex[data-k="1"]' "#008300" >/dev/null; agent-browser press Enter >/dev/null
agent-browser download "#btn-export-svg" "$ROOT/evidence/downloads/regress/line.svg" >/dev/null
check "svg has title/labels/color" "$(for s in 'Regression line' '#008300' '>Beta<' '>Plan<' '>40<'; do grep -q -- "$s" evidence/downloads/regress/line.svg && echo -n Y; done)" "YYYYY"
check "svg well-formed" "$(python3 -c "import xml.dom.minidom as m;d=m.parse('evidence/downloads/regress/line.svg');print(len(d.getElementsByTagName('circle')))")" "6"
agent-browser download "#btn-export-png" "$ROOT/evidence/downloads/regress/line.png" >/dev/null
check "png file" "$(file -b evidence/downloads/regress/line.png | cut -d, -f1)" "PNG image data"
clickcell I3 >/dev/null; agent-browser press Delete >/dev/null
check "I3 omitted w/ reason" "$(agent-browser get text '#chart-notes' | grep -o 'Current · Beta (I3): blank cell')" "Current · Beta (I3): blank cell"
check "line gap (no L across Beta)" "$(agent-browser eval "document.querySelector('#chart-host path[stroke=\"#2a78d6\"]').getAttribute('d').includes('L194')")" "false"
agent-browser download "#btn-export-svg" "$ROOT/evidence/downloads/regress/line-gap.svg" >/dev/null
check "svg footnote on omission" "$(grep -c 'Omitted 1 point' evidence/downloads/regress/line-gap.svg)" "1"
agent-browser click "#btn-undo" >/dev/null
check "undo restores point" "$(cells I3)|$(agent-browser get text '#chart-notes' | grep -c 'nothing omitted')" "I3=28 |1"
agent-browser select "#chart-type" column >/dev/null; agent-browser select "#chart-type" line >/dev/null
check "type switch keeps edits" "$(cells B2 I3)|$(agent-browser get value '#chart-title')" "B2=7 I3=28 |Regression line"

echo "== SHEET-06"
reset
agent-browser download "#btn-export-json" "$ROOT/evidence/downloads/regress/seed.json" >/dev/null
typecell A1 99; agent-browser fill "#chart-title" "Mutated" >/dev/null; agent-browser press Enter >/dev/null
agent-browser upload "#file-json" "$ROOT/evidence/downloads/regress/seed.json" >/dev/null; agent-browser wait 300 >/dev/null
check "import restores" "$(cells A1 C1)|$(agent-browser get value '#chart-title')" "A1=2 C1=6 |Current vs Plan"
agent-browser click "#btn-undo" >/dev/null
check "undo import" "$(cells A1 C1)|$(agent-browser get value '#chart-title')" "A1=99 C1=297 |Mutated"
u0=$(agent-browser eval 'window.__studio.state.undo.length')
agent-browser upload "#file-json" "$ROOT/evidence/fixtures/bad-oob-cell.json" >/dev/null; agent-browser wait 250 >/dev/null
check "oob cell rejected" "$(cells A1)|$(agent-browser eval 'window.__studio.state.undo.length')" "A1=99 |$u0"
agent-browser upload "#file-json" "$ROOT/evidence/fixtures/bad-chart-range.json" >/dev/null; agent-browser wait 250 >/dev/null
check "bad chart range rejected" "$(agent-browser get value '#chart-title')|$(agent-browser eval 'window.__studio.state.undo.length')" "Mutated|$u0"
agent-browser click "#btn-import-text" >/dev/null; agent-browser fill "#import-text" "$(cat evidence/fixtures/spec-sample.csv)" >/dev/null; agent-browser click "#btn-import-text-csv" >/dev/null
check "csv A2 B2" "$(cells A2 B2)" "A2=alpha, beta B2=2 "
clickcell B2 >/dev/null; check "B2 numeric" "$(agent-browser get text '#insp-body' | sed -n 2p)" "B2 · Number"
clickcell A3 >/dev/null; check "A3 newline" "$(agent-browser eval "document.getElementById('formula-input').value")" '"line\nbreak"'
clickcell B3 >/dev/null; check "B3 literal" "$(fbar)|$(cells B3)" "'=1+1|B3==1+1 "
agent-browser download "#btn-export-csv" "$ROOT/evidence/downloads/regress/sample.csv" >/dev/null
check "csv export" "$(python3 -c "print(repr(open('evidence/downloads/regress/sample.csv',newline='').read()))")" "'label,value\r\n\"alpha, beta\",2\r\n\"line\nbreak\",=1+1\r\n'"
u0=$(agent-browser eval 'window.__studio.state.undo.length')
agent-browser click "#btn-import-text" >/dev/null; agent-browser fill "#import-text" "$(cat evidence/fixtures/bad-unterminated.csv)" >/dev/null; agent-browser click "#btn-import-text-csv" >/dev/null
check "unterminated rejected" "$(cells A1 A2)|$(agent-browser eval 'window.__studio.state.undo.length')" "A1=label A2=alpha, beta |$u0"
agent-browser click "#btn-import-cancel" >/dev/null
typecell D5 '<img src=x onerror="window.__pwned=1">'
check "html inert" "$(agent-browser eval "document.querySelectorAll('#grid img').length+':'+(!!window.__pwned)")" '"0:false"'

echo "== SHEET-07"
reset
agent-browser set viewport 390 844 >/dev/null; agent-browser wait 200 >/dev/null
check "no horizontal page scroll @390" "$(agent-browser eval 'document.documentElement.scrollWidth')" "390"
typecell A1 3; check "mobile edit" "$(cells C1)" "C1=9 "
agent-browser press Tab >/dev/null; agent-browser press Tab >/dev/null; check "Tab nav" "$(namebox)" "C2"
for id in formula-input btn-reset btn-import-json btn-import-csv btn-import-text btn-export-json btn-export-csv chart-title chart-type chart-range btn-export-svg btn-export-png btn-new-chart; do
  check "reachable $id" "$(agent-browser eval "(()=>{const b=document.getElementById('$id').getBoundingClientRect();return b.width>0&&b.left>=0&&b.right<=390})()")" "true"; done
agent-browser set viewport 1280 800 >/dev/null
clickcell B2 >/dev/null; agent-browser press 4 >/dev/null; agent-browser set viewport 390 844 >/dev/null; agent-browser keyboard type "2" >/dev/null; agent-browser set viewport 1280 800 >/dev/null; agent-browser press Enter >/dev/null
check "edit survives resize" "$(cells B2 C2)" "B2=42 C2=168 "
agent-browser reload >/dev/null; agent-browser wait 300 >/dev/null
check "reload -> seed" "$(cells A1 B2 C2)|$(agent-browser eval 'window.__studio.state.undo.length')" "A1=2 B2=5 C2=20 |0"
typecell A1 8; reset
check "reset clears history" "$(cells A1)|$(agent-browser is enabled '#btn-undo')|$(agent-browser is enabled '#btn-redo')" "A1=2 |false|false"
check "no storage" "$(agent-browser eval 'localStorage.length+sessionStorage.length+document.cookie.length')" "0"
check "no page errors" "$(agent-browser errors | wc -l)" "0"
check "only the document requested (data: URIs excluded)" "$(agent-browser network requests | grep -v -e 'index.html (Document)' -e ' GET data:' | grep -c .)" "0"

echo "== RESULT: $P passed, $F failed"
agent-browser close >/dev/null
