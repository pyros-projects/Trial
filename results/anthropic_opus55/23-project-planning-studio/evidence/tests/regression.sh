#!/usr/bin/env bash
# Dev-only end-to-end regression for Project Planning Studio, driven through agent-browser with real
# clicks, typing and mouse drags against the delivered index.html (file://). Prints PASS/FAIL lines.
set -u
cd "$(dirname "$0")/../.."
export AGENT_BROWSER_SESSION=pps-regress
source evidence/tests/ab-helpers.sh
PASS=0; FAIL=0
ok() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "PASS $1"; else FAIL=$((FAIL+1)); echo "FAIL $1"; echo "     got: $2"; echo "     exp: $3"; fi; }
ev() { agent-browser eval "$1" | sed 's/^"//; s/"$//; s/\\"/"/g'; }
iv() { ev "JSON.stringify(PPS.snapshot().intervals)"; }
settle() { agent-browser wait 150 >/dev/null; }
reset() { agent-browser click '#btnReset' >/dev/null; agent-browser click '#reset-confirm' >/dev/null; settle; }
SEEDIV='{"T1":[0,2],"T2":[2,5],"T3":[5,7],"T4":[7,8],"T5":[8,8]}'

agent-browser close >/dev/null 2>&1
agent-browser --download-path "$PWD/evidence/downloads" open "file://$PWD/index.html" >/dev/null
agent-browser set viewport 1280 800 >/dev/null; settle
ok "load: no page errors" "$(agent-browser errors | tr -d '\n')" ""

echo "== PLAN-01 seed across views"
ok "seed intervals" "$(iv)" "$SEEDIV"
ok "completion/date" "$(ev "PPS.snapshot().completion + ' ' + document.getElementById('stats').innerText.includes('offset 8 · 2026-09-17')")" "8 true"
ok "T2 table cell" "$(ev "document.querySelector('tr[data-id=T2] td.c-sched').innerText.replace(/\n/g,' | ')")" "2026-09-09 → 2026-09-11 | [2, 5) · boundary 2026-09-14"
mclick 'tr[data-id="T3"] td.c-id' >/dev/null
ok "select T3 (table) → gantt+lane+inspector" "$(ev "[...document.querySelectorAll('.g-label.selected')].map(e=>e.dataset.id)+'|'+document.querySelector('.lane-bar[data-id=T3] rect').getAttribute('stroke-width')+'|'+document.querySelector('#inspector .title').innerText.split('\n')[0]")" "T3|2.5|T3"
reset; mclick '.g-bar[data-id="T3"] .bar-rect' >/dev/null
ok "select T3 (gantt) → table" "$(ev "[...document.querySelectorAll('table.tasks tr.selected')].map(e=>e.dataset.id).join()")" "T3"
reset; mclick '.lane-bar[data-id="T3"] rect' >/dev/null
ok "select T3 (lane) → table+gantt" "$(ev "[...document.querySelectorAll('table.tasks tr.selected, .g-label.selected')].map(e=>e.dataset.id).join()")" "T3,T3"
ok "selection adds no history" "$(ev "PPS.snapshot().undo.length")" "0"
ok "R1 never over capacity" "$(ev "Math.max(...[...document.querySelectorAll('.lane-scroll[data-res=R1] .slot[data-res]')].map(g=>+g.getAttribute('aria-label').match(/: (\d+) of/)[1]))")" "1"
agent-browser click '#btnExport' >/dev/null; agent-browser download '#exp-csv' "$PWD/evidence/downloads/regress-seed.csv" >/dev/null; agent-browser press Escape >/dev/null
ok "CSV uses CRLF rows" "$(grep -c $'\r$' evidence/downloads/regress-seed.csv)" "6"
ok "CSV T2 row" "$(grep '^T2,' evidence/downloads/regress-seed.csv | tr -d '\r')" "T2,Build,R1,T1,3,2,,2,5,2026-09-09,2026-09-14,2026-09-11,2,2,0,yes"
ok "CSV T5 row (milestone, empty last day)" "$(grep '^T5,' evidence/downloads/regress-seed.csv | tr -d '\r')" "T5,Launch,,T4,0,5,,8,8,2026-09-17,2026-09-17,,6,6,0,yes"

