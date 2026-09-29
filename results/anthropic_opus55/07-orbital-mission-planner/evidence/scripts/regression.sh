#!/usr/bin/env bash
# Compact end-to-end regression for index.html using agent-browser (real Chromium, real keyboard/mouse input).
# Opens the delivered file directly via file://, drives the main workflow and prints PASS/FAIL per check.
# Usage: bash evidence/scripts/regression.sh   (run from the project directory)
set -u
cd "$(dirname "$0")/../.."
ROOT="$PWD"; OUT="$ROOT/evidence/logs/regression-$(date +%H%M%S).log"; SHOTS="$ROOT/evidence/screenshots"
AB="agent-browser --session orbit-reg"
PASS=0; FAIL=0
log() { echo "$*" | tee -a "$OUT"; }
ok() { if [ "$1" = "true" ]; then PASS=$((PASS+1)); log "PASS  $2"; else FAIL=$((FAIL+1)); log "FAIL  $2   ($3)"; fi; }
js() { $AB eval "$1" | sed 's/^"//; s/"$//; s/\\"/"/g'; }
jq_() { python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(eval(sys.argv[2], {}, {'d': d}))" "$1" "$2"; }

ERRCAP="$(mktemp)"; cat > "$ERRCAP" <<'EOF'
window.__errs=[];window.addEventListener('error',e=>window.__errs.push(e.message+' @'+e.lineno));window.addEventListener('unhandledrejection',e=>window.__errs.push('rej '+e.reason));
EOF
$AB close >/dev/null 2>&1
$AB --init-script "$ERRCAP" open "about:blank" >/dev/null
$AB set viewport 1280 800 >/dev/null
$AB network requests --clear >/dev/null 2>&1
$AB open "file://$ROOT/index.html" >/dev/null
$AB wait 1500 >/dev/null
log "== load (direct file://)"
R=$(js "JSON.stringify({errs:window.__errs, t:OrbitLab.sim.s.t, paused:OrbitLab.ui.paused, fps:+document.getElementById('hFps').textContent})")
ok "$(jq_ "$R" "str(len(d['errs'])==0).lower()")" "no uncaught errors on load" "$R"
ok "$(jq_ "$R" "str(d['t']>0 and not d['paused']).lower()")" "default system is running on load" "$R"
NREQ=$($AB network requests 2>&1 | grep -c " GET ")
NEXT=$($AB network requests 2>&1 | grep " GET " | grep -vc "file://")
ok "$([ "$NEXT" = "0" ] && echo true || echo false)" "no non-file network requests ($NREQ request(s) total)" "external=$NEXT"

log "== time controls (keyboard)"
$AB press Space >/dev/null; sleep 0.3
A=$(js "JSON.stringify({t:OrbitLab.sim.s.t,p:OrbitLab.ui.paused})"); sleep 0.6
B=$(js "JSON.stringify({t:OrbitLab.sim.s.t,p:OrbitLab.ui.paused})")
ok "$(python3 -c "import json;a=json.loads('$A');b=json.loads('$B');print(str(a['p'] and a['t']==b['t']).lower())")" "Space pauses (time frozen)" "$A $B"
$AB press s >/dev/null; sleep 0.2
C=$(js "JSON.stringify({t:OrbitLab.sim.s.t,dt:OrbitLab.sim.P.dt})")
ok "$(python3 -c "import json;b=json.loads('$B');c=json.loads('$C');print(str(abs(c['t']-b['t']-c['dt'])<1e-9).lower())")" "S single-steps exactly one dt" "$B -> $C"
$AB press . >/dev/null; $AB press . >/dev/null; $AB press . >/dev/null
W=$(js "JSON.stringify({r:10**OrbitLab.ui.rateLog, lbl:document.getElementById('warpLbl').textContent})")
ok "$(jq_ "$W" "str(abs(d['r']-100)<1).lower()")" "'.' x3 raises warp 10 -> 100 h/s (label $(jq_ "$W" "d['lbl']"))" "$W"
$AB press , >/dev/null; $AB press , >/dev/null; $AB press , >/dev/null

log "== maneuver node: click forecast, drag prograde handle, execute"
$AB find role button click --name "Reset scenario" >/dev/null; sleep 0.3
P=$(js "(()=>{const u=OrbitLab.ui,now=OrbitLab.sim.s.t;let b=null;for(const p of u.pathScreen){if(!b||Math.abs(p.t-now-70)<Math.abs(b.t-now-70))b=p;}return Math.round(b.x)+' '+Math.round(b.y);})()")
set -- $P
N0=$(js "String(OrbitLab.sim.nodes.length)")
$AB mouse move "$1" "$2" >/dev/null; $AB mouse down left >/dev/null; $AB mouse up left >/dev/null; sleep 0.4
N1=$(js "String(OrbitLab.sim.nodes.length)")
ok "$([ "$N1" = "$((N0+1))" ] && echo true || echo false)" "clicking the forecast adds a node ($N0 -> $N1)" "at $P"
BEFORE=$(js "(()=>{const L=OrbitLab,nd=L.sim.nodes.find(n=>n.id===L.ui.selNode),i=L.pred.nodeInfo.get(nd.id),ci=L.sim.idx.get(nd.craft),s=L.pred.samples[L.pred.samples.length-1];return JSON.stringify({ra:i.after.ra,end:[s.d[ci],s.d[s.n+ci]]})})()")
H=$(js "(()=>{const h=OrbitLab.ui.handleHits.find(q=>q.comp==='pro'&&q.sign===1);return [Math.round(h.x),Math.round(h.y),h.ux,h.uy].join(' ')})()")
set -- $H
$AB mouse move "$1" "$2" >/dev/null; $AB mouse down left >/dev/null
for f in 0.25 0.5 0.75 1; do $AB mouse move $(python3 -c "print(round($1+$3*70*$f), round($2+$4*70*$f))") >/dev/null; done
$AB mouse up left >/dev/null; sleep 0.3
AFTER=$(js "(()=>{const L=OrbitLab,nd=L.sim.nodes.find(n=>n.id===L.ui.selNode),i=L.pred.nodeInfo.get(nd.id),ci=L.sim.idx.get(nd.craft),s=L.pred.samples[L.pred.samples.length-1];return JSON.stringify({pro:nd.pro,ra:i.after.ra,end:[s.d[ci],s.d[s.n+ci]]})})()")
ok "$(python3 -c "import json;a=json.loads('$BEFORE');b=json.loads('$AFTER');print(str(b['pro']>0.02 and b['ra']>a['ra']+1 and abs(b['end'][0]-a['end'][0])+abs(b['end'][1]-a['end'][1])>1).lower())")" "dragging P+ raises Δv and reshapes the forecast before the burn" "$BEFORE -> $AFTER"
$AB screenshot "$SHOTS/reg-node-planned.png" >/dev/null
js "(()=>{const L=OrbitLab,ci=L.sim.idx.get(L.sim.idByName('Pathfinder'));window.__rec=L.pred.samples.map(s=>({t:s.t,x:s.d[ci],y:s.d[s.n+ci]}));return 'ok'})()" >/dev/null
$AB press Space >/dev/null
for k in 1 2 3; do $AB press . >/dev/null; done
$AB wait --fn "OrbitLab.sim.s.t>90" --timeout 20000 >/dev/null; $AB press Space >/dev/null; sleep 0.2
for k in 1 2 3; do $AB press , >/dev/null; done
X=$(js "(()=>{const sim=OrbitLab.sim,ci=sim.idx.get(sim.idByName('Pathfinder'));let n=0,mx=0;for(let k=sim.histHead;k<sim.hist.length;k++){const h=sim.hist[k];const r=window.__rec.find(r=>Math.abs(r.t-h.t)<1e-7);if(!r)continue;n++;mx=Math.max(mx,Math.hypot(h.d[ci]-r.x,h.d[h.n+ci]-r.y));}return JSON.stringify({n,mx,done:sim.nodes.map(q=>q.done)})})()")
ok "$(jq_ "$X" "str(d['n']>20 and d['mx']<1e-9 and all(d['done'])).lower()")" "both burns executed; actual path == forecast (max diff $(jq_ "$X" "d['mx']"), $(jq_ "$X" "d['n']") samples)" "$X"
$AB screenshot "$SHOTS/reg-burns-executed.png" >/dev/null

log "== reference frames"
for FR in inertial "center:G" "rot:G:S"; do
  V=$(js "(()=>{const s=OrbitLab.sim;return '$FR'.replace('G',s.idByName('Gaia')).replace('S',s.idByName('Selene'));})()")
  $AB select "#frameSel" "$V" >/dev/null; sleep 0.3
  Q=$(js "(()=>{const s=OrbitLab.snapshot(),g=s.objects.find(o=>o.name==='Gaia'),m=s.objects.find(o=>o.name==='Selene');return JSON.stringify({frame:s.frame,g:[g.fx,g.fy,g.fvx,g.fvy],m:[m.fx,m.fy,m.fvx,m.fvy]})})()")
  case "$FR" in
    inertial) ok "$(jq_ "$Q" "str(d['frame'].startswith('Inertial') and abs(d['g'][3])>1).lower()")" "inertial frame: Gaia moves at heliocentric speed" "$Q";;
    center:G) ok "$(jq_ "$Q" "str(max(map(abs,d['g']))<1e-12).lower()")" "Gaia-centred frame: Gaia at rest at origin" "$Q";;
    rot:G:S) ok "$(jq_ "$Q" "str(abs(d['m'][1])<1e-9 and d['m'][0]>40 and abs(d['m'][3])<0.05).lower()")" "rotating Gaia–Selene frame: Selene fixed on +x axis" "$Q";;
  esac
  $AB screenshot "$SHOTS/reg-frame-$(echo "$FR" | tr ':' '-').png" >/dev/null
