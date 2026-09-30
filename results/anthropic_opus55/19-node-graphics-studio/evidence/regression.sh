#!/usr/bin/env bash
# Compact end-to-end regression for Node Studio (index.html), driven through agent-browser.
# Uses real pointer/keyboard input for editing flows; reads live state via the read-only window.NGS hook.
# Usage: bash evidence/regression.sh   (from the project directory)
set -u
cd "$(dirname "$0")/.."
ROOT=$PWD
export AGENT_BROWSER_DOWNLOAD_PATH="$ROOT/evidence/downloads"
AB=agent-browser
PASS=0; FAIL=0
log() { echo "$*"; }
check() { # check "name" "js-expression-returning-true"
  local r; r=$($AB eval "(()=>{try{return !!($2)}catch(e){return 'ERR '+e.message}})()" 2>&1 | tr -d '"')
  if [ "$r" = "true" ]; then PASS=$((PASS+1)); log "PASS  $1"; else FAIL=$((FAIL+1)); log "FAIL  $1  -> $r"; fi
}
js() { $AB eval "$1" | tr -d '"'; }
drag() { local x1=$1 y1=$2 x2=$3 y2=$4 n=${5:-10}; $AB mouse move $x1 $y1 >/dev/null; $AB mouse down left >/dev/null; for i in $(seq 1 $n); do $AB mouse move $(( x1 + (x2-x1)*i/n )) $(( y1 + (y2-y1)*i/n )) >/dev/null; done; $AB mouse up left >/dev/null; }
port() { js "(()=>{const p=NGS.port('$1','$2','$3'); return p? Math.round(p.x)+' '+Math.round(p.y) : 'none'})()"; }
click_at() { $AB mouse move $1 $2 >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; }

log "== Node Studio regression $(date -Iseconds)"
$AB close --all >/dev/null 2>&1; sleep 1
$AB open "file://$ROOT/index.html" >/dev/null; $AB set viewport 1280 800 >/dev/null
$AB eval "localStorage.clear(); location.reload(); 1" >/dev/null; sleep 5
ERRS=0
install_errs() { js "(()=>{window.__errs=[]; addEventListener('error',e=>__errs.push(String(e.message))); addEventListener('unhandledrejection',e=>__errs.push(String(e.reason))); return 1})()" >/dev/null; }
collect_errs() { local n; n=$(js "(window.__errs||[]).length"); ERRS=$((ERRS + ${n:-0})); [ "${n:-0}" != "0" ] && js "JSON.stringify(window.__errs)"; }
install_errs

log "-- startup"
check "default graph is the animated Neon Tunnel" "NGS.stats().name==='Neon Tunnel' && NGS.stats().playing && NGS.stats().nodes>=15"
check "default graph compiles and renders a non-black image" "NGS.stats().compileErr===null && NGS.imageHash()!==0"
check "HUD shows fps/nodes/edges/dirty/res/frame/selection/status/autosave" "/fps/.test(NGS.hud()) && /nodes/.test(NGS.hud()) && /edges/.test(NGS.hud()) && /dirty/.test(NGS.hud()) && /res/.test(NGS.hud()) && /f\d+\//.test(NGS.hud()) && /sel/.test(NGS.hud()) && /compiled/.test(NGS.hud()) && /save/.test(NGS.hud())"
F1=$(js "NGS.stats().frame"); sleep 1; check "time advances while playing" "NGS.stats().frame!==$F1"

log "-- presets"
for p in $(js "NGS.presets().join(' ')"); do
  $AB select "#presetSelect" "$p" >/dev/null; sleep 2.2
  check "preset $p loads, compiles, renders" "NGS.stats().errors.length===0 && NGS.stats().compileErr===null && NGS.imageHash()!==null"
done
check "at least 8 presets" "NGS.presets().length>=8"

log "-- build a graph from scratch (Tab quick-add + drag-to-connect)"
$AB press Control+k >/dev/null; sleep 0.3; $AB keyboard type "new empty" >/dev/null; $AB press Enter >/dev/null; sleep 0.8
check "empty graph + empty state" "NGS.stats().nodes===0 && !document.getElementById('graphEmpty').hidden"
add() { $AB mouse move $1 $2 >/dev/null; $AB press Tab >/dev/null; sleep 0.3; $AB keyboard type "$3" >/dev/null; sleep 0.3; $AB press Enter >/dev/null; sleep 0.5; }
$AB click "#gZoomOut" >/dev/null; $AB click "#gZoomOut" >/dev/null; sleep 0.3
add 215 200 "Coordinates"; add 375 200 "Voronoi"; add 535 200 "Color Ramp"; add 695 200 "Output"
UV=$(js "NGS.findNodes('uv')[0]"); VO=$(js "NGS.findNodes('voronoi')[0]"); RP=$(js "NGS.findNodes('ramp')[0]"); OU=$(js "NGS.findNodes('output')[0]")
$AB press Escape >/dev/null; $AB press f >/dev/null; sleep 0.5
read a b <<< "$(port $UV out uv)"; read c d <<< "$(port $VO in p)"; drag $a $b $c $d
read a b <<< "$(port $VO out f1)"; read c d <<< "$(port $RP in t)"; drag $a $b $c $d
read a b <<< "$(port $RP out out)"; read c d <<< "$(port $OU in color)"; drag $a $b $c $d
sleep 1.2
check "3 links created by dragging" "NGS.stats().links===3 && NGS.stats().compileErr===null"
H1=$(js "NGS.imageHash()")
check "graph renders" "NGS.imageHash()!==0"