echo "== PLAN-02 critical path and capacity"
ok "dep-only completion + floats" "$(ev "PPS.snapshot().dependencyOnlyCompletion + ' ' + JSON.stringify(PPS.snapshot().float)")" '6 {"T1":0,"T2":0,"T3":1,"T4":0,"T5":0}'
ok "critical edges drawn red" "$(ev "[...document.querySelectorAll('path[data-edge]')].filter(p=>p.getAttribute('stroke')==='#d9363e').map(p=>p.dataset.edge).sort().join()")" "T1>T2,T2>T4,T4>T5"
agent-browser fill '#rc-R1' 2 >/dev/null; agent-browser press Enter >/dev/null; settle
ok "R1 cap 2 intervals" "$(iv)" '{"T1":[0,2],"T2":[2,5],"T3":[2,4],"T4":[5,6],"T5":[6,6]}'
ok "actual 6, dep-only 6" "$(ev "PPS.snapshot().completion+' '+PPS.snapshot().dependencyOnlyCompletion")" "6 6"
agent-browser click '#btnUndo' >/dev/null; settle
ok "one undo restores capacity + intervals" "$(ev "PPS.snapshot().source.resources[0].capacity")|$(iv)" "1|$SEEDIV"

echo "== PLAN-03 propagation"
reset; agent-browser fill 'input[data-key="dur:T1"]' 3 >/dev/null; agent-browser press Tab >/dev/null; settle
ok "T1=3 intervals" "$(iv)" '{"T1":[0,3],"T2":[3,6],"T3":[6,8],"T4":[8,9],"T5":[9,9]}'
ok "dep-only 7" "$(ev "PPS.snapshot().dependencyOnlyCompletion")" "7"
ok "focus continued to next field" "$(ev "document.activeElement.getAttribute('data-key')")" "prio:T1"
agent-browser click '#btnUndo' >/dev/null; settle
ok "undo: source+views" "$(ev "PPS.snapshot().source.tasks[0].duration")|$(iv)|$(agent-browser eval --stdin < evidence/tests/consistency.js | grep -c '"ok": true')" "2|$SEEDIV|1"
agent-browser click '#btnRedo' >/dev/null; settle
ok "redo: source+views" "$(ev "PPS.snapshot().source.tasks[0].duration")|$(iv)|$(agent-browser eval --stdin < evidence/tests/consistency.js | grep -c '"ok": true')" '3|{"T1":[0,3],"T2":[3,6],"T3":[6,8],"T4":[8,9],"T5":[9,9]}|1'

echo "== PLAN-04 drag, gap filling, calendar"
reset; read -r X Y <<<"$(center '.g-bar[data-id="T2"] .bar-rect')"; PX=$(ev "PPS.snapshot().pxPerDay")
agent-browser mouse move $X $Y >/dev/null; agent-browser mouse down left >/dev/null
for f in 1 2 3; do agent-browser mouse move $((X + f*PX)) $Y >/dev/null; done
ok "drag preview shows requested constraint" "$(ev "document.getElementById('dragTip').innerText.split('\n')[0]")" "T2: not before offset 5 · Mon 2026-09-14"
ok "no commit during drag" "$(ev "PPS.snapshot().undo.length")" "0"
agent-browser mouse up left >/dev/null; settle
ok "drag result" "$(iv)" '{"T1":[0,2],"T2":[5,8],"T3":[2,4],"T4":[8,9],"T5":[9,9]}'
ok "stored constraint + one history entry" "$(ev "PPS.snapshot().source.tasks[1].notBefore+' '+PPS.snapshot().undo.length")" "2026-09-14 1"
mclick '.g-label[data-id="T2"]' >/dev/null
ok "inspector explains not-before bound" "$(ev "[...document.querySelectorAll('#inspector .explain li')][2].innerText.replace(/\n/g,' | ')")" "Not-before bound | offset 5 — 2026-09-14"
agent-browser click '#btnUndo' >/dev/null; settle
ok "undo restores seed" "$(iv)" "$SEEDIV"
agent-browser focus 'input[data-key="nb:T2"]' >/dev/null; agent-browser keyboard type "2026-09-12" >/dev/null; agent-browser press Enter >/dev/null; settle
ok "Saturday via keyboard → Monday" "$(ev "PPS.snapshot().source.tasks[1].notBefore+' '+document.getElementById('msgBar').innerText.includes('normalized forward to Mon 2026-09-14')")" "2026-09-14 true"
ok "same intervals as drag" "$(iv)" '{"T1":[0,2],"T2":[5,8],"T3":[2,4],"T4":[8,9],"T5":[9,9]}'
B=$(state); read -r X Y <<<"$(center '.g-bar[data-id="T4"] .bar-rect')"
agent-browser mouse move $X $Y >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse move $((X+3*PX)) $Y >/dev/null
agent-browser press Escape >/dev/null; agent-browser mouse up left >/dev/null; settle
ok "Escape cancels drag: no state/history change" "$(state)" "$B"
mclick '.g-label[data-id="T2"]' >/dev/null; agent-browser click '#i-clear' >/dev/null; settle
ok "Clear constraint" "$(ev "String(PPS.snapshot().source.tasks[1].notBefore)")|$(iv)" "null|$SEEDIV"

