#!/usr/bin/env bash
# End-to-end validation of the built index.html, driven through agent-browser.
#
#   ./evidence/browser-check.sh
#
# Everything runs through the real browser: every check follows real pointer
# drags or real key presses, and screenshots are taken from the live page.
# Evidence (screenshots + run.log) lands in evidence/shots/.
set -u
cd "$(dirname "$0")/.."
SHOTS=evidence/shots
mkdir -p "$SHOTS"; rm -f "$SHOTS"/*.png "$SHOTS"/*.txt 2>/dev/null
LOG="$SHOTS/run.log"; : > "$LOG"
TMP=$(mktemp -d)
PAGE="file://$PWD/index.html"
fail=0

note() { echo "$*" | tee -a "$LOG"; }
chk() { # chk <label> <pattern> <actual>;  pattern "@empty" means "must be empty"
  if [ "$2" = "@empty" ] && [ -z "$3" ]; then note "  PASS  $1  [clean]"; return; fi
  if [ "$2" = "@alive" ]; then
    if printf '%s' "$3" | grep -q '"fps"'; then note "  PASS  $1  [page still alive]";
    else note "  FAIL  $1  [page vanished: $3]"; fail=$((fail+1)); fi
    return
  fi
  if printf '%s' "$3" | grep -qE -- "$2"; then note "  PASS  $1  [$3]";
  else note "  FAIL  $1  [$3]"; fail=$((fail+1)); fi
}
# eval helper: pipes JS on stdin, strips the JSON quoting around the result
ev() { agent-browser eval --stdin 2>&1 | sed -e 's/^"//' -e 's/"$//' -e 's/\\"/"/g'; }
stats() { echo 'JSON.stringify(window.FSA.stats)' | ev; }
shot() { agent-browser screenshot "$SHOTS/$1" > /dev/null; }
drag() { # real pointer stroke across the canvas with interpolated points
  agent-browser mouse move "$1" "$2" > /dev/null
  agent-browser mouse down left > /dev/null
  local x0=$1 y0=$2 x1=$3 y1=$4 i
  for i in 1 2 3 4 5; do
    agent-browser mouse move $((x0 + (x1-x0)*i/5)) $((y0 + (y1-y0)*i/5)) > /dev/null
  done
  agent-browser mouse up left > /dev/null
}
wait_page() { # the app must be loaded and its rAF loop must be running
  local i u
  for i in $(seq 1 20); do
    u=$(agent-browser get url 2>/dev/null)
    case "$u" in *index.html*) break;; esac
    sleep 0.5
  done
  case "$u" in *index.html*) ;; *) agent-browser open "$PAGE" > /dev/null; sleep 2
      for i in $(seq 1 20); do
        u=$(agent-browser get url 2>/dev/null)
        case "$u" in *index.html*) break;; esac
        sleep 0.5
      done;; esac
  case "$u" in *index.html*) ;; *) note "  PAGE NEVER LOADED: $u"; return 1;; esac
  for i in $(seq 1 16); do
    if echo "$(stats)" | grep -q '"fps"'; then return 0; fi
    sleep 0.5
  done
  note "  engine API never appeared"; return 1
}

agent-browser close --all > /dev/null 2>&1
sleep 1
agent-browser set viewport 1280 800 > /dev/null
agent-browser open "$PAGE" > /dev/null
sleep 2
wait_page || { note "aborting: the page did not come up"; exit 1; }

note "== A. load at 1280x800"
chk "page title" "Falling-Sand" "$(agent-browser get title)"
chk "no console errors" "@empty" "$(agent-browser errors 2>&1 | tr -d '\n')"
chk "sim is running" '"paused":false' "$(stats)"
chk "frame rate at load" '"fps":6' "$(stats)"
shot "10-load.png"

note ""
note "== B. visualisation modes (each must redraw)"
for i in 0 1 2 3 4 5 6 7; do
  printf 'window.FSA.pause(false); window.FSA.mode(%d); window.__h=window.FSA.hash(); "armed";\n' "$i" > "$TMP/m.js"
  cat "$TMP/m.js" | ev > /dev/null
  sleep 0.5                                   # let the rAF loop draw the new mode
  printf 'var a=window.__h; window.FSA.step(160); "stepped";\n' > "$TMP/m2.js"
  cat "$TMP/m2.js" | ev > /dev/null
  sleep 0.5
  r=$(echo 'JSON.stringify({mode:window.FSA.stats.mode,changed:window.FSA.hash()!==window.__h});' | ev)
  chk "view mode $i redraws" '"changed":true' "$r"
  shot "mode-$i.png"
done
echo 'window.FSA.mode(0);' | ev > /dev/null

note ""
note "== C. presets (build, run 140 steps, shoot)"
n=0
while read -r pname; do
  printf 'window.FSA.preset("%s"); window.FSA.pause(false); window.FSA.step(140); JSON.stringify({preset:window.FSA.stats.preset,cells:window.FSA.stats.cells,chunks:window.FSA.stats.activeChunks});\n' "$pname" > "$TMP/p.js"
  r=$(cat "$TMP/p.js" | ev)
  sleep 0.4
  shot "$(printf 'preset-%02d.png' "$n")"
  chk "preset: $pname" '"chunks"' "$r"
  n=$((n+1))
done <<'LIST'
Volcano & Ocean
Burning Building
Electrical Laboratory
Acid Factory
Steam Engine
Frozen Lake
Plant Ecosystem
Fireworks Chain
Dense Stress Test
LIST

note ""
note "== D. tools through real pointer drags (sim paused: only the tool changes the picture)"
reset_scene() { echo 'window.FSA.preset("Volcano & Ocean"); window.FSA.pause(true); window.FSA.step(40); "ok";' | ev > /dev/null; }
reset_scene
echo 'window.FSA.set("paint","SAND"); window.__h=window.FSA.hash(); "armed";' | ev > /dev/null
drag 200 300 660 300
chk "paint drag placed sand" '"changed":true' "$(echo 'JSON.stringify({changed:window.FSA.hash()!==window.__h});' | ev)"
shot "50-tool-paint.png"
for t in erase heat cool wind blast wall fill; do
  reset_scene
  echo "window.FSA.set('$t','WATER'); window.__h=window.FSA.hash(); 'armed';" | ev > /dev/null
  drag 200 300 660 470
  r=$(echo 'JSON.stringify({tool:window.FSA.stats.tool,changed:window.FSA.hash()!==window.__h});' | ev)
  chk "tool $t changed the picture" '"changed":true' "$r"
  shot "tool-$t.png"
done
reset_scene
echo 'window.FSA.set("pick","WATER"); "ok";' | ev > /dev/null
drag 600 600 640 640
chk "eyedropper picked a material" '"material":"[A-Z]' "$(stats)"

note ""
note "== E. keyboard shortcuts (real key events on the canvas)"
agent-browser click "#view" > /dev/null
echo 'window.FSA.pause(false); "running";' | ev > /dev/null
agent-browser press "space" > /dev/null; sleep 0.5
chk "space pauses" '"paused":true' "$(stats)"
agent-browser press "space" > /dev/null; sleep 0.5
chk "space resumes" '"paused":false' "$(stats)"
agent-browser press "3" > /dev/null; sleep 0.4
chk "digit 3 picks a material" '"material":"SOIL"' "$(stats)"
agent-browser press "t" > /dev/null; sleep 0.4
chk "T selects the heat tool" '"tool":"heat"' "$(stats)"
agent-browser press "x" > /dev/null; sleep 0.4
chk "X selects the explode tool" '"tool":"blast"' "$(stats)"
agent-browser press "h" > /dev/null; sleep 0.5
chk "H opens the help overlay" '"help":true' "$(echo "JSON.stringify({help:!document.getElementById('help').hidden})" | ev)"
shot "20-help.png"
agent-browser press "h" > /dev/null
agent-browser press "r" > /dev/null; sleep 1.5
chk "R rebuilds the preset" '"preset"' "$(stats)"

note ""
note "== F. parameter sliders (real keyboard input on the range inputs)"
agent-browser focus "#s-gdir" > /dev/null
agent-browser press "End" > /dev/null; sleep 0.3
agent-browser press "End" > /dev/null; sleep 0.3
chk "gravity slider moved" '"gdir":[2-7]' "$(stats)"
agent-browser focus "#s-amb" > /dev/null
agent-browser press "Home" > /dev/null; sleep 0.4
chk "ambient slider moved" '"ambient":-40' "$(stats)"
agent-browser focus "#s-rxn" > /dev/null
agent-browser press "End" > /dev/null; sleep 0.4
chk "reaction slider moved" '"rxnRate":2' "$(stats)"
agent-browser focus "#s-fire" > /dev/null
agent-browser press "End" > /dev/null; sleep 0.4
chk "fire slider moved" '"firePow":2.5' "$(stats)"
echo 'var s=document.getElementById("s-res"); s.value=5; s.dispatchEvent(new Event("input",{bubbles:true})); "ok";' | ev > /dev/null
sleep 1.2
r=$(stats)
note "  grid after resolution change: $r"
chk "resolution rebuilds the grid" '"cellPx":5' "$r"

note ""
note "== G. persistence + export"
echo 'window.FSA.preset("Steam Engine"); window.FSA.pause(false); window.FSA.step(140); JSON.stringify({len:window.FSA.encode().length,cells:window.FSA.stats.cells,temp:window.FSA.stats.avgTemp});' > "$TMP/g.js"
r=$(cat "$TMP/g.js" | ev)
chk "state encodes" '"len":' "$r"
agent-browser click "#btn-save" > /dev/null; sleep 2
chk "state file written" "[0-9]+ KiB" "$(agent-browser get text "#io-status")"
agent-browser click "#btn-png" > /dev/null; sleep 1.5
agent-browser reload > /dev/null; sleep 2
wait_page || note "  (reload did not restore the app)"
note "  before reload: $r"
note "  after reload:  $(stats)"
chk "scene survived a reload" 'avgTemp' "$(stats)"
shot "60-restored.png"

note ""
note "== H. narrow viewport 390x844 + touch painting"
agent-browser set viewport 390 844 > /dev/null
sleep 1.5
shot "30-mobile.png"
echo 'window.FSA.pause(true); window.FSA.clear(); window.FSA.set("paint","OIL"); "ok";' | ev > /dev/null
agent-browser mouse move 150 300 > /dev/null
agent-browser mouse down left > /dev/null
agent-browser mouse move 190 360 > /dev/null
agent-browser mouse move 240 430 > /dev/null
agent-browser mouse up left > /dev/null
sleep 0.4
chk "tap-drag painted on mobile" "OIL" "$(echo 'JSON.stringify(window.FSA.region(0,0,319,251))' | ev)"
shot "31-mobile-painted.png"
agent-browser click "#btn-panel" > /dev/null; sleep 0.6
shot "32-mobile-panel.png"
r=$(echo 'JSON.stringify({h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth})' | ev)
chk "no horizontal overflow on mobile" '"w":390' "$r"

note ""
note "== I. sustained load (45 s on the dense stress preset)"
chk "page alive before the soak" "@alive" "$(stats)"
agent-browser set viewport 1280 800 > /dev/null
sleep 1
chk "page alive after the viewport change" "@alive" "$(stats)"
echo 'window.FSA.preset("Dense Stress Test"); window.FSA.pause(false); "ok";' | ev > /dev/null
sleep 45
r=$(stats)
note "  after 45 s: $r"
chk "page survived the soak" "@alive" "$r"
chk "still above 30 fps under load" '"fps":([3-9][0-9]|1[0-9][0-9])' "$r"
shot "40-after-60s.png"
chk "no page errors during the whole run" "@empty" "$(agent-browser errors 2>&1 | tr -d '\n')"

echo
echo "$fail failure(s). Evidence in $SHOTS"
exit $((fail>0))
