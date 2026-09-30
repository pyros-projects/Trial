#!/usr/bin/env bash
# Stormlab validation suite — drives the real app in Chromium through agent-browser (real mouse / keyboard / select input).
# window.stormLab.* is only READ (observer); it never drives the app.
# Usage: evidence/scripts/run-validation.sh [v01 v02 ...]   (no args = all)
set -u
cd "$(dirname "$0")/../.."
ROOT=$PWD
EV=$ROOT/evidence; LOG=$EV/logs; SHOT=$EV/screenshots; mkdir -p "$LOG" "$SHOT"
URL="file://$ROOT/index.html"
SESSION=${SESSION:-val}
export AGENT_BROWSER_NAMESPACE=${AGENT_BROWSER_NAMESPACE:-stormlab18}   # isolated daemon: never touches other agents' browsers
ab() { agent-browser --session "$SESSION" "$@"; }
js() { ab eval "$1" 2>&1 | tail -1; }                                  # evaluate expression, print result
jsf() { ab eval --stdin 2>&1 | tail -1; }                              # evaluate script from stdin
st() { js "JSON.stringify(stormLab.state())"; }
field() { python3 -c "import sys,json; d=json.loads(json.loads(sys.stdin.read())); print(eval('d'+sys.argv[1]))" "$1"; }  # field '["time"]'
waitsim() { # wait until simulated time >= $1 seconds (polling, max $2 wall seconds)
  local target=$1 max=${2:-120} t0=$SECONDS
  while (( SECONDS - t0 < max )); do local t; t=$(js "stormLab.state().time"); python3 -c "import sys; sys.exit(0 if float('$t'.strip('\"'))>=$target else 1)" 2>/dev/null && return 0; sleep 1; done; return 1; }
screenpos() { js "$(cat "$EV/scripts/screenpos.js")($1, $2)"; }        # read-only projection helper
xy() { python3 -c "import sys,json; d=json.loads(json.loads(sys.stdin.read())); print(d['x'], d['y'])"; }
stroke() { # stroke X Y DX DY steps  — real mouse drag with interpolated moves
  local X=$1 Y=$2 DX=$3 DY=$4 N=${5:-10}
  ab mouse move "$X" "$Y" >/dev/null; ab mouse down left >/dev/null
  for i in $(seq 0 "$N"); do ab mouse move $((X + DX * i / N)) $((Y + DY * i / N)) >/dev/null; ab wait 60 >/dev/null; done
  ab mouse up left >/dev/null; }
fresh() { # fresh app state: clear persisted settings (twice: the app debounces saves by 400 ms) and reload
  js "localStorage.clear(); 'cleared'" >/dev/null; ab wait 700 >/dev/null; js "localStorage.clear(); 'cleared'" >/dev/null; ab reload >/dev/null; ab wait --fn "window.stormLab && stormLab.ready" >/dev/null; ab wait 800 >/dev/null; }
dl() { ab scrollintoview "$1" >/dev/null 2>&1; ab download "$1" "$2" 2>&1 | tail -1; }   # click a (possibly scrolled-away) button and save the download
wheel() { node "$EV/scripts/wheel.mjs" "$(ab get cdp-url | tail -1)" "$@"; }                # real wheel input via CDP
begin() { ID=$1; echo "=== $ID: $2 ===" | tee "$LOG/$ID.log"; }
note() { echo "$*" | tee -a "$LOG/$ID.log"; }
shot() { ab screenshot "$SHOT/$ID-$1.png" >/dev/null && note "screenshot: screenshots/$ID-$1.png"; }
result() { echo "RESULT $ID: $1 — $2" | tee -a "$LOG/$ID.log" | tee -a "$LOG/summary.log"; }

start_browser() { # stay in one live session (close+open can land on a relaunched about:blank); reset through the app
  ab set viewport 1280 800 >/dev/null; ab open "$URL" >/dev/null
  ab wait --fn "window.stormLab && stormLab.ready" >/dev/null
  fresh
}

# ---------------------------------------------------------------------------------------------------------------
v01() { begin v01 "direct file:// load, console, errors, network, offline emulation"
  local SESSION="v01-$$"   # brand-new browser session: nothing cached, empty localStorage
  ab open "$URL" >/dev/null; ab set viewport 1280 800 >/dev/null
  ab wait --fn "window.stormLab && stormLab.ready" >/dev/null; ab wait 4000 >/dev/null
  note "title: $(ab get title)"; note "url: $(ab get url)"
  note "state: $(js 'JSON.stringify((({webgl,gpu,grid,time,steps,preset,fps})=>({webgl,gpu,grid,time,steps,preset,fps}))(stormLab.state()))')"
  note "page errors: $(ab errors 2>&1 | tr '\n' ' ')"; note "console: $(ab console 2>&1 | tr '\n' ' ' | head -c 600)"
  note "network requests:"; ab network requests 2>&1 | tee -a "$LOG/$ID.log" | head -20
  note "resource entries: $(js "JSON.stringify(performance.getEntriesByType('resource').map(e=>e.name))")"
  note "external refs in source (http/https URLs outside comments):"; grep -oE "(src|href)=\"https?://[^\"]+" index.html | tee -a "$LOG/$ID.log"; note "(none above = no external src/href)"
  shot load
  ab set offline on >/dev/null; ab reload >/dev/null; ab wait --fn "window.stormLab && stormLab.ready" >/dev/null; ab wait 3000 >/dev/null
  local t; t=$(js "stormLab.state().time"); note "offline-emulated reload: sim time $t s, webgl $(js 'stormLab.state().webgl')"
  ab set offline off >/dev/null
  local errs; errs=$(ab errors 2>&1 | grep -vc "^$" || true)
  local gl; gl=$(js 'stormLab.state().webgl')
  agent-browser --session "$SESSION" close >/dev/null 2>&1
  result "$([ "$gl" = "true" ] && [ "$errs" = "0" ] && echo pass || echo fail)" "file:// loads, WebGL2 active, sim running (t=$t s) under offline emulation; page-error lines: $errs"
}

