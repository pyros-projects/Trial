#!/usr/bin/env bash
# Browser validation suite for ../../index.html, driven through agent-browser (Chromium via CDP).
# Every interaction is real browser input: CDP mouse/keyboard/touch events, role+name clicks, native
# <select> selection and Home/End/Arrow keys on focused range inputs. window.fluidDebug.snapshot()
# is read-only and used only to observe live simulation state (stats are GPU readbacks).
#
# Usage: evidence/scripts/run-validation.sh [check ...]      e.g.  run-validation.sh v04 v09
# Output: stdout (tee'd by the caller into evidence/logs/), screenshots in evidence/screenshots/.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EV="$ROOT/evidence"; S="$EV/screenshots"; SC="$EV/scripts"
mkdir -p "$S" "$EV/logs"
export AGENT_BROWSER_SESSION="${AGENT_BROWSER_SESSION:-fluidval}"
URL="file://$ROOT/index.html"

PX() { uv run -q --with pillow python "$SC/pixels.py" "$@"; }
js() { agent-browser eval "(() => { const s = fluidDebug.snapshot(); return JSON.stringify($1); })()" | python3 -c 'import sys,json; print(json.loads(sys.stdin.read()))'; }
waitsim() { agent-browser wait --fn "fluidDebug.snapshot().simTime > $1" --timeout 180000 >/dev/null; }
waitstats() { local f; f=$(agent-browser eval "fluidDebug.snapshot().frame" | tr -d '"'); agent-browser wait --fn "fluidDebug.snapshot().frame > $f + 4" --timeout 60000 >/dev/null; agent-browser wait 300 >/dev/null; }
drag() { python3 "$SC/drag.py" "$@" | agent-browser batch --bail >/dev/null; }
slider() { agent-browser focus "#$1" >/dev/null; agent-browser press "$2" >/dev/null; }
btn() { agent-browser find role button click --name "$1" >/dev/null; }
radio() { agent-browser find role radio click --name "$1" >/dev/null; }
shot() { agent-browser screenshot "$S/$1" >/dev/null; echo "screenshot: evidence/screenshots/$1"; }
fresh() {
  agent-browser set viewport "${VW:-1280}" "${VH:-800}" >/dev/null
  agent-browser open "$URL" >/dev/null
  agent-browser wait --fn "window.fluidDebug && fluidDebug.snapshot().frame > 3" --timeout 60000 >/dev/null
  agent-browser errors --clear >/dev/null; agent-browser console --clear >/dev/null
}
# Let the intro flow die out through the dissipation sliders, then restore defaults via the button.
quiet() { slider velocityDissipation End; slider dyeDissipation End; agent-browser wait 4500 >/dev/null
  agent-browser scrollintoview "#defaultsBtn" >/dev/null; btn "Defaults"; waitstats
  echo "quiet(): params back to defaults = $(js "s.params.velocityDissipation === 0.15 && s.params.dyeDissipation === 0.1")"; }
hdr() { echo; echo "=== $1 ==="; }
# Stop whatever listens on the validation port (by socket owner, never by command-line pattern).
stop_server() { local pids; pids=$(ss -ltnpH 'sport = :8765' 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2); [ -n "$pids" ] && kill $pids 2>/dev/null; true; }
errs() { echo "page errors: [$(agent-browser errors 2>&1 | tr '\n' ' ')]"; echo "console: [$(agent-browser console 2>&1 | tr '\n' ' ')]"; }

v01() { hdr "V01 direct file:// load, renderer, console, network"
  fresh
  agent-browser get title
  js "{url: location.href, running: s.running, renderer: s.renderer, sim: s.sim, dye: s.dye, canvas: s.canvas}"
  echo "network requests:"; agent-browser network requests 2>&1 | head -20
  errs; }