log "-- parameter edit via node scrubber changes the image"
S=$(js "(()=>{const el=[...document.querySelectorAll('.scrub')].find(s=>s.dataset.nid==='$VO'&&s.dataset.pid==='scale');const r=el.getBoundingClientRect();return Math.round(r.left+15)+' '+Math.round(r.top+r.height/2)})()")
read sx sy <<< "$S"; drag $sx $sy $((sx+50)) $sy 8; sleep 1
check "voronoi scale changed by scrub" "NGS.node('$VO').params.scale!==6"
check "preview image changed" "NGS.imageHash()!==$H1"

log "-- rejections"
read a b <<< "$(port $RP out out)"; read c d <<< "$(port $VO in p)"; drag $a $b $c $d; sleep 0.4
check "color->coords rejected, graph unchanged" "NGS.stats().links===3 && /coordinates/i.test(NGS.stats().lastReject.reason)"
read a b <<< "$(port $RP out alpha)"; read c d <<< "$(port $VO in evolve)"; drag $a $b $c $d; sleep 0.4
check "cycle rejected, graph unchanged" "NGS.stats().links===3 && /cycle/i.test(NGS.stats().lastReject.reason)"

log "-- disconnect / undo / redo"
H2=$(js "NGS.imageHash()")
read a b <<< "$(port $OU in color)"; drag $a $b $((a-150)) $((b+120)); sleep 0.8
check "disconnect by dragging input away" "NGS.stats().links===2"
$AB press Control+z >/dev/null; sleep 0.8
check "undo restores link and identical image" "NGS.stats().links===3 && NGS.imageHash()===$H2"
$AB press Control+Shift+z >/dev/null; sleep 0.6; check "redo re-applies" "NGS.stats().links===2"
$AB press Control+z >/dev/null; sleep 0.6

log "-- selection, copy/paste, delete"
E=$(js "(()=>{for(let y=600;y>100;y-=20)for(let x=220;x<760;x+=20){const el=document.elementFromPoint(x,y); if(el&&el.id==='graphView') return x+' '+y;} return '300 600'})()"); read ex ey <<< "$E"
click_at $ex $ey; $AB press Control+a >/dev/null; sleep 0.2
check "select all" "NGS.stats().selected.length===4"
$AB press Control+c >/dev/null; $AB mouse move $ex $ey >/dev/null; $AB press Control+v >/dev/null; sleep 0.8
check "paste duplicates 3 nodes (single Output kept)" "NGS.stats().nodes===7 && NGS.stats().links===5"
$AB press Delete >/dev/null; sleep 0.6
check "delete pasted selection" "NGS.stats().nodes===4 && NGS.stats().links===3"

log "-- animation: keyframes through the inspector"
$AB press Control+k >/dev/null; $AB keyboard type "go to Voronoi" >/dev/null; $AB press Enter >/dev/null; sleep 0.4
$AB press Space >/dev/null; sleep 0.2; $AB press Home >/dev/null; sleep 0.2
$AB scrollintoview ".prm[data-pid=jitter] .kf" >/dev/null; $AB click ".prm[data-pid=jitter] .kf" >/dev/null; sleep 0.3
$AB eval "timeline.seek(60); 1" >/dev/null; sleep 0.3
$AB scrollintoview ".prm[data-pid=jitter] input.num" >/dev/null; $AB fill ".prm[data-pid=jitter] input.num" "0.1" >/dev/null; $AB press Enter >/dev/null; sleep 0.6
check "two keyframes on jitter" "NGS.graph().timeline.tracks['$VO/jitter'].length===2"
$AB eval "timeline.seek(0); 1" >/dev/null; sleep 1; HA=$(js "NGS.imageHash()")
$AB eval "timeline.seek(60); 1" >/dev/null; sleep 1
check "animated parameter changes the image over time" "NGS.imageHash()!==$HA"