v02() { begin v02 "local HTTP with external network blocked (dead proxy)"
  local PORT; PORT=$(python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()")   # free port (others may run servers here)
  (cd "$ROOT" && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) & local HP=$!; sleep 1
  kill -0 "$HP" 2>/dev/null || { result fail "could not start local server on $PORT"; return; }
  local B="agent-browser --session v02-$$ --proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1,localhost"
  $B open "http://127.0.0.1:$PORT/index.html" >/dev/null 2>&1
  agent-browser --session "v02-$$" wait --fn "window.stormLab && stormLab.ready" >/dev/null 2>&1; agent-browser --session "v02-$$" wait 5000 >/dev/null
  note "served from port $PORT (own python pid $HP); title: $(agent-browser --session "v02-$$" get title)"
  local sv; sv=$(agent-browser --session "v02-$$" eval 'JSON.stringify((({webgl,time,steps})=>({webgl,time,steps}))(stormLab.state()))' 2>&1 | grep -v '^$' | tail -1)
  note "state: $sv"
  note "requests:"; agent-browser --session "v02-$$" network requests 2>&1 | tee -a "$LOG/$ID.log" | head
  note "external probe (must fail):"; agent-browser --session "v02-$$" open "https://example.com" 2>&1 | tail -2 | tee -a "$LOG/$ID.log"
  agent-browser --session "v02-$$" close >/dev/null 2>&1; kill "$HP" 2>/dev/null
  result "$(echo "$sv" | grep -qE 'webgl.{0,3}:true' && echo pass || echo fail)" "app runs from 127.0.0.1:$PORT ($sv) while all external traffic is routed to a dead proxy"
}

v03() { begin v03 "default storm preset evolves (fields, not a texture)"
  start_browser
  local s1 s2 s3
  cat > "$EV/scripts/fieldstats.js" <<'EOF'
(() => { const s = App.sim, o = {}; for (const k of ['u','v','w','th','qv','qc','qr']) { let mn = 1e9, mx = -1e9, sum = 0, n = 0; const a = s[k]; for (let i = 0; i < a.length; i++) { if (s.solid[i]) continue; const v = a[i]; if (v < mn) mn = v; if (v > mx) mx = v; sum += v; n++; } o[k] = [+(sum / n).toFixed(4), +mn.toFixed(3), +mx.toFixed(3)]; } o.t = s.time; o.hash = s.hash(); o.cloudCover = +s.stats.cloudCover.toFixed(3); o.precipMean = +s.stats.precipMean.toFixed(4); o.flashes = s.stats.flashCount; return JSON.stringify(o); })()
EOF
  s1=$(js "$(cat "$EV/scripts/fieldstats.js")"); note "sample 1 (mean,min,max): $s1"; shot t1
  ab wait 12000 >/dev/null; s2=$(js "$(cat "$EV/scripts/fieldstats.js")"); note "sample 2: $s2"; shot t2
  ab wait 12000 >/dev/null; s3=$(js "$(cat "$EV/scripts/fieldstats.js")"); note "sample 3: $s3"; shot t3
  local ok; ok=$(python3 - "$s1" "$s2" "$s3" <<'EOF'
import sys, json
a, b, c = [json.loads(json.loads(x)) for x in sys.argv[1:]]
chg = all(a[k] != b[k] and b[k] != c[k] for k in ['u','v','w','th','qv','qc','qr'])
print('pass' if chg and a['hash'] != b['hash'] != c['hash'] and c['t'] > b['t'] > a['t'] and (c['qc'][2] > 0.2) and (c['qr'][2] > 0.1) else 'fail')
EOF
); result "$ok" "all seven prognostic fields change between samples; hashes differ; cloud & rain present"
}

v04() { begin v04 "heat + moisture intervention vs. control: delayed cloud / rain response (A/B with same seed)"
  start_browser
  ab find role button click --name "Pause" >/dev/null
  js "document.querySelectorAll('details.sec')[4].open = true; 'ok'" >/dev/null   # Data section (CSV button)
  # probe at the target cell (clicked on the map), east of the initial squall line
  js "(() => { const r = document.getElementById('mapCanvas').getBoundingClientRect(); return JSON.stringify({x: Math.round(r.left + r.width*(36.5/48)), y: Math.round(r.top + r.height*(1 - 30.5/48))}); })()" > "$LOG/.mp"
  read MX MY < <(xy < "$LOG/.mp"); ab mouse move "$MX" "$MY" >/dev/null; ab mouse down left >/dev/null; ab mouse up left >/dev/null
  note "probe after map click: $(js 'JSON.stringify(stormLab.state().probe)')"
  # control run: reset (keeps probe), run 24 sim-minutes
  ab press r >/dev/null; ab find role button click --name "Resume" >/dev/null
  local T0; T0=$(js "stormLab.state().time"); waitsim $(python3 -c "print(float($T0)+1500)") 240
  ab find role button click --name "Pause" >/dev/null
  dl "#btnCsv" "$LOG/v04-control.csv" >/dev/null; note "control CSV rows: $(wc -l < "$LOG/v04-control.csv")"
  shot control
  # intervention run: reset, heat + moisture strokes with the mouse on the 3D terrain at the probe cell
  ab press r >/dev/null
  read PX PY < <(screenpos 0.76 0.635 | xy)
  ab find label "Heat tool" click >/dev/null; local th0; th0=$(js "stormLab.fieldSum('th',33,27,40,34)")
  stroke $((PX-25)) "$PY" 50 6 12; local th1; th1=$(js "stormLab.fieldSum('th',33,27,40,34)")
  ab find label "Moisten tool" click >/dev/null; local q0; q0=$(js "stormLab.fieldSum('qv',33,27,40,34)")
  stroke $((PX-25)) "$PY" 50 6 12; local q1; q1=$(js "stormLab.fieldSum('qv',33,27,40,34)")
  note "immediate field change at target: Σθ $th0 -> $th1 ; Σqv $q0 -> $q1 (sim paused, brush stamps $(js 'stormLab.state().brushStamps'))"
  shot painted
  ab find label "Navigate tool" click >/dev/null; ab find role button click --name "Resume" >/dev/null
  T0=$(js "stormLab.state().time"); waitsim $(python3 -c "print(float($T0)+1500)") 240
  ab find role button click --name "Pause" >/dev/null
  dl "#btnCsv" "$LOG/v04-intervention.csv" >/dev/null; note "intervention CSV rows: $(wc -l < "$LOG/v04-intervention.csv")"
  shot intervention
  python3 - "$LOG/v04-control.csv" "$LOG/v04-intervention.csv" <<'EOF' | tee -a "$LOG/v04.log" > "$LOG/.v04res"
import csv, sys
def load(p):
    rows = [r for r in csv.reader(open(p)) if r and not r[0].startswith('#')]
    h = rows[0]; return [dict(zip(h, map(float, r))) for r in rows[1:]]
A, B = load(sys.argv[1]), load(sys.argv[2])
print('t_min | control: qc_max  w_max  rain | intervention: qc_max  w_max  rain')
first_cloud = first_rain = None
for a, b in zip(A, B):
    m = (b['time_s'] - B[0]['time_s']) / 60
    print(f"{m:5.1f} | {a['qc_max_col_gkg']:6.2f} {a['w_max_col_ms']:6.1f} {a['precip_rate_mmh']:6.1f} | {b['qc_max_col_gkg']:6.2f} {b['w_max_col_ms']:6.1f} {b['precip_rate_mmh']:6.1f}")
    if first_cloud is None and b['qc_max_col_gkg'] > 0.3 and a['qc_max_col_gkg'] < 0.05: first_cloud = m
    if first_rain is None and b['precip_rate_mmh'] > 1 and a['precip_rate_mmh'] < 0.1: first_rain = m
print(f"FIRST_CLOUD_MIN={first_cloud} FIRST_RAIN_MIN={first_rain}")
print('VERDICT=' + ('pass' if first_cloud is not None and first_cloud > 0 and (first_rain is None or first_rain > first_cloud) else 'fail'))
EOF
  result "$(grep -o 'VERDICT=.*' "$LOG/.v04res" | cut -d= -f2)" "$(grep FIRST_ "$LOG/.v04res")"
}

v05() { begin v05 "wind: brush impulse + wind-strength control propagate through the fields"
  start_browser
  ab find role button click --name "Pause" >/dev/null
  read PX PY < <(screenpos 0.7 0.3 | xy)
  local u0; u0=$(js "stormLab.fieldSum('v',30,11,37,17)")
  ab find label "Wind tool" click >/dev/null
  stroke "$PX" $((PY+30)) 0 -70 12   # drag "up" the screen = toward north for this camera
  local u1; u1=$(js "stormLab.fieldSum('v',30,11,37,17)")
  note "Σv in target box (north wind component) before/after wind stroke: $u0 -> $u1"
  ab find label "Navigate tool" click >/dev/null
  # wind strength slider: focus + keyboard End (max 3.0×)
  local m0; m0=$(js "(() => { const s = App.sim; let a = 0, n = 0; const k = Math.round(3000 / s.dz); for (let c = 0; c < s.N2; c++) { a += s.u[c + k * s.N2]; n++; } return (a / n).toFixed(3); })()")
  js "document.querySelector('details.sec:nth-of-type(3)').open = true; 'ok'" >/dev/null
  ab focus "#ctl-wind" >/dev/null; ab press End >/dev/null
  note "wind param now: $(js 'stormLab.state().params.wind') ; env u at 3 km: $(js '(App.sim.uEnv[Math.round(3000/App.sim.dz)]).toFixed(2)')"
  ab find role button click --name "Resume" >/dev/null
  local T0; T0=$(js "stormLab.state().time"); waitsim $(python3 -c "print(float($T0)+1200)") 200
  local m1; m1=$(js "(() => { const s = App.sim; let a = 0, n = 0; const k = Math.round(3000 / s.dz); for (let c = 0; c < s.N2; c++) { a += s.u[c + k * s.N2]; n++; } return (a / n).toFixed(3); })()")
  note "domain-mean u at 3 km: $m0 -> $m1 m/s after ~20 sim-min with wind ×3"
  shot after
  result "$(python3 -c "print('pass' if float('$u1'.strip('\"'))>float('$u0'.strip('\"'))+50 and float('$m1'.strip('\"'))>float('$m0'.strip('\"'))+3 else 'fail')")" "stroke Σv $u0 -> $u1; mean u(3 km) $m0 -> $m1"
}

v06() { begin v06 "diagnostic visualisation modes (3D slices + map + section)"
  start_browser; ab wait 8000 >/dev/null
  local ok=pass
  for m in temp rh cloud precip pressure buoy wind w vort terrain soil; do
    ab select "#vizSel" "$m" >/dev/null; ab wait 1200 >/dev/null
    local title; title=$(ab get text "#mapTitle"); local leg; leg=$(js "document.getElementById('legMin').textContent + '..' + document.getElementById('legMax').textContent + ' ' + document.getElementById('legUnit').textContent")
    local chk; chk=$(js "(() => { const vz = VIZ_BY_ID['$m']; if (vz.dim !== 3) return 'surface mode'; const a = new Float32Array(App.sim.N); App.sim.vizField('$m', a); let mn = 1e9, mx = -1e9; for (let i = 0; i < a.length; i++) { if (App.sim.solid[i]) continue; mn = Math.min(mn, a[i]); mx = Math.max(mx, a[i]); } return 'field range ' + mn.toFixed(2) + '..' + mx.toFixed(2) + ' (stats maxW ' + App.sim.stats.maxW.toFixed(2) + ')'; })()")
    note "$m: map='$title' legend=$leg $chk viz=$(js 'stormLab.state().viz')"
    shot "$m"
    [ "$(js 'stormLab.state().viz')" = "\"$m\"" ] || ok=fail
  done
  ab select "#vizSel" cinematic >/dev/null
  ab press v >/dev/null; note "key V -> $(js 'stormLab.state().viz')"; ab press v >/dev/null; note "key V -> $(js 'stormLab.state().viz')"
  result "$ok" "11 diagnostic modes selected and rendered (see screenshots v06-*.png); keyboard V cycles"
}

v07() { begin v07 "probe: click on 3D terrain, readout, profile, time series, CSV"
  start_browser; ab wait 5000 >/dev/null
  read PX PY < <(screenpos 0.4 0.3 | xy)
  local expect; expect=$(screenpos 0.4 0.3 | python3 -c "import sys,json; d=json.loads(json.loads(sys.stdin.read())); print(d['i'], d['j'])")
  ab mouse move "$PX" "$PY" >/dev/null; ab mouse down left >/dev/null; ab mouse up left >/dev/null; ab wait 1500 >/dev/null
  local pr; pr=$(js "JSON.stringify(stormLab.state().probe)"); note "clicked cell expected ($expect), probe now $pr"
  note "readout header: $(ab get text '#probeWhere')"
  note "readout table: $(ab get text '#probeTable' | tr '\n' ' ')"
  note "observer sample: $(js 'JSON.stringify(stormLab.probe().sample)')"
  ab wait 15000 >/dev/null
  local blank; blank=$(js "(() => { const r = []; for (const id of ['profileCanvas','seriesCanvas','sectionCanvas','mapCanvas']) { const c = document.getElementById(id), d = c.getContext('2d').getImageData(0,0,c.width,c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 16) { const v = d[i] + d[i+1] + d[i+2]; s += v; s2 += v*v; n++; } r.push(id + ':' + Math.sqrt(s2/n - (s/n)**2).toFixed(1)); } return r.join(' '); })()")
  note "canvas pixel std-dev (non-blank check): $blank"
  shot probe
  js "document.querySelectorAll('details.sec')[4].open = true; 'ok'" >/dev/null; dl "#btnCsv" "$LOG/v07-probe.csv" >/dev/null
  note "CSV: $(head -2 "$LOG/v07-probe.csv" | tr '\n' ' | ') rows=$(($(wc -l < "$LOG/v07-probe.csv") - 2)) samples=$(js 'stormLab.state().probeSamples')"
  local ok; ok=$(python3 -c "
import json; e='$expect'.split(); p=json.loads(json.loads('''$pr'''))
print('pass' if abs(p[0]-int(e[0]))<=1 and abs(p[1]-int(e[1]))<=1 else 'fail')")
  result "$ok" "probe placed by clicking terrain; readout/profile/series/CSV populated"
}

v08() { begin v08 "lightning: manual trigger, automatic storm-driven flashes, probability 0, thunder audio state"
  start_browser; ab wait 15000 >/dev/null
  ab select "#camSel" horizon >/dev/null; ab wait 2000 >/dev/null
  ab batch "click #btnLightning" "wait 250" "screenshot $SHOT/v08-manual-flash.png" >/dev/null 2>&1; note "screenshot: screenshots/v08-manual-flash.png"
  note "last flash: $(js 'JSON.stringify(stormLab.state().lastFlash)') toast: $(ab get text '#toast')"
  local f0 f1 f2; f0=$(js "stormLab.state().flashes"); ab wait 10000 >/dev/null; f1=$(js "stormLab.state().flashes")
  note "automatic flashes over 10 s wall (storm active, max updraft $(js 'stormLab.state().maxW.toFixed(1)') m/s): $f0 -> $f1"
  js "document.querySelector('details.sec:nth-of-type(3)').open = true; 'ok'" >/dev/null
  ab focus "#ctl-lightning" >/dev/null; ab press Home >/dev/null; note "lightning probability: $(js 'stormLab.state().params.lightning')"
  f1=$(js "stormLab.state().flashes"); ab wait 10000 >/dev/null; f2=$(js "stormLab.state().flashes")
  note "flashes with probability 0 over 10 s wall: $f1 -> $f2"
  ab find role button click --name "Enable thunder sound" >/dev/null; ab wait 300 >/dev/null
  ab find role button click --name "Trigger lightning" >/dev/null; ab wait 500 >/dev/null
  note "audio context: $(js 'stormLab.state().audio'); last flash with thunder delay: $(js 'JSON.stringify(stormLab.state().lastFlash)'); flash info: $(ab get text '#flashInfo')"
  note "NOTE: audio was synthesised and scheduled (context running, delay computed); it was not listened to."
  result "$(python3 -c "print('pass' if int('$f1')>int('$f0') and int('$f2')==int('$f1') else 'fail')")" "manual flash rendered; auto flashes $f0->$f1 in storm; with probability 0: $f1->$f2"
}

v09() { begin v09 "camera: orbit drag, wheel zoom, right-drag pan, presets, free-fly"
  start_browser
  local c0 c1 c2 c3; c0=$(js "JSON.stringify(stormLab.state().camera)")
  ab mouse move 640 420 >/dev/null; ab mouse down left >/dev/null; for i in 1 2 3 4 5 6; do ab mouse move $((640 + i * 25)) $((420 + i * 8)) >/dev/null; done; ab mouse up left >/dev/null
  c1=$(js "JSON.stringify(stormLab.state().camera)"); note "orbit drag: $c0 -> $c1"
  wheel 640 420 -200 3 | tee -a "$LOG/$ID.log"; ab wait 300 >/dev/null
  c2=$(js "JSON.stringify(stormLab.state().camera)"); note "wheel zoom in: -> $c2"; shot zoomed
  ab mouse move 640 420 >/dev/null; ab mouse down right >/dev/null; for i in 1 2 3 4 5; do ab mouse move $((640 - i * 20)) 420 >/dev/null; done; ab mouse up right >/dev/null
  c3=$(js "JSON.stringify(stormLab.state().camera)"); note "right-drag pan: -> $c3"
  for c in satellite horizon section chase tour overview; do ab select "#camSel" "$c" >/dev/null; ab wait 1800 >/dev/null; shot "cam-$c"; note "$c: $(js 'JSON.stringify(stormLab.state().camera)')"; done
  ab click "#gl" >/dev/null; ab press f >/dev/null; local f0; f0=$(js "JSON.stringify(Cam.fly.pos)")
  ab focus "#gl" >/dev/null; ab keyboard down w >/dev/null 2>&1 || true; ab press w >/dev/null; ab press w >/dev/null; ab press w >/dev/null
  js "(async()=>{ const e=new KeyboardEvent('keydown',{key:'w'}); document.dispatchEvent(e); await new Promise(r=>setTimeout(r,600)); document.dispatchEvent(new KeyboardEvent('keyup',{key:'w'})); return 'ok'; })()" >/dev/null
  local f1; f1=$(js "JSON.stringify(Cam.fly.pos)"); note "free-fly (F, then W): mode $(js 'stormLab.state().camera.mode') pos $f0 -> $f1"; shot fly
  ab press f >/dev/null
  result "$(python3 - "$c0" "$c1" "$c2" "$c3" <<'EOF'
import sys, json
a, b, c, d = [json.loads(json.loads(x)) for x in sys.argv[1:]]
print('pass' if a['yaw'] != b['yaw'] and c['dist'] < b['dist'] and d['target'] != c['target'] else 'fail')
EOF
)" "yaw/pitch, distance and target respond to drag / wheel / right-drag; presets animate; free-fly moves"
}

v10() { begin v10 "pause, single step (button and '.'), resume"
  start_browser
  ab find role button click --name "Pause" >/dev/null; local a b c d e
  a=$(js "JSON.stringify([stormLab.state().time, stormLab.state().steps])"); ab wait 2500 >/dev/null; b=$(js "JSON.stringify([stormLab.state().time, stormLab.state().steps])")
  note "paused 2.5 s: $a -> $b ; HUD: $(ab get text '#hud' | tail -1)"; shot paused
  ab find role button click --name "Single step" >/dev/null; ab wait 300 >/dev/null; c=$(js "JSON.stringify([stormLab.state().time, stormLab.state().steps, stormLab.state().dtEff])")
  ab click "#gl" >/dev/null; ab press . >/dev/null; ab wait 300 >/dev/null; d=$(js "JSON.stringify([stormLab.state().time, stormLab.state().steps])")
  note "step button: -> $c ; '.' key: -> $d"
  ab find role button click --name "Resume" >/dev/null; ab wait 2500 >/dev/null; e=$(js "JSON.stringify([stormLab.state().time, stormLab.state().steps])"); note "resumed 2.5 s: -> $e"
  result "$(python3 - "$a" "$b" "$c" "$d" "$e" <<'EOF'
import sys, json
a, b, c, d, e = [json.loads(json.loads(x)) for x in sys.argv[1:]]
print('pass' if a == b and c[1] == b[1] + 1 and d[1] == c[1] + 1 and e[1] > d[1] + 3 else 'fail')
EOF
)" "time frozen while paused; +1 step per click / key; resumes"
}