done

log "== checkpoint, rewind, reset"
$AB find role button click --name "Save checkpoint" >/dev/null; sleep 0.2
K0=$(js "JSON.stringify({t:OrbitLab.sim.s.t,x:OrbitLab.sim.s.x[3]})")
$AB press Space >/dev/null; sleep 1; $AB press Space >/dev/null
$AB find role button click --name "Restore checkpoint" >/dev/null; sleep 0.2
K1=$(js "JSON.stringify({t:OrbitLab.sim.s.t,x:OrbitLab.sim.s.x[3]})")
ok "$([ "$K0" = "$K1" ] && echo true || echo false)" "rewind restores the exact checkpoint state" "$K0 vs $K1"
$AB find role button click --name "Reset scenario" >/dev/null; sleep 0.2
K2=$(js "JSON.stringify({t:OrbitLab.sim.s.t,n:OrbitLab.sim.nodes.length,e:OrbitLab.sim.errors().dE})")
ok "$(jq_ "$K2" "str(d['t']==0 and d['n']==1 and d['e']==0).lower()")" "reset restarts at t=0 with the scenario's node and zero energy error" "$K2"

log "== energy-error reporting (RK4, dt=1 h on the e=0.6 ellipse)"
$AB find role tab click --name "Scenarios" >/dev/null; $AB find text "Elliptical orbit" click >/dev/null; sleep 0.2
$AB find role tab click --name "Physics" >/dev/null; $AB select "#phInt" "rk4" >/dev/null; $AB fill "#phDt" "1" >/dev/null; $AB press Tab >/dev/null
$AB find role button click --name "Play simulation" >/dev/null; $AB wait --fn "OrbitLab.sim.s.t>260" --timeout 30000 >/dev/null; $AB find role button click --name "Pause simulation" >/dev/null
E=$(js "JSON.stringify({dE:OrbitLab.sim.errors().dE, hud:document.getElementById('hErr').textContent, cls:document.getElementById('hErr').className})")
ok "$(jq_ "$E" "str(d['dE']>1e-7 and d['cls'] in ('warn','bad')).lower()")" "coarse RK4 drift is reported in HUD ($(jq_ "$E" "d['hud']"))" "$E"
$AB screenshot "$SHOTS/reg-energy-error.png" >/dev/null