v02() { hdr "V02 local HTTP server, external network blocked (dead proxy; Chrome bypasses proxies for loopback)"
  stop_server; (cd "$ROOT" && nohup uv run -q python -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &); sleep 2
  agent-browser --session http --proxy http://127.0.0.1:9 set viewport 1280 800 >/dev/null
  agent-browser --session http open "http://127.0.0.1:8765/index.html" >/dev/null
  agent-browser --session http wait --fn "window.fluidDebug && fluidDebug.snapshot().simTime > 1.5" --timeout 120000 >/dev/null
  echo "app over HTTP: $(agent-browser --session http eval "(() => { const s = fluidDebug.snapshot(); return JSON.stringify({running: s.running, simTime: +s.simTime.toFixed(2), dye: s.stats.dye}); })()")"
  echo "network requests:"; agent-browser --session http network requests 2>&1 | head -20
  echo "page errors: [$(agent-browser --session http errors 2>&1 | tr '\n' ' ')]"
  echo "external reachability probe (navigate same session to https://example.com, expected to FAIL):"
  agent-browser --session http open https://example.com 2>&1 | tail -1
  agent-browser --session http close >/dev/null; stop_server; }

v03() { hdr "V03 intro motion without configuration"
  fresh; waitsim 1.0; shot v03-intro-t1.png; js "{t: +s.simTime.toFixed(2), dye: s.stats.dye, speed: s.stats.speed}"
  waitsim 4.0; shot v03-intro-t4.png; js "{t: +s.simTime.toFixed(2), dye: s.stats.dye, speed: s.stats.speed, residualPct: 100*s.stats.divPost/s.stats.divPre}"; }

v04() { hdr "V04 slow + rapid drags: direction, speed, persistence, advection"
  fresh; quiet
  js "{quiet_speedMax: s.stats.speedMax, quiet_dye: s.stats.dye}"
  drag 150 300 550 300 20 0            # slow, eastward, 20 px per event
  js "{after_slow: {speedMax: s.stats.speedMax, dye: s.stats.dye}}"
  echo "hud pointer (last): $(agent-browser get text '#hPtr')"
  shot v04-slow-dye.png; radio "Velocity 2"; agent-browser wait 400 >/dev/null; shot v04-slow-velocity.png; radio "Dye 1"
  echo "velocity-view colour under slow stroke (expect hue≈180 cyan = east): $(PX mean "$S/v04-slow-velocity.png" 300 285 500 315)"
  agent-browser wait 2000 >/dev/null; shot v04-slow-after2s.png
  js "{two_s_after_release: {speed: s.stats.speed, speedMax: s.stats.speedMax}}"
  echo "dye right of stroke end moved downstream (lit fraction x=560..760): before $(PX lit "$S/v04-slow-dye.png" 560 220 760 380) after $(PX lit "$S/v04-slow-after2s.png" 560 220 760 380)"
  drag 850 560 250 560 4 0             # rapid, westward, 150 px per event
  js "{after_rapid: {speedMax: s.stats.speedMax, dye: s.stats.dye}}"
  radio "Velocity 2"; agent-browser wait 400 >/dev/null; shot v04-rapid-velocity.png; radio "Dye 1"; shot v04-rapid-dye.png
  echo "velocity-view colour under rapid stroke (expect hue≈0/360 red = west): $(PX mean "$S/v04-rapid-velocity.png" 350 545 650 575)"
  errs; }