echo "== PLAN-05 validation and safe deletion"
reset; B=$(state)
for pair in 'input[data-key="pred:T1"]|T5' 'input[data-key="pred:T1"]|T99' '#rc-R1|0' '#rc-R1|5' '#rc-R1|two' 'input[data-key="nb:T1"]|2026-02-30' 'input[data-key="dur:T1"]|1000000000' 'input[data-key="prio:T1"]|10000' 'input[data-key="nb:T1"]|2037-01-05'; do
  sel="${pair%%|*}"; val="${pair#*|}"; agent-browser fill "$sel" "$val" >/dev/null; agent-browser press Enter >/dev/null; settle
  ok "reject $val → unchanged" "$(state)" "$B"
done
ok "horizon message names limit" "$(ev "document.getElementById('msgBar').innerText.includes('2600-working-day horizon')")" "true"
mclick 'button[data-key="del:T1"]' >/dev/null; agent-browser click '#del-cancel' >/dev/null; settle
ok "cancel delete → unchanged" "$(state)" "$B"
mclick 'button[data-key="del:T1"]' >/dev/null; agent-browser click '#del-confirm' >/dev/null; settle
ok "delete with edge removal" "$(ev "PPS.snapshot().source.tasks.map(t=>t.id+':'+t.predecessors.join('+')).join(' ')")" "T2: T3: T4:T2+T3 T5:T4"
agent-browser click '#btnUndo' >/dev/null; settle
ok "undo restores exact task + edges" "$(ev "JSON.stringify(PPS.snapshot().source)")" "$(python3 -c "import json;print(json.dumps(json.load(open('evidence/downloads/seed.json')),separators=(',',':'),ensure_ascii=False))")"
mclick 'button[data-key="rdel:R1"]' >/dev/null; settle
ok "reject in-use resource delete" "$(ev "PPS.snapshot().source.resources.length+' '+document.getElementById('msgBar').innerText.includes('Cannot delete resource R1')")" "2 true"
agent-browser click '#btnAddTask' >/dev/null; agent-browser fill '#nt-id' U >/dev/null; agent-browser fill '#nt-dur' 1 >/dev/null; agent-browser fill '#nt-prio' 0 >/dev/null; agent-browser click '#nt-submit' >/dev/null; settle
agent-browser click '#btnAddMilestone' >/dev/null; agent-browser fill '#nt-id' M >/dev/null; agent-browser fill '#nt-prio' 0 >/dev/null; agent-browser fill '#nt-pred' U >/dev/null; agent-browser click '#nt-submit' >/dev/null; settle
ok "U and M" "$(iv)" '{"T1":[0,2],"T2":[2,5],"T3":[5,7],"T4":[7,8],"T5":[8,8],"U":[0,1],"M":[1,1]}'

