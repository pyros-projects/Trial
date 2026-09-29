#!/usr/bin/env bash
# Compact regression against the delivered index.html (agent-browser 0.31.1).
# Serve:  python3 -m http.server 18931 --bind 127.0.0.1   (from the project dir)
# PULSE_SERVER points at a dead socket so headless Chrome uses its null audio sink
# (the WSLg RDP sink back-pressures and makes AudioContext time crawl).
set -u
cd "$(dirname "$0")/../.."
H=evidence/harness
export AGENT_BROWSER_SESSION=rbh-regress PULSE_SERVER=unix:/nonexistent/pulse
ab(){ agent-browser "$@"; }
ab open about:blank >/dev/null; ab network route 'https://**' --abort >/dev/null; ab set viewport 1280 800 >/dev/null
ab navigate http://127.0.0.1:18931/index.html >/dev/null
echo "[1] page errors after load:"; ab errors
ab find role button click --name "Enable audio" >/dev/null
for f in probe sync timing labmeasure; do ab eval --stdin < $H/$f.js >/dev/null; done
echo "[2] audio: $(ab eval 'SYNCOPATH.audio.state')"
ab select "#mDiff" easy >/dev/null; ab select "#mPhase" 0 >/dev/null
echo "[3] story run: move / focus / on-beat dash / pause-resume"
ab batch "find role button click --name 'Start run'" "wait 2600" "keydown ArrowLeft" "wait 400" "keyup ArrowLeft" "eval __q()" \
  "keydown Shift" "keydown ArrowRight" "wait 400" "keyup ArrowRight" "keyup Shift" "eval __q()" \
  "wait --fn __rdy(40)" "press Space" "wait 50" "eval __q()" \
  "eval __sync(1)" "press Escape" "wait 2000" "eval __sync(2)" "press Escape" "wait 1500" "eval __sync(3)" 2>&1 | grep -v '^✓\|^$\|^true$\|^false$'
ab screenshot evidence/screenshots/90-regress-run.png >/dev/null
echo "[4] restart from pause (R) resets tick with same seed:"
ab batch "press Escape" "wait 150" "press KeyR" "wait 400" "eval __q()" 2>&1 | grep -v '^✓\|^$'
ab batch "press Escape" "wait 150" "click #btnQuit" >/dev/null 2>&1
echo "[5] lab: preset, grid edit, tempo change"
ab click "#btnLab" >/dev/null; ab select "#lPreset" 1 >/dev/null; ab eval "__hookLab()" >/dev/null
ab select "#lSub" 3 >/dev/null; ab click "#gClear" >/dev/null
ab click '[aria-label="Layer A step 1"]' >/dev/null; ab click '[aria-label="Layer B step 9"]' >/dev/null
T1=$(ab eval "SYNCOPATH.sim.tick"); sleep 6; echo "  grid: $(ab eval "__labSummary($T1 + 300)")"
ab focus "#lBpm" >/dev/null; ab batch "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" "press ArrowRight" >/dev/null
T2=$(ab eval "SYNCOPATH.sim.tick"); sleep 6; echo "  tempo: $(ab eval "__labSummary($T2 + 360)")"
echo "[6] quit (saves replay) -> Replays -> export -> verify"
ab batch "press Escape" "wait 150" "click #btnQuit" >/dev/null 2>&1
ab click "#btnReplays" >/dev/null; ab click "#rpExport" >/dev/null; echo "  $(ab eval "document.getElementById('rpOut').textContent")"
ab click "#rpVerify" >/dev/null; sleep 1.5; echo "  $(ab eval "document.getElementById('rpOut').textContent")"
ab press Escape >/dev/null
echo "[7] narrow viewport 390x844"
ab set viewport 390 844 >/dev/null; sleep 0.5; ab click "#btnStart" >/dev/null; sleep 3
echo "  arena: $(ab eval 'JSON.stringify(SYNCOPATH.R.arena)')"; ab screenshot evidence/screenshots/91-regress-narrow.png >/dev/null
echo "[8] page errors / console errors at end:"; ab errors; ab console | grep -i "error" | head -5
echo "[9] network requests:"; ab network requests | head -5
ab close >/dev/null