v05() { hdr "V05 continuous rapid circular stroke (input continuity, drawn while PAUSED so advection can't move it)"
  fresh; quiet; btn "Pause"
  python3 - "$SC" <<'PY' | agent-browser batch --bail >/dev/null
import json, math, sys
cx, cy, r, n = 480, 400, 200, 28
c = [["mouse", "move", str(cx + r), str(cy)], ["mouse", "down", "left"]]
for i in range(1, n + 1):
    a = 2 * math.pi * i / n * 1.25
    c.append(["mouse", "move", str(round(cx + r * math.cos(a))), str(round(cy + r * math.sin(a)))])
c.append(["mouse", "up", "left"]); print(json.dumps(c))
PY
  waitstats; shot v05-circle-dye.png
  js "{paused: s.paused, dye: s.stats.dye}"
  # sample 12 points on the ring: every sample should be lit (no gaps between pointer events)
  for k in 0 1 2 3 4 5 6 7 8 9 10 11; do
    python3 -c "import math; a=2*math.pi*$k/12; print(round(480+200*math.cos(a))-6, round(400+200*math.sin(a))-6, round(480+200*math.cos(a))+6, round(400+200*math.sin(a))+6)" | { read x0 y0 x1 y1; echo "ring sample $k: $(PX mean "$S/v05-circle-dye.png" $x0 $y0 $x1 $y1)"; }
  done
  btn "Resume"; agent-browser wait 2500 >/dev/null; shot v05-circle-after-resume.png
  js "{resumed: {speedMax: s.stats.speedMax, curlMax: s.stats.curlMax, dye: s.stats.dye}}"
  radio "Vorticity 6"; agent-browser wait 400 >/dev/null; shot v05-circle-vorticity.png; radio "Dye 1"
  errs; }

v06() { hdr "V06 switch every visualization mode while running"
  fresh; waitsim 1.5
  for m in "Velocity 2" "Speed 3" "Pressure 4" "Divergence 5" "Vorticity 6" "Dye 1"; do
    radio "$m"; agent-browser wait 500 >/dev/null
    n=$(echo "$m" | tr ' ' '-'); shot "v06-mode-$n.png"
    js "{mode: s.mode, running: !s.paused, simTime: +s.simTime.toFixed(2), steps: s.steps, dye: +s.stats.dye.toFixed(3)}"
    echo "legend: $(agent-browser get text '#lgTitle') | hud view: $(agent-browser get text '#hMode')"
  done
  echo "keyboard 1-6:"; for k in 2 3 4 5 6 1; do agent-browser press $k >/dev/null; echo -n "$k→$(js 's.mode') "; done; echo
  errs; }

ab_run() { # $1 slider id, $2 key (Home/End), $3 label; reset, wait for the intro to develop, measure
  slider "$1" "$2"; btn "Reset"; waitsim 3.5
  echo "$3: $(js "{t: +s.simTime.toFixed(2), param: s.params.$1, curlMax: +s.stats.curlMax.toFixed(1), speed: +s.stats.speed.toFixed(4), speedMax: +s.stats.speedMax.toFixed(3)}")"
  shot "v-ab-$1-$2.png"; radio "Vorticity 6"; agent-browser wait 400 >/dev/null; shot "v-ab-$1-$2-vort.png"; radio "Dye 1"; }

v07() { hdr "V07 viscosity low vs high (same intro, same sim time)"
  fresh; ab_run viscosity Home "viscosity=0"; ab_run viscosity End "viscosity=max (nu=5e-3)"; btn "Defaults"; errs; }

v08() { hdr "V08 vorticity confinement off vs max"
  fresh; ab_run vorticity Home "epsilon=0"; ab_run vorticity End "epsilon=40"; btn "Defaults"; errs; }

v09() { hdr "V09 clear dye keeps the velocity field"
  fresh; waitsim 2.5
  radio "Velocity 2"; agent-browser wait 300 >/dev/null; shot v09-velocity-before-clear.png; radio "Dye 1"; shot v09-dye-before-clear.png
  js "{before: {dye: s.stats.dye, speed: s.stats.speed, speedMax: s.stats.speedMax, steps: s.steps}}"
  btn "Clear dye"; waitstats
  js "{after_clear: {dye: s.stats.dye, speed: s.stats.speed, speedMax: s.stats.speedMax, steps: s.steps}}"
  shot v09-dye-after-clear.png; radio "Velocity 2"; agent-browser wait 300 >/dev/null; shot v09-velocity-after-clear.png; radio "Dye 1"
  echo "dye-view lit fraction after clear: $(PX lit "$S/v09-dye-after-clear.png" 280 300 940 790)"
  agent-browser wait 1500 >/dev/null; js "{t_plus_1_5s: {dye: s.stats.dye, speed: s.stats.speed}}"
  # new dye put into the retained flow is carried away by it
  drag 400 400 420 400 2 0; shot v09-new-dye-t0.png; agent-browser wait 1500 >/dev/null; shot v09-new-dye-t1.png
  echo "new dye patch moved: $(PX diff "$S/v09-new-dye-t0.png" "$S/v09-new-dye-t1.png" 250 250 650 650)"
  errs; }