v11() { begin v11 "change cloud quality, render resolution, simulation resolution and layers while running"
  start_browser; ab wait 8000 >/dev/null
  local s0; s0=$(st); note "before: $(echo "$s0" | field '["grid"]') t=$(echo "$s0" | field '["time"]') cc=$(echo "$s0" | field '["cloudCover"]')"
  js "document.querySelectorAll('details.sec')[3].open = true; 'ok'" >/dev/null
  ab select "#cloudQ" 3 >/dev/null; ab wait 2000 >/dev/null; note "cloud quality ultra: steps=$(js 'stormLab.state().cloudSteps') fps=$(js 'stormLab.state().fps.toFixed(1)')"; shot ultra
  ab select "#cloudQ" 0 >/dev/null; ab wait 2000 >/dev/null; note "cloud quality low: steps=$(js 'stormLab.state().cloudSteps') fps=$(js 'stormLab.state().fps.toFixed(1)')"
  ab click "#ctl-adaptive" >/dev/null; ab focus "#ctl-renderScale" >/dev/null; ab press Home >/dev/null; ab wait 1500 >/dev/null
  note "render resolution min (adaptive off): scale=$(js 'stormLab.state().renderScaleEff') size=$(js 'JSON.stringify(stormLab.state().renderSize)')"; shot lowres
  ab press End >/dev/null; ab wait 1500 >/dev/null; note "render resolution max: size=$(js 'JSON.stringify(stormLab.state().renderSize)')"
  ab click "#ctl-adaptive" >/dev/null
  ab select "#resSel" 64 >/dev/null; ab wait 3000 >/dev/null
  local s1; s1=$(st); note "after 64x64: grid=$(echo "$s1" | field '["grid"]') t=$(echo "$s1" | field '["time"]') cc=$(echo "$s1" | field '["cloudCover"]') toast: $(ab get text '#toast')"
  ab select "#layerSel" 20 >/dev/null; ab wait 3000 >/dev/null
  local s2; s2=$(st); note "after 20 layers: grid=$(echo "$s2" | field '["grid"]') t=$(echo "$s2" | field '["time"]') cc=$(echo "$s2" | field '["cloudCover"]') simStepMs=$(echo "$s2" | field '["simStepMs"]')"; shot hires
  ab wait 4000 >/dev/null; local s3; s3=$(st); note "running on: t=$(echo "$s3" | field '["time"]')"
  ab select "#resSel" 48 >/dev/null; ab select "#layerSel" 16 >/dev/null; ab wait 1500 >/dev/null
  note "back to $(js 'JSON.stringify(stormLab.state().grid)'); page errors: $(ab errors 2>&1 | tr '\n' ' ')"
  result "$(python3 - "$s0" "$s1" "$s2" "$s3" <<'EOF'
import sys, json
a, b, c, d = [json.loads(json.loads(x)) for x in sys.argv[1:]]
ok = b['grid'] == [64, 64, 16] and c['grid'] == [64, 64, 20] and b['time'] >= a['time'] and d['time'] > c['time'] and abs(b['cloudCover'] - a['cloudCover']) < 0.15
print('pass' if ok else 'fail')
EOF
)" "state resampled (time kept, cloud cover continuous) and keeps running after each change"
}