log "== physics suite (in-page, app's own stepper)"
PS=$(cat "$ROOT/evidence/scripts/physics-suite.js" | $AB eval --stdin | python3 -c "import json,sys; print(json.loads(sys.stdin.read()))")
echo "$PS" > "$ROOT/evidence/logs/physics-suite.json"
python3 - "$PS" <<'EOF' | tee -a "$OUT"
import json,sys
d=json.loads(sys.argv[1])
for r in d['results']: print(('PASS  ' if r['pass'] else 'FAIL  ')+'[physics] '+r['name'])
EOF
SP=$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d['passed'], d['total'])" "$PS"); set -- $SP
PASS=$((PASS+$1)); FAIL=$((FAIL+$2-$1))

log "== narrow viewport 390x844"
$AB set viewport 390 844 >/dev/null; $AB open "file://$ROOT/index.html?m=1" >/dev/null; $AB wait 1200 >/dev/null
M=$(js "JSON.stringify({errs:window.__errs.length, sw:document.documentElement.scrollWidth, cw:document.getElementById('view').width})")
ok "$(jq_ "$M" "str(d['errs']==0 and d['sw']<=390 and d['cw']>=390).lower()")" "mobile layout: no errors, no horizontal overflow" "$M"
$AB screenshot "$SHOTS/reg-mobile.png" >/dev/null
$AB find role button click --name "Toggle control panel" >/dev/null; sleep 0.4
M2=$(js "JSON.stringify({sheet:document.body.classList.contains('sheet'), top:Math.round(document.getElementById('panel').getBoundingClientRect().top)})")
ok "$(jq_ "$M2" "str(d['sheet'] and d['top']<844).lower()")" "mobile: panel opens as bottom sheet" "$M2"
$AB screenshot "$SHOTS/reg-mobile-sheet.png" >/dev/null
$AB set viewport 1280 800 >/dev/null
FE=$(js "JSON.stringify(window.__errs)")
ok "$([ "$FE" = "[]" ] && echo true || echo false)" "no uncaught errors during the whole run" "$FE"
$AB close >/dev/null 2>&1
log "== RESULT: $PASS passed, $FAIL failed  (log: $OUT)"
[ "$FAIL" = "0" ]