v10() { hdr "V10 pause / step / resume"
  fresh; waitsim 1.5
  btn "Pause"; waitstats
  js "{paused: s.paused, steps: s.steps, simTime: s.simTime}"; shot v10-paused-a.png
  agent-browser wait 1500 >/dev/null
  js "{paused: s.paused, steps: s.steps, simTime: s.simTime}"; shot v10-paused-b.png
  echo "frozen frame difference over 1.5 s (canvas area, excl. HUD/panel): $(PX diff "$S/v10-paused-a.png" "$S/v10-paused-b.png" 280 300 940 700)"
  echo "hud state: $(agent-browser get text '#hState') | badge visible: $(agent-browser is visible '#pausedBadge') | button: $(agent-browser get text '#pauseLabel')"
  radio "Vorticity 6"; agent-browser wait 400 >/dev/null; shot v10-paused-mode-switch.png; radio "Dye 1"
  btn "Step"; agent-browser wait 400 >/dev/null; js "{after_step: {steps: s.steps, simTime: s.simTime}}"
  agent-browser press . >/dev/null; agent-browser wait 400 >/dev/null; js "{after_key_step: {steps: s.steps}}"
  btn "Resume"; agent-browser wait 1500 >/dev/null; js "{resumed: {paused: s.paused, steps: s.steps, simTime: s.simTime}}"
  agent-browser press Space >/dev/null; agent-browser wait 300 >/dev/null; js "{space_toggles: s.paused}"; agent-browser press Space >/dev/null
  errs; }

v11() { hdr "V11 reset restores a valid initial state"
  fresh; waitsim 3; drag 300 300 900 500 8 0
  js "{before_reset: {simTime: +s.simTime.toFixed(2), steps: s.steps, dye: s.stats.dye}}"
  btn "Reset"; agent-browser wait 150 >/dev/null
  js "{right_after_reset: {simTime: +s.simTime.toFixed(3), emitters: s.emitters}}"
  shot v11-after-reset-t0.png
  waitsim 2.0; shot v11-after-reset-t2.png
  js "{t2: {simTime: +s.simTime.toFixed(2), dye: s.stats.dye, speed: s.stats.speed, residualPct: 100*s.stats.divPost/s.stats.divPre, finite: [s.stats.dye, s.stats.speed, s.stats.pressureMax, s.stats.curlMax].every(Number.isFinite)}}"
  errs; }

v12() { hdr "V12 resolution selects (sim grid and dye grid)"
  fresh; waitsim 2
  for r in 64 128 512 256; do agent-browser select "#resolution" "$r" >/dev/null; waitstats; echo "sim grid $r → $(js "{sim: s.sim, hud: document.getElementById('hGrid').textContent, dye: +s.stats.dye.toFixed(3), speed: +s.stats.speed.toFixed(4)}")"; done
  for r in 512 2048 1024; do agent-browser select "#dyeResolution" "$r" >/dev/null; waitstats; echo "dye grid $r → $(js "{dye: s.dye, dyeMass: +s.stats.dye.toFixed(3)}")"; done
  agent-browser select "#resolution" "64" >/dev/null; waitstats; shot v12-sim64.png; agent-browser select "#resolution" "256" >/dev/null
  errs; }

