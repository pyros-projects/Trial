#!/usr/bin/env bash
# Scenario E: transport controls, determinism, save/load, error handling, autosave, PNG, resize, settings, keyboard.
source "$(dirname "$0")/lib.sh"
DL="$EVD/downloads"; mkdir -p "$DL"; rm -f "$DL"/*
fresh_open 1280 800 1
btn "Volcano & Ocean"; sleep 2
echo "== E1 pause / resume"
T0=$(ev 'alchemy.grid.tick'); btn "Pause"; T1=$(ev 'alchemy.grid.tick'); sleep 1.5; T2=$(ev 'alchemy.grid.tick')
echo "running tick $T0 -> paused at $T1 -> after 1.5s still $T2 ; HUD: $(ev 'document.getElementById("hud").innerText.split("\n")[0]')"
echo "== E2 single step (button and '.' key)"
btn "Single step"; A=$(ev 'alchemy.grid.tick'); agent-browser press . >/dev/null; B=$(ev 'alchemy.grid.tick'); echo "step button: $T2 -> $A ; '.' key: $A -> $B"
agent-browser press Space >/dev/null; sleep 1; echo "Space resumes: tick $(ev 'alchemy.grid.tick'), paused=$(ev 'alchemy.grid.paused')"; agent-browser press Space >/dev/null
echo "== E3 reset determinism (same seed => identical state after identical steps)"
btn "Reset scene"; sleep 0.2; H0=$(ev 'alchemy.hash()'); for k in $(seq 1 40); do agent-browser press . >/dev/null; done; HA=$(ev 'alchemy.hash()'); TA=$(ev 'alchemy.grid.tick')
btn "Reset scene"; sleep 0.2; H0b=$(ev 'alchemy.hash()'); for k in $(seq 1 40); do agent-browser press . >/dev/null; done; HB=$(ev 'alchemy.hash()'); TB=$(ev 'alchemy.grid.tick')
echo "initial hash $H0 / $H0b ; after 40 steps: $HA (tick $TA) vs $HB (tick $TB)"
agent-browser fill "#seed" 4242 >/dev/null; btn "Rebuild"; sleep 0.2; H42=$(ev 'alchemy.hash()'); echo "seed 4242 initial hash: $H42 seed=$(ev 'alchemy.grid.seed')"
agent-browser fill "#seed" 1337 >/dev/null; btn "Rebuild"; sleep 0.2; echo "seed 1337 again: $(ev 'alchemy.hash()') (expect $H0)"
agent-browser fill "#seed" 4242 >/dev/null; btn "Rebuild"; sleep 0.2; echo "seed 4242 again: $(ev 'alchemy.hash()') (expect $H42)"
agent-browser fill "#seed" 1337 >/dev/null; btn "Rebuild"; sleep 0.2
echo "== E4 clear"
btn "Clear grid"; echo "after clear: $(cnt)"; btn "Reset scene"; sleep 0.2; echo "after reset: hash $(ev 'alchemy.hash()') (initial was $H0)"
echo "== E5 save state -> modify -> load state"
for k in $(seq 1 25); do agent-browser press . >/dev/null; done
HS=$(ev 'alchemy.hash()'); TS=$(ev 'alchemy.grid.tick'); CS=$(ev 'JSON.stringify(alchemy.cell(150,150))')
agent-browser download "#btnSave" "$DL/state.json" >/dev/null 2>&1; ls -la "$DL/state.json"
python3 -c "import json,sys;d=json.load(open('$DL/state.json'));print('file:',d['format'],'v',d['version'],d['w'],'x',d['h'],'tick',d['tick'],'enc',d['enc'],'data chars',len(d['data']))"
btn "Clear grid"; btn "Water"; btn "Paint tool"; drag 50 50 250 50; echo "modified: hash $(ev 'alchemy.hash()') tick $(ev 'alchemy.grid.tick')"
agent-browser upload "#fileInput" "$DL/state.json" >/dev/null 2>&1; sleep 1
echo "loaded: hash $(ev 'alchemy.hash()') (saved $HS) tick $(ev 'alchemy.grid.tick') (saved $TS)"
echo "cell(150,150) saved $CS"; echo "cell(150,150) now   $(ev 'JSON.stringify(alchemy.cell(150,150))')"
echo "status: $(ev 'document.getElementById("fileStatus").textContent')"
echo "== E6 load invalid files (state must be unchanged)"
echo '{"format":"something-else"}' > "$DL/bad-format.json"; echo 'not json at all' > "$DL/garbage.json"
python3 -c "import json;d=json.load(open('$DL/state.json'));d['data']=d['data'][:1000];json.dump(d,open('$DL/truncated.json','w'))"
for f in bad-format.json garbage.json truncated.json; do agent-browser upload "#fileInput" "$DL/$f" >/dev/null 2>&1; sleep 0.8; echo "$f -> toast: $(ev 'document.getElementById("toast").innerText') | hash $(ev 'alchemy.hash()')"; done
shot E6-load-error-toast
echo "== E7 PNG export"
agent-browser download "#btnPng" "$DL/view.png" >/dev/null 2>&1; python3 -c "
import struct;b=open('$DL/view.png','rb').read();print('png signature ok:',b[:8]==b'\x89PNG\r\n\x1a\n','size',struct.unpack('>II',b[16:24]),'bytes',len(b))"
echo "== E8 autosave + reload"
btn "Resume"; sleep 11; TA=$(ev 'alchemy.grid.tick'); echo "status before reload: $(ev 'document.getElementById("fileStatus").textContent') tick $TA"
agent-browser reload >/dev/null 2>&1; sleep 2; echo "after reload: $(ev 'document.getElementById("fileStatus").textContent') tick $(ev 'alchemy.grid.tick') preset $(ev 'alchemy.grid.preset')"
shot E8-autosave-restored
echo "== E9 browser resize keeps content"
F0=$(ev '(()=>{const c=alchemy.counts();return Object.entries(c).filter(e=>e[0]!=="Air").reduce((a,e)=>a+e[1],0)})()'); D0=$(ev 'alchemy.grid.W+"x"+alchemy.grid.H')
agent-browser set viewport 1000 700 1 >/dev/null; sleep 1.5
F1=$(ev '(()=>{const c=alchemy.counts();return Object.entries(c).filter(e=>e[0]!=="Air").reduce((a,e)=>a+e[1],0)})()'); D1=$(ev 'alchemy.grid.W+"x"+alchemy.grid.H')
echo "grid $D0 -> $D1 ; filled cells $F0 -> $F1 ; overflow: $(ev 'document.documentElement.scrollWidth+"/"+innerWidth')"; shot E9-resized-1000x700
agent-browser set viewport 1280 800 1 >/dev/null; sleep 1.5
echo "== E10 resolution + gravity + speed"
agent-browser select "#cellSize" 5 >/dev/null; sleep 0.5; echo "Low (5px): grid $(ev 'alchemy.grid.W+"x"+alchemy.grid.H')"; agent-browser select "#cellSize" 3 >/dev/null; sleep 0.5; echo "High (3px): grid $(ev 'alchemy.grid.W+"x"+alchemy.grid.H')"
btn "Blank Canvas"; btn "Sand"; btn "Paint tool"; hold 150 200 1; sleep 1.5
SY0=$(ev '(()=>{let s=0,n=0;for(let i=0;i<alchemy.grid.W*alchemy.grid.H;i++){const x=i%alchemy.grid.W,y=(i/alchemy.grid.W)|0;if(alchemy.cell(x,y).type==="Sand"){s+=y;n++;}}return (s/n).toFixed(1);})()')
agent-browser select "#gravity" 1 >/dev/null; sleep 3
SY1=$(ev '(()=>{let s=0,n=0;for(let i=0;i<alchemy.grid.W*alchemy.grid.H;i++){const x=i%alchemy.grid.W,y=(i/alchemy.grid.W)|0;if(alchemy.cell(x,y).type==="Sand"){s+=y;n++;}}return (s/n).toFixed(1);})()')
echo "gravity up: sand mean y $SY0 -> $SY1"; shot E10-gravity-up; agent-browser select "#gravity" 0 >/dev/null
SPD=$(agent-browser snapshot -i | grep -E 'slider "Speed"' | sed -E 's/.*ref=(e[0-9]+).*/@\1/'); agent-browser focus "$SPD" >/dev/null
for k in $(seq 1 20); do agent-browser press ArrowRight >/dev/null; done; sleep 2.5; echo "speed $(ev 'document.getElementById("o-speed").textContent') -> tick/s $(ev 'alchemy.stats().tps')"
agent-browser press Home >/dev/null; sleep 2.5; echo "speed $(ev 'document.getElementById("o-speed").textContent') -> tick/s $(ev 'alchemy.stats().tps')"
for k in $(seq 1 18); do agent-browser press ArrowRight >/dev/null; done; sleep 1; echo "restored speed $(ev 'document.getElementById("o-speed").textContent')"
echo "== E11 keyboard shortcuts"
agent-browser press Escape >/dev/null; ev 'document.activeElement.blur()' >/dev/null
agent-browser press v >/dev/null; echo "V -> view $(ev 'document.getElementById("viewMode").value')"; agent-browser press V >/dev/null
agent-browser press 3 >/dev/null; echo "3 -> material $(ev 'document.querySelector("#matGrid .mat[aria-pressed=true]").getAttribute("aria-label")')"
agent-browser press h >/dev/null; echo "h -> tool $(ev 'document.querySelector("#toolGrid .btn[aria-pressed=true]").dataset.tool')"
agent-browser press "?" >/dev/null; echo "? -> help visible $(ev '!document.getElementById("help").hidden')"; shot E11-help; agent-browser press "?" >/dev/null
agent-browser press g >/dev/null; echo "g -> gravity $(ev 'document.getElementById("gravity").value')"; agent-browser press g >/dev/null; agent-browser press g >/dev/null; agent-browser press g >/dev/null; agent-browser press g >/dev/null; echo "g x5 -> gravity $(ev 'document.getElementById("gravity").value')"
echo "errors: $(agent-browser errors 2>&1 | head -3)"