log "-- diagnostics views"
for v in 1 4 5 6 8 9 10 11 12; do $AB select "#pvView" "$v" >/dev/null; sleep 0.7; check "diagnostic view $v active without errors" "NGS.stats().view===$v && NGS.stats().compileErr===null"; done
$AB select "#pvView" "0" >/dev/null

log "-- save / load / autosave"
$AB press Control+s >/dev/null; sleep 0.3; $AB fill ".modal input.inp" "Regression graph" >/dev/null; $AB press Enter >/dev/null; sleep 0.5
check "named local project saved" "Object.keys(JSON.parse(localStorage.getItem('ngs.projects.v1'))).includes('Regression graph')"
G=$(js "JSON.stringify(NGS.graph().graph.nodes.map(n=>[n.id,n.type,n.params]))" | md5sum | cut -c1-10)
collect_errs; $AB eval "location.reload(); 1" >/dev/null; sleep 4; install_errs
G2=$(js "JSON.stringify(NGS.graph().graph.nodes.map(n=>[n.id,n.type,n.params]))" | md5sum | cut -c1-10)
if [ "$G" = "$G2" ]; then PASS=$((PASS+1)); log "PASS  autosave restores identical graph after reload"; else FAIL=$((FAIL+1)); log "FAIL  autosave restore ($G vs $G2)"; fi

log "-- exports"
rm -f "$ROOT/evidence/downloads/Regression_graph"*
$AB press Control+e >/dev/null; sleep 0.4; $AB fill "input[aria-label='Export width']" "640" >/dev/null; $AB click "#exportGo" >/dev/null; sleep 3; $AB press Escape >/dev/null
check "PNG export reported" "NGS.stats().lastExport && NGS.stats().lastExport.kind==='png' && NGS.stats().lastExport.w===640"
$AB click "#btnExport" >/dev/null; sleep 0.3; $AB find role menuitem click --name "Project JSON" >/dev/null 2>&1; sleep 1
ls "$ROOT/evidence/downloads/" | grep -q "Regression_graph_640x640" && { PASS=$((PASS+1)); log "PASS  PNG file on disk"; } || { FAIL=$((FAIL+1)); log "FAIL  PNG file missing"; }
ls "$ROOT/evidence/downloads/" | grep -q "Regression_graph.nodestudio.json" && { PASS=$((PASS+1)); log "PASS  JSON file on disk"; } || { FAIL=$((FAIL+1)); log "FAIL  JSON file missing"; }
python3 -c "import json,sys; d=json.load(open(sys.argv[1])); assert d['format']=='node-studio' and len(d['graph']['nodes'])==4" "$ROOT/evidence/downloads/Regression_graph.nodestudio.json" && { PASS=$((PASS+1)); log "PASS  exported JSON validates"; } || { FAIL=$((FAIL+1)); log "FAIL  exported JSON"; }

log "-- share link (#g=) opens the graph"
$AB click "#btnExport" >/dev/null; sleep 0.3; $AB find role menuitem click --name "Share code…" >/dev/null 2>&1; sleep 1.2
CODE=$(js "document.querySelector('textarea[aria-label=\"Share code\"]').value"); $AB press Escape >/dev/null
$AB eval "localStorage.clear(); 1" >/dev/null
collect_errs; $AB open "file://$ROOT/index.html#g=$CODE" >/dev/null; sleep 4; install_errs
check "share link loads the same graph" "NGS.stats().name==='Regression graph' && NGS.stats().nodes===4 && NGS.stats().links===3"

log "-- narrow viewport"
$AB set viewport 390 844 >/dev/null; sleep 1.5
check "no horizontal overflow at 390px" "document.documentElement.scrollWidth<=390"
check "mobile tabs visible, menu reachable" "getComputedStyle(document.getElementById('mobileTabs')).display!=='none' && document.getElementById('btnMenu').getBoundingClientRect().right<=390"
$AB click "#mobileTabs button[data-tab=inspector]" >/dev/null; sleep 0.3; check "inspector tab shows" "getComputedStyle(document.getElementById('inspectorPanel')).display!=='none'"
$AB click "#mobileTabs button[data-tab=graph]" >/dev/null; sleep 0.3
$AB set viewport 1280 800 >/dev/null; sleep 1

log "-- runtime errors"
collect_errs
if [ "$ERRS" = "0" ]; then PASS=$((PASS+1)); log "PASS  no uncaught errors across all page loads (in-page collector)"; else FAIL=$((FAIL+1)); log "FAIL  $ERRS uncaught errors"; fi
BE=$($AB errors 2>&1 | grep -c "✗" || true); if [ "$BE" = "0" ]; then PASS=$((PASS+1)); log "PASS  agent-browser page-error buffer empty (fresh session)"; else FAIL=$((FAIL+1)); log "FAIL  agent-browser reports $BE page errors"; fi
log "== RESULT: $PASS passed, $FAIL failed"