v13() { hdr "V13 time scale changes simulated time per real time"
  fresh
  for key in Home End; do
    slider timeScale "$key"; agent-browser wait 300 >/dev/null
    a=$(js "s.simTime"); agent-browser wait 2000 >/dev/null; b=$(js "s.simTime")
    echo "timeScale=$(js 's.params.timeScale'): simTime advanced $(python3 -c "print(round($b-$a,3))") s in ~2 s wall (SwiftShader fps limits dt to <=1/15 s per frame)"
  done
  btn "Defaults"; errs; }

v14() { hdr "V14 pressure solver + iterations → incompressibility residual"
  fresh; waitsim 2
  radio "Jacobi"; slider pressureIterations Home; agent-browser wait 1500 >/dev/null; echo "Jacobi x1:   residual $(agent-browser get text '#hDiv')"
  slider pressureIterations End; agent-browser wait 1500 >/dev/null; echo "Jacobi x150: residual $(agent-browser get text '#hDiv')"
  radio "Multigrid"; slider pressureCycles Home; agent-browser wait 1500 >/dev/null; echo "Multigrid 1 V-cycle: residual $(agent-browser get text '#hDiv')"
  slider pressureCycles End; agent-browser wait 1500 >/dev/null; echo "Multigrid 8 V-cycles: residual $(agent-browser get text '#hDiv')"
  shot v14-mg8.png
  radio "Divergence 5"; agent-browser wait 400 >/dev/null; shot v14-divergence-view.png; radio "Pressure 4"; agent-browser wait 400 >/dev/null; shot v14-pressure-view.png; radio "Dye 1"
  btn "Defaults"; errs; }

v15() { hdr "V15 velocity + dye dissipation"
  fresh; waitsim 2
  js "{t0: {speed: s.stats.speed, dye: s.stats.dye}}"
  slider velocityDissipation End; agent-browser wait 2500 >/dev/null; js "{velocityDissipation_max_2_5s: {speed: s.stats.speed, dye: s.stats.dye}}"
  btn "Defaults"; btn "Splash"; waitstats; js "{after_splash: {speed: s.stats.speed, dye: s.stats.dye}}"
  slider dyeDissipation End; agent-browser wait 2500 >/dev/null; js "{dyeDissipation_max_2_5s: {speed: s.stats.speed, dye: s.stats.dye}}"
  btn "Defaults"; errs; }

v16() { hdr "V16 interaction force and radius"
  fresh; quiet
  slider force Home; drag 200 400 800 400 6 0; waitstats; js "{force0: {speedMax: s.stats.speedMax, dye: s.stats.dye}}"; shot v16-force0.png
  btn "Defaults"; quiet
  slider force End; drag 200 400 800 400 6 0; waitstats; js "{force5: {speedMax: s.stats.speedMax, dye: s.stats.dye}}"
  btn "Defaults"; quiet
  slider radius End; agent-browser mouse move 640 420 >/dev/null; agent-browser wait 200 >/dev/null
  echo "ring diameter at radius=max: $(agent-browser eval "getComputedStyle(document.getElementById('ring')).width")"
  drag 200 400 800 400 6 0; shot v16-radius-max.png; echo "lit fraction (radius max): $(PX lit "$S/v16-radius-max.png" 150 250 850 550)"
  btn "Defaults"; quiet; slider radius Home; agent-browser mouse move 640 420 >/dev/null; agent-browser wait 200 >/dev/null
  echo "ring diameter at radius=min: $(agent-browser eval "getComputedStyle(document.getElementById('ring')).width")"
  drag 200 400 800 400 6 0; shot v16-radius-min.png; echo "lit fraction (radius min): $(PX lit "$S/v16-radius-min.png" 150 250 850 550)"
  btn "Defaults"; errs; }