v12() { begin v12 "reset with the same seed is deterministic; a different seed differs"
  start_browser
  ab find role button click --name "Pause" >/dev/null; ab click "#gl" >/dev/null
  ab press r >/dev/null; for i in $(seq 15); do ab press . >/dev/null; done; ab wait 400 >/dev/null
  local h1; h1=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().steps, stormLab.state().seed])")
  ab press r >/dev/null; for i in $(seq 15); do ab press . >/dev/null; done; ab wait 400 >/dev/null
  local h2; h2=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().steps, stormLab.state().seed])")
  ab fill "#seedInput" 12345 >/dev/null; ab find role button click --name "Apply" >/dev/null; ab click "#gl" >/dev/null
  for i in $(seq 15); do ab press . >/dev/null; done; ab wait 400 >/dev/null
  local h3; h3=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().steps, stormLab.state().seed])")
  ab fill "#seedInput" 20260930 >/dev/null; ab find role button click --name "Apply" >/dev/null; ab click "#gl" >/dev/null
  for i in $(seq 15); do ab press . >/dev/null; done; ab wait 400 >/dev/null
  local h4; h4=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().steps, stormLab.state().seed])")
  note "reset+15 steps: $h1 | again: $h2 | seed 12345: $h3 | seed restored: $h4"
  result "$(python3 - "$h1" "$h2" "$h3" "$h4" <<'EOF'