echo "== PLAN-06 determinism and files"
reset; agent-browser fill 'input[data-key="prio:T3"]' 2 >/dev/null; agent-browser press Enter >/dev/null; settle
agent-browser click '#btnExport' >/dev/null; agent-browser download '#exp-json' "$PWD/evidence/downloads/regress-tie.json" >/dev/null; agent-browser press Escape >/dev/null
node -e 'const f="evidence/downloads/regress-tie.json",fs=require("fs");const d=JSON.parse(fs.readFileSync(f));d.tasks.reverse();fs.writeFileSync("evidence/downloads/regress-tie-reversed.json",JSON.stringify(d))'
reset; agent-browser click '#btnImport' >/dev/null; agent-browser upload '#imp-file' "$PWD/evidence/downloads/regress-tie-reversed.json" >/dev/null; settle
ok "reversed tie import keeps seed intervals" "$(ev "JSON.stringify(Object.fromEntries(Object.entries(PPS.snapshot().intervals).sort()))")" "$SEEDIV"
agent-browser fill 'input[data-key="dur:T4"]' 2 >/dev/null; agent-browser press Enter >/dev/null; settle; PRE=$(state)
agent-browser click '#btnImport' >/dev/null; agent-browser fill '#imp-text' "$(cat evidence/downloads/seed.json)" >/dev/null; agent-browser click '#imp-submit' >/dev/null; settle
ok "import replaces plan" "$(iv)" "$SEEDIV"
agent-browser click '#btnUndo' >/dev/null; settle
noredo() { python3 -c 'import json,sys; d=json.loads(json.loads(sys.argv[1])); d.pop("r"); print(json.dumps(d, sort_keys=True))' "$1"; }
ok "one undo restores pre-import edit" "$(noredo "$(state)")" "$(noredo "$PRE")"
B=$(state); agent-browser click '#btnImport' >/dev/null; agent-browser fill '#imp-text' "$(cat evidence/tests/fixtures/dup-id.json)" >/dev/null; agent-browser click '#imp-submit' >/dev/null; settle; agent-browser press Escape >/dev/null
ok "duplicate-ID import rejected, unchanged" "$(state)" "$B"
agent-browser click '#btnImport' >/dev/null; agent-browser upload '#imp-file' "$PWD/evidence/tests/fixtures/hostile-names-and-cache.json" >/dev/null; settle
ok "HTML-like names inert, cache ignored" "$(ev "document.querySelectorAll('img').length+' '+(window.__pwned===1)+' '+JSON.stringify(PPS.snapshot().intervals)")" "0 false $SEEDIV"

echo "== PLAN-07 narrow viewport + reload"
agent-browser set viewport 390 844 >/dev/null; settle
ok "no horizontal page scroll at 390" "$(ev "document.documentElement.scrollWidth")" "390"
mclick '.tabs [data-tab="gantt"]' >/dev/null; read -r X Y <<<"$(center '.g-bar[data-id="T2"] .bar-rect')"
agent-browser mouse move $X $Y >/dev/null; agent-browser mouse down left >/dev/null; for f in 1 2 3; do agent-browser mouse move $((X + f*PX)) $Y >/dev/null; done; agent-browser mouse up left >/dev/null; settle
ok "mobile drag commits" "$(ev "PPS.snapshot().intervals.T2.join()")" "5,8"
ok "Undo reachable (sticky) after scroll" "$(ev "(()=>{window.scrollTo(0,9999);const r=document.getElementById('btnUndo').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight})()")" "true"
mclick '#btnUndo' >/dev/null; settle
ok "mobile undo" "$(ev "PPS.snapshot().intervals.T2.join()")" "2,5"
agent-browser set viewport 1280 800 >/dev/null; settle
agent-browser reload >/dev/null; settle
ok "reload returns to seed, empty history" "$(iv)|$(ev "PPS.snapshot().undo.length+PPS.snapshot().redo.length")" "$SEEDIV|0"
ok "no page errors at end" "$(agent-browser errors | tr -d '\n')" ""
agent-browser close >/dev/null 2>&1
echo "== $PASS passed, $FAIL failed"