v17() { hdr "V17 dye colour controls"
  fresh; quiet
  btn "Use fixed dye colour #ffe04a"; js "{colorMode: s.params.colorMode, dyeColor: s.params.dyeColor}"
  drag 200 350 700 350 10 0; shot v17-fixed-yellow.png
  echo "stroke colour (expect yellow hue≈50): $(PX mean "$S/v17-fixed-yellow.png" 380 335 560 365)"
  btn "Use fixed dye colour #2fd6ff"; drag 200 550 700 550 10 0; shot v17-fixed-cyan.png
  echo "stroke colour (expect cyan hue≈190): $(PX mean "$S/v17-fixed-cyan.png" 380 535 560 565)"
  radio "Random"; drag 900 200 900 700 8 0; radio "Rainbow"; drag 1000 700 1000 200 8 0; shot v17-random-rainbow.png
  js "{colorMode: s.params.colorMode}"; btn "Defaults"; errs; }

v18() { hdr "V18 keyboard shortcuts"
  fresh; waitsim 1
  agent-browser press s >/dev/null; waitstats; js "{after_S_splash: {dye: s.stats.dye}}"
  agent-browser press c >/dev/null; waitstats; js "{after_C_clear: {dye: s.stats.dye, speed: s.stats.speed}}"
  agent-browser press h >/dev/null; echo "after H: panel collapsed=$(agent-browser eval "document.getElementById('panel').classList.contains('collapsed')")"; shot v18-panel-hidden.png
  agent-browser press h >/dev/null; echo "after H again: collapsed=$(agent-browser eval "document.getElementById('panel').classList.contains('collapsed')")"
  agent-browser press r >/dev/null; agent-browser wait 150 >/dev/null; js "{after_R_reset: {simTime: +s.simTime.toFixed(3)}}"
  errs; }

v19() { hdr "V19 viewports: 1280x800, 390x844 (DPR 3 capped to 2), live resize"
  VW=1280 VH=800 fresh; waitsim 3; shot v19-desktop-1280x800.png
  js "{css: s.css, canvas: s.canvas, dpr: s.dpr, sim: s.sim, dye: s.dye}"
  for vp in "1600 900" "900 700" "1280 800 2"; do agent-browser set viewport $vp >/dev/null; waitstats; echo "resize $vp → $(js "{css: s.css, canvas: s.canvas, dpr: s.dpr, sim: s.sim, dye: s.dye, dyeMass: +s.stats.dye.toFixed(3)}")"; done
  agent-browser set viewport 1280 800 1 >/dev/null
  agent-browser set viewport 390 844 3 >/dev/null; agent-browser open "$URL" >/dev/null; agent-browser wait --fn "fluidDebug.snapshot().simTime > 3" --timeout 120000 >/dev/null
  shot v19-mobile-390x844.png; js "{css: s.css, canvas: s.canvas, dpr: s.dpr, sim: s.sim, dye: s.dye, panelCollapsed: document.getElementById('panel').classList.contains('collapsed')}"
  btn "Controls"; agent-browser wait 300 >/dev/null; shot v19-mobile-controls-open.png
  echo "no horizontal overflow: $(agent-browser eval "document.documentElement.scrollWidth <= innerWidth")"
  btn "Pause"; js "{paused_on_mobile: s.paused}"; btn "Resume"; btn "Hide"
  agent-browser set viewport 1280 800 1 >/dev/null; errs; }

v20() { hdr "V20 touch input via CDP Input.dispatchTouchEvent (390x844)"
  agent-browser set viewport 390 844 2 >/dev/null; agent-browser open "$URL" >/dev/null; agent-browser wait --fn "fluidDebug.snapshot().frame > 3" --timeout 60000 >/dev/null
  btn "Controls"; quiet; btn "Hide"          # the compact panel starts collapsed on phones
  js "{quiet_before_touch: {dye: s.stats.dye, speedMax: s.stats.speedMax, panelCollapsed: document.getElementById('panel').classList.contains('collapsed')}}"
  WS=$(agent-browser get cdp-url)
  node "$SC/touch-drag.mjs" "$WS" one; shot v20-touch-one.png
  node "$SC/touch-drag.mjs" "$WS" two; shot v20-touch-two.png
  agent-browser set viewport 1280 800 1 >/dev/null; errs; }