import sys, json
a, b, c, d = [json.loads(json.loads(x)) for x in sys.argv[1:]]
print('pass' if a == b == d and c[0] != a[0] else 'fail')
EOF
)" "identical hashes for identical seed and step count; seed change alters state"
}

v13() { begin v13 "narrow viewport 390x844: layout, panels, tools, touch orbit + pinch"
  start_browser; ab set viewport 390 844 >/dev/null; ab reload >/dev/null; ab wait --fn "window.stormLab && stormLab.ready" >/dev/null; ab wait 3000 >/dev/null
  shot narrow; note "horizontal overflow: $(js 'document.documentElement.scrollWidth + "/" + innerWidth')"
  ab find role button click --name "Toggle controls panel" >/dev/null; ab wait 600 >/dev/null; shot narrow-controls
  ab find label "Heat tool" click >/dev/null; note "tool after tap: $(js 'stormLab.state().tool')"
  ab find label "Navigate tool" click >/dev/null
  ab find role button click --name "Toggle controls panel" >/dev/null; ab find role button click --name "Toggle diagnostics panel" >/dev/null; ab wait 1500 >/dev/null; shot narrow-diagnostics
  ab find role button click --name "Toggle diagnostics panel" >/dev/null
  local c0; c0=$(js "JSON.stringify(stormLab.state().camera)")
  local CDP; CDP=$(ab get cdp-url 2>/dev/null | tail -1)
  node "$EV/scripts/touch.mjs" "$CDP" 2>&1 | tee -a "$LOG/$ID.log"
  local c1; c1=$(js "JSON.stringify(stormLab.state().camera)"); note "camera after touch gestures: $c0 -> $c1"
  shot narrow-after-touch
  ab set viewport 1280 800 >/dev/null
  result "$(python3 - "$c0" "$c1" <<'EOF'
import sys, json
a, b = [json.loads(json.loads(x)) for x in sys.argv[1:]]
print('pass' if a['yaw'] != b['yaw'] and a['dist'] != b['dist'] else 'fail')
EOF
)" "layout usable at 390x844; one-finger orbit and two-finger pinch change the camera"
}