v21() { hdr "V21 WebGL context loss + restore"
  fresh; waitsim 1.5
  agent-browser eval --stdin < "$SC/context-loss.js"; shot v21-after-restore.png; errs; }

v22() { hdr "V22 capability fallbacks (fresh sessions with init scripts)"
  agent-browser --session fb1 set viewport 1280 800 >/dev/null
  agent-browser --session fb1 open --init-script "$SC/no-webgl2.js" "$URL" >/dev/null
  agent-browser --session fb1 wait --fn "window.fluidDebug && fluidDebug.snapshot().simTime > 2" --timeout 120000 >/dev/null
  echo "WebGL2 hidden → $(agent-browser --session fb1 eval "(() => { const s = fluidDebug.snapshot(); return JSON.stringify({running: s.running, renderer: s.renderer, residualPct: 100*s.stats.divPost/s.stats.divPre}); })()")"
  echo "errors: [$(agent-browser --session fb1 errors 2>&1 | tr '\n' ' ')]"
  agent-browser --session fb1 screenshot "$S/v22-webgl1-fallback.png" >/dev/null; agent-browser --session fb1 close >/dev/null
  agent-browser --session fb0 set viewport 1280 800 >/dev/null
  agent-browser --session fb0 open --init-script "$SC/no-webgl.js" "$URL" >/dev/null; agent-browser --session fb0 wait 1000 >/dev/null
  echo "no WebGL → $(agent-browser --session fb0 eval "JSON.stringify({fatalVisible: !document.getElementById('fatal').hidden, title: document.getElementById('fatalTitle').textContent})")"
  agent-browser --session fb0 screenshot "$S/v22-no-webgl.png" >/dev/null; agent-browser --session fb0 close >/dev/null
  agent-browser --session fb2 set viewport 1280 800 >/dev/null
  agent-browser --session fb2 open --init-script "$SC/no-webgl2-no-linear.js" "$URL" >/dev/null
  agent-browser --session fb2 wait --fn "window.fluidDebug && fluidDebug.snapshot().simTime > 2" --timeout 120000 >/dev/null
  echo "WebGL1 without linear half-float filtering → $(agent-browser --session fb2 eval "(() => { const s = fluidDebug.snapshot(); return JSON.stringify({running: s.running, renderer: s.renderer, gpu: document.getElementById('hGpu').textContent, dye: s.stats.dye, speed: s.stats.speed, residualPct: 100*s.stats.divPost/s.stats.divPre}); })()")"
  echo "errors: [$(agent-browser --session fb2 errors 2>&1 | tr '\n' ' ')]"
  agent-browser --session fb2 screenshot "$S/v22-webgl1-manual-filtering.png" >/dev/null; agent-browser --session fb2 close >/dev/null; }

v23() { hdr "V23 frame-rate probe (rAF deltas) — SwiftShader CPU rasteriser, NOT a GPU"
  fresh; waitsim 2
  for cfg in "256 1024" "128 512" "64 256"; do set -- $cfg
    agent-browser select "#resolution" "$1" >/dev/null; agent-browser select "#dyeResolution" "$2" >/dev/null; agent-browser wait 800 >/dev/null
    echo "sim $1 / dye $2: $(agent-browser eval --stdin < "$SC/raf-probe.js")"
  done
  agent-browser select "#resolution" "256" >/dev/null; agent-browser select "#dyeResolution" "1024" >/dev/null; errs; }

ALL="v01 v02 v03 v04 v05 v06 v07 v08 v09 v10 v11 v12 v13 v14 v15 v16 v17 v18 v19 v20 v21 v22 v23"
for c in ${@:-$ALL}; do "$c"; done
echo; echo "=== done: ${*:-$ALL} ==="