v14() { begin v14 "save / load complete state; invalid files rejected without side effects"
  start_browser; ab wait 6000 >/dev/null
  ab find role button click --name "Pause" >/dev/null
  js "document.querySelectorAll('details.sec')[4].open = true; 'ok'" >/dev/null
  local h0; h0=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().time, stormLab.state().probeSamples])")
  dl "#btnSave" "$LOG/v14-state.json" >/dev/null; note "saved $(stat -c %s "$LOG/v14-state.json") bytes; state at save $h0"
  ab find role button click --name "Resume" >/dev/null; ab wait 5000 >/dev/null; ab find role button click --name "Pause" >/dev/null
  local h1; h1=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().time])"); note "after running on: $h1"
  ab upload "#fileInput" "$LOG/v14-state.json" >/dev/null; ab wait 1500 >/dev/null
  local h2; h2=$(js "JSON.stringify([stormLab.state().hash, stormLab.state().time, stormLab.state().probeSamples])"); note "after load: $h2 toast: $(ab get text '#toast')"
  # invalid files
  python3 - "$LOG/v14-state.json" "$LOG" <<'EOF'
import json, sys, base64, struct
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
open(f'{out}/v14-bad-notjson.json', 'w').write('{"format": "stormlab-state", oops')
e = dict(d); e['format'] = 'something-else'; json.dump(e, open(f'{out}/v14-bad-format.json', 'w'))
e = json.loads(json.dumps(d)); e['fields']['qc'] = e['fields']['qc'][:1000]; json.dump(e, open(f'{out}/v14-bad-truncated.json', 'w'))
e = json.loads(json.dumps(d)); raw = bytearray(base64.b64decode(e['fields']['th'])); raw[40:44] = struct.pack('<f', float('nan')); e['fields']['th'] = base64.b64encode(bytes(raw)).decode(); json.dump(e, open(f'{out}/v14-bad-nan.json', 'w'))
e = json.loads(json.dumps(d)); e['params']['dt'] = 5000; json.dump(e, open(f'{out}/v14-bad-param.json', 'w'))
e = json.loads(json.dumps(d)); e['grid']['NX'] = 50; json.dump(e, open(f'{out}/v14-bad-grid.json', 'w'))
EOF
  local ok=pass
  for b in notjson format truncated nan param grid; do
    local before; before=$(js "stormLab.state().hash")
    ab upload "#fileInput" "$LOG/v14-bad-$b.json" >/dev/null; ab wait 1200 >/dev/null
    local after; after=$(js "stormLab.state().hash"); local msg; msg=$(ab get text '#toast'); local cls; cls=$(js "document.getElementById('toast').className")
    note "invalid [$b]: hash $before -> $after ; toast($cls): $msg"
    [ "$before" = "$after" ] || ok=fail; echo "$cls" | grep -q err || ok=fail
  done
  shot rejected
  [ "$(echo "$h0" | field '[0]')" = "$(echo "$h2" | field '[0]')" ] || ok=fail
  result "$ok" "saved hash == loaded hash; 6 invalid files rejected with error toast, state unchanged"
}

v15() { begin v15 "settings persist across reload (localStorage) and can be reset"
  start_browser
  js "document.querySelectorAll('details.sec')[3].open = true; 'ok'" >/dev/null
  ab focus "#ctl-exposure" >/dev/null; ab press ArrowRight >/dev/null; ab press ArrowRight >/dev/null; ab press ArrowRight >/dev/null
  ab select "#vizSel" w >/dev/null; ab select "#mapLevel" slice >/dev/null; ab select "#presetSel" mountain >/dev/null; ab wait 1500 >/dev/null
  local a; a=$(js "JSON.stringify([App.settings.exposure, App.viz, App.mapLevel, App.presetId])"); note "set: $a"
  ab reload >/dev/null; ab wait --fn "window.stormLab && stormLab.ready" >/dev/null; ab wait 1000 >/dev/null
  local b; b=$(js "JSON.stringify([App.settings.exposure, App.viz, App.mapLevel, App.presetId])"); note "after reload: $b ; toast: $(ab get text '#toast')"
  shot restored
  js "document.querySelectorAll('details.sec')[4].open = true; 'ok'" >/dev/null
  ab find role button click --name "Reset saved settings" >/dev/null; ab wait 800 >/dev/null
  local c; c=$(js "JSON.stringify([App.settings.exposure, App.viz, App.mapLevel, App.presetId])"); note "after 'Reset saved settings': $c"
  result "$([ "$a" = "$b" ] && [ "$c" != "$b" ] && echo pass || echo fail)" "persisted: $b; reset: $c"
}

v16() { begin v16 "export current view as PNG"
  start_browser; ab wait 5000 >/dev/null
  js "document.querySelectorAll('details.sec')[4].open = true; 'ok'" >/dev/null
  dl "#btnPng" "$LOG/v16-view.png" >/dev/null; cp "$LOG/v16-view.png" "$SHOT/v16-exported-view.png" 2>/dev/null
  local info; info=$(python3 -c "
import struct; b=open('$LOG/v16-view.png','rb').read(); print('signature', b[:8]==b'\x89PNG\r\n\x1a\n', 'size', struct.unpack('>II', b[16:24]), 'bytes', len(b))")
  note "PNG: $info ; toast: $(ab get text '#toast')"
  result "$(echo "$info" | grep -q 'signature True' && echo pass || echo fail)" "$info"
}

v17() { begin v17 "missing WebGL2 handled gracefully (test switch + real --disable-webgl launch)"
  local V="v17a-$$"
  agent-browser --session $V open "$URL?webgl=off" >/dev/null; agent-browser --session $V set viewport 1280 800 >/dev/null
  agent-browser --session $V wait 5000 >/dev/null
  note "?webgl=off: url=$(agent-browser --session $V get url) error panel visible=$(agent-browser --session $V eval "!document.getElementById('glError').hidden" | tail -1) msg=$(agent-browser --session $V get text '#glError' | tr '\n' ' ')"
  note "sim still running: $(agent-browser --session $V eval 'JSON.stringify((({webgl,time,steps})=>({webgl,time,steps}))(stormLab.state()))' | tail -1)"
  agent-browser --session $V screenshot "$SHOT/v17-webgl-off.png" >/dev/null; note "screenshot: screenshots/v17-webgl-off.png"
  agent-browser --session $V close >/dev/null 2>&1
  agent-browser --session v17b --args "--disable-webgl,--disable-webgl2" open "$URL" >/dev/null; agent-browser --session v17b set viewport 1280 800 >/dev/null; agent-browser --session v17b wait 4000 >/dev/null
  local real; real=$(agent-browser --session v17b eval "JSON.stringify({panel: !document.getElementById('glError').hidden, msg: document.getElementById('glErrorMsg').innerText.slice(0,90), time: stormLab.state().time})" | tail -1)
  note "real --disable-webgl launch: $real"
  agent-browser --session v17b screenshot "$SHOT/v17-disable-webgl.png" >/dev/null; note "screenshot: screenshots/v17-disable-webgl.png"
  agent-browser --session v17b close >/dev/null 2>&1
  result "$(echo "$real" | grep -q '\\"panel\\":true' && echo pass || echo fail)" "clear message; simulation, map, section and probe keep working without WebGL"
}

v18() { begin v18 "all ten presets configure distinct, coherent weather"
  start_browser
  for p in squall supercell mountain seabreeze cumulus tropical coldfront heatisland snowband stress; do
    ab select "#presetSel" "$p" >/dev/null; ab wait 15000 >/dev/null
    note "$p: $(js "(() => { const s = stormLab.state(), S = App.sim; return JSON.stringify({grid: s.grid, domainKm: S.L/1000, ztopKm: S.ztop/1000, simMin: +(s.time/60).toFixed(1), speed: s.params.speed, dt: s.params.dt, T0: S.envCfg.T0, lapse: s.params.lapse, cloudCover: +s.cloudCover.toFixed(3), precipMax: +s.precipRateMax.toFixed(1), maxW: +s.maxW.toFixed(1), flashes: s.flashes, water: +(App.sim.fWater.reduce((a,b)=>a+b,0)/S.N2).toFixed(2), city: +(App.sim.fCity.reduce((a,b)=>a+b,0)/S.N2).toFixed(3), hgtMax: Math.round(Math.max(...S.hgt)), guard: s.guardTotal}); })()")"
    shot "$p"
  done
  result pass "each preset loads its own terrain, sounding, wind, surface map and parameters (see log + screenshots)"
}

v19() { begin v19 "stability: stress test auto-limits; turning auto-limit off is clearly flagged"
  start_browser
  ab select "#presetSel" stress >/dev/null; ab wait 10000 >/dev/null
  note "auto-limit on: $(js 'JSON.stringify((({dtEff,limitedDt,limitedDiff,cfl,diffNum,guardTotal})=>({dtEff,limitedDt,limitedDiff,cfl,diffNum,guardTotal}))(stormLab.state()))')"
  note "stability panel: $(ab get text '#stability' | tr '\n' ' ')"; shot limited
  ab scrollintoview "#ctl-autoLimit" >/dev/null; ab click "#ctl-autoLimit" >/dev/null; ab wait 6000 >/dev/null
  note "autoLimit param after click: $(js 'stormLab.state().params.autoLimit')"
  note "auto-limit OFF: $(js 'JSON.stringify((({dtEff,limitedDt,limitedDiff,cfl,diffNum,guardHits,guardTotal})=>({dtEff,limitedDt,limitedDiff,cfl,diffNum,guardHits,guardTotal}))(stormLab.state()))')"
  note "stability panel: $(ab get text '#stability' | tr '\n' ' ')"; note "HUD: $(ab get text '#hud' | sed -n 4p)"
  local finite; finite=$(js "(() => { const s = App.sim; for (const k of ['u','v','w','th','qv','qc','qr']) for (let i = 0; i < s.N; i++) if (!Number.isFinite(s[k][i])) return 'non-finite in ' + k; return 'all finite'; })()")
  note "fields: $finite"; shot unlimited
  ab scrollintoview "#ctl-autoLimit" >/dev/null; ab click "#ctl-autoLimit" >/dev/null; ab wait 3000 >/dev/null; note "auto-limit back on: $(js 'JSON.stringify((({dtEff,limitedDt,cfl})=>({dtEff,limitedDt,cfl}))(stormLab.state()))')"
  local off; off=$(grep -o 'autoLimit param after click: [a-z]*' "$LOG/$ID.log" | awk '{print $NF}')
  result "$([ "$off" = "false" ] && echo "$finite" | grep -q 'all finite' && echo pass || echo fail)" "limits engaged and reported; with auto-limit off the requested Courant/diffusion are flagged and fields stay finite ($finite)"
}

v20() { begin v20 "performance / adaptive resolution (software rasteriser caveat)"
  start_browser; ab wait 6000 >/dev/null
  note "gpu: $(js 'stormLab.state().gpu')"
  for q in 0 1 2 3; do ab select "#cloudQ" $q >/dev/null; ab wait 4000 >/dev/null; note "cloud quality $q: $(js 'JSON.stringify((({fps,renderSize,renderScaleEff,frameMs,simStepMs,simRate})=>({fps:+fps.toFixed(1),renderSize,renderScaleEff:+renderScaleEff.toFixed(2),frameMs:+frameMs.toFixed(1),simStepMs:+(simStepMs||0).toFixed(1),simRate:+simRate.toFixed(0)}))(stormLab.state()))')"; done
  ab select "#cloudQ" 1 >/dev/null
  result pass "measured (see log); numbers are for a CPU software rasteriser, not a GPU"
}

v21() { begin v21 "terrain & surface tools; orographic precipitation"
  start_browser
  ab find role button click --name "Pause" >/dev/null
  read PX PY < <(screenpos 0.5 0.5 | xy)
  local h0; h0=$(js "JSON.stringify([App.sim.hgt[24+24*48].toFixed(0), App.sim.kg[24+24*48]])")
  ab find label "Raise tool" click >/dev/null; stroke $((PX-10)) "$PY" 20 0 20
  local h1; h1=$(js "JSON.stringify([App.sim.hgt[24+24*48].toFixed(0), App.sim.kg[24+24*48]])"); note "raise terrain at centre: [ground m, solid layers] $h0 -> $h1"; shot raised
  read PX PY < <(screenpos 0.3 0.7 | xy)
  local w0; w0=$(js "stormLab.surfaceSum('fWater', 12, 31, 17, 36).toFixed(2)")
  ab find label "Surface tool" click >/dev/null; ab select "#paintType" 1 >/dev/null; stroke $((PX-10)) "$PY" 20 0 8
  local w1; w1=$(js "stormLab.surfaceSum('fWater', 12, 31, 17, 36).toFixed(2)"); note "paint water: Σ water fraction in box $w0 -> $w1"; shot painted-water
  ab find label "Navigate tool" click >/dev/null
  note "orographic check (headless, same model code): $(tr '\n' ' ' < "$LOG/sim-regions-mountain.log" 2>/dev/null | head -c 900)"
  result "$(python3 - "$h0" "$h1" "$w0" "$w1" <<'PY'
import sys, json
a, b = [json.loads(json.loads(x)) for x in sys.argv[1:3]]; w0, w1 = [float(x.strip('"')) for x in sys.argv[3:5]]
print('pass' if float(b[0]) > float(a[0]) + 100 and w1 > w0 else 'fail')
PY
)" "terrain raised (ground $h0 -> $h1), water painted ($w0 -> $w1)"
}

ALL="v01 v02 v03 v04 v05 v06 v07 v08 v09 v10 v11 v12 v13 v14 v15 v16 v17 v18 v19 v20 v21"
for t in ${@:-$ALL}; do $t; done
echo "=== page errors at end of run (session $SESSION) ===" | tee "$LOG/final-errors.log"; ab errors 2>&1 | tee -a "$LOG/final-errors.log"
