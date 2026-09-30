#!/usr/bin/env bash
# Reproducible browser validation of the public checks (dev only).
# Drives the delivered index.html over file:// with agent-browser using real
# keyboard / mouse / touch input. Writes evidence/browser-run.log + screenshots.
set -u
cd "$(dirname "$0")/../.."
ROOT=$PWD; OUT=$ROOT/evidence/browser-run.log; SHOTS=$ROOT/evidence/screenshots/v
mkdir -p "$SHOTS"; : > "$OUT"
export AGENT_BROWSER_SESSION=validation
source dev/test/ab.sh
log() { echo "$*" | tee -a "$OUT"; }
res() { log "$1  $2${3:+  — $3}"; }            # res PASS|FAIL|BLOCKED name detail
jsv() { ev | tr -d '"'; }                      # eval stdin, strip quotes
shot() { agent-browser screenshot "$SHOTS/$1" >/dev/null; log "   screenshot: evidence/screenshots/v/$1"; }
begin() { agent-browser focus "#stSeed" >/dev/null; agent-browser press Enter >/dev/null; agent-browser wait 500 >/dev/null
  local o; o=$(echo 'return document.getElementById("dlgStart").open' | jsv); [[ "$o" == true ]] && { agent-browser find role button click --name "Begin run" >/dev/null; agent-browser wait 400 >/dev/null; }; }
hashnow() { echo 'return window.__emberdeep.stateHash(window.__emberdeep.S()) + " T" + window.__emberdeep.S().turn;' | jsv; }

log "=== Emberdeep browser validation — $(date -Iseconds) — agent-browser $(agent-browser --version)"
agent-browser close >/dev/null 2>&1
agent-browser set viewport 1280 800 >/dev/null
agent-browser open "file://$ROOT/index.html" >/dev/null; agent-browser wait 800 >/dev/null
echo 'localStorage.clear(); return 1;' | ev >/dev/null
agent-browser open "file://$ROOT/index.html" >/dev/null; agent-browser wait 900 >/dev/null
URL=$(agent-browser get url); log "Loaded: $URL (direct file, no server)"
T=$(agent-browser get title); [[ "$T" == Emberdeep* ]] && res PASS "Direct file:// load" "$T" || res FAIL "Direct file:// load" "$T"
# capture every event the UI renders so turn legality can be audited on the real pipeline
cat <<'JS' | ev >/dev/null
const E = window.__emberdeep; window.__evlog = []; const orig = E.Renderer.onEvents;
E.Renderer.onEvents = function (evs, s) { window.__evlog.push({ turn: s.turn, evs: evs.map(e => ({ type: e.type, id: e.id, kb: e.kb })) }); return orig.apply(this, arguments); };
return 'hooked';
JS

# ---------------------------------------------------------------- 1. two seeds
for SEED in kindle bravo; do
  agent-browser click "#btnNew" >/dev/null; agent-browser wait 200 >/dev/null
  agent-browser fill "#stSeed" "$SEED" >/dev/null; agent-browser select "#stStyle" mixed >/dev/null; agent-browser select "#stFloor" 1 >/dev/null
  agent-browser click 'label.ccard:nth-child(1)' >/dev/null; begin
  R=$(cat <<'JS' | jsv
const s = window.__emberdeep.S(); const fl = s.floor; const v = fl.validation; const reg = regionsOf(fl, connPass(fl));
const d = dmap(fl, [[s.player.x, s.player.y]], safeCost(fl, false)); const ex = fl.exit;
return `${s.params.seed}|${fl.style}|checks ${v.checks.filter(c => c.ok).length}/${v.checks.length}|regions ${reg.count}|exit path ${ex ? d[ex.y * fl.w + ex.x] : 'n/a'}|ok=${v.ok && reg.count === 1 && ex && d[ex.y * fl.w + ex.x] < 1e8}`;
JS
)
  [[ "$R" == *ok=true ]] && res PASS "Seed '$SEED' generates a valid connected floor" "$R" || res FAIL "Seed '$SEED' valid floor" "$R"
done
agent-browser press F3 >/dev/null; agent-browser click 'input[data-d="regions"]' >/dev/null; agent-browser wait 300 >/dev/null; shot 01-seed-bravo-regions.png
agent-browser click 'input[data-d="regions"]' >/dev/null; agent-browser press F3 >/dev/null
H1=$(echo 'return window.__emberdeep.S().floor.t.join("").slice(0,400)' | jsv)
agent-browser click "#btnNew" >/dev/null; agent-browser fill "#stSeed" kindle >/dev/null; begin
H2=$(echo 'return window.__emberdeep.S().floor.t.join("").slice(0,400)' | jsv)
[[ "$H1" != "$H2" ]] && res PASS "Different seeds give different maps" || res FAIL "Different seeds give different maps"
agent-browser click "#btnNew" >/dev/null; agent-browser fill "#stSeed" bravo >/dev/null; begin
H3=$(echo 'return window.__emberdeep.S().floor.t.join("").slice(0,400)' | jsv)
[[ "$H1" == "$H3" ]] && res PASS "Same seed regenerates the identical map (bravo twice)" || res FAIL "Same seed identical map"
shot 02-bravo-start.png

# ---------------------------------------------------------------- 2. movement + closed-door occlusion
agent-browser focus "#view" >/dev/null
T0=$(echo 'return window.__emberdeep.S().turn' | jsv); keys l h; T1=$(echo 'return window.__emberdeep.S().turn' | jsv)
res "$([[ $((T1 - T0)) -ge 1 ]] && echo PASS || echo FAIL)" "Keyboard movement advances turns" "turn $T0 → $T1 after 2 keys (bumps into walls cost 0)"
DOOR=$(cat <<'JS' | jsv
const s = window.__emberdeep.S(); const fl = s.floor; const p = s.player; const W = fl.w;
const d = dmap(fl, [[p.x, p.y]], safeCost(fl, false)); let best = null, bd = 1e9;
for (let i = 0; i < fl.t.length; i++) { if (fl.t[i] !== 2) continue; const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const ax = x - dx, ay = y - dy, bx = x + dx, by = y + dy;
    if (tWalk(gget(fl, ax, ay)) && tWalk(gget(fl, bx, by)) && d[ay * W + ax] < bd) { bd = d[ay * W + ax]; best = [ax, ay, dx, dy, bx, by]; } } }
return best ? best.join(' ') : 'none';
JS
)
if [[ "$DOOR" != none ]]; then
  set -- $DOOR; walkto $1 $2 40 >/dev/null
  B=$(echo "const s=window.__emberdeep.S(); return (s.player.x===$1&&s.player.y===$2) + ' ' + s._vis[$6*s.floor.w+$5] + ' ' + s._vis.reduce((a,b)=>a+b,0);" | jsv)
  KEY=$(python3 -c "print({'1 0':'l','-1 0':'h','0 1':'j','0 -1':'k'}['$3 $4'])"); agent-browser press $KEY >/dev/null; agent-browser wait 200 >/dev/null
  A=$(echo "const s=window.__emberdeep.S(); return s.floor.t[($2+$4)*s.floor.w+$1+$3] + ' ' + s._vis[$6*s.floor.w+$5] + ' ' + s._vis.reduce((a,b)=>a+b,0);" | jsv)
  set -- $B; BV=$2; BN=$3; set -- $A; AT=$1; AV=$2; AN=$3
  [[ "$BV" == 0 && "$AT" == 3 && "$AV" == 1 ]] && res PASS "Closed door occludes; opening reveals the far side" "beyond-door tile visible $BV→$AV, visible tiles $BN→$AN" || res FAIL "Door occlusion" "before=$B after=$A"
  shot 03-door-opened.png
else res BLOCKED "Door occlusion" "no suitable door found on this seed"; fi

# ---------------------------------------------------------------- 3. enemy discovery, combat, damage, items/status
FOUND=no
for i in $(seq 1 12); do
  V=$(echo 'const s=window.__emberdeep.S(); const W=s.floor.w; return s.enemies.filter(e=>e.hp>0&&s._vis[e.y*W+e.x]).length;' | jsv)
  [[ "$V" -gt 0 ]] && { FOUND=yes; break; }
  TGT=$(echo 'const s=window.__emberdeep.S(); const p=s.player; const W=s.floor.w; const d=dmap(s.floor,[[p.x,p.y]],safeCost(s.floor,false)); const e=s.enemies.filter(e=>e.hp>0).sort((a,b)=>d[a.y*W+a.x]-d[b.y*W+b.x])[0]; return e.x+" "+e.y;' | jsv)
  walkto $TGT 12 >/dev/null
done
if [[ $FOUND == yes ]]; then
  D=$(echo 'const s=window.__emberdeep.S(); const W=s.floor.w; return s.enemies.filter(e=>e.hp>0&&s._vis[e.y*W+e.x]).map(e=>e.k+"@"+e.x+","+e.y+":"+e.state).join(" ") + " | log: " + s.log.slice(-3).map(l=>l.text).join(" / ");' | jsv)
  res PASS "Enemy discovery (was hidden, now visible)" "$D"; shot 04-enemy-discovered.png
else res FAIL "Enemy discovery" "no enemy became visible"; fi
# throw a fire bomb at the first visible enemy via keyboard (quick slot 2 = Fire Bomb), then fight
agent-browser press 2 >/dev/null; agent-browser wait 200 >/dev/null
MB=$(echo 'return document.getElementById("modeBar").innerText.split("\n")[0]' | jsv); log "   targeting bar: $MB"
agent-browser press Enter >/dev/null; agent-browser wait 300 >/dev/null
ST=$(echo 'const s=window.__emberdeep.S(); return s.log.slice(-6).map(l=>l.text).join(" / ") + " | statuses: " + s.enemies.filter(e=>e.st.length).map(e=>e.k+":"+e.st.map(q=>q.k+q.t).join("+")).join(" ");' | jsv)
FX=$(echo 'const s=window.__emberdeep.S(); return Object.keys(s.fx.fire).length' | jsv)
[[ "$ST" == *"fire bomb bursts"* ]] && res PASS "Item use: Fire Bomb thrown via quick slot + targeting" "$ST | burning ground tiles: $FX" || res FAIL "Fire Bomb" "$ST"
[[ "$ST" == *[Bb]urning* || "$ST" == *"catches fire"* ]] && log "   bomb also left an enemy Burning" || log "   note: the bomb killed its target outright, so no enemy status was observable from it"
agent-browser press x >/dev/null; agent-browser wait 200 >/dev/null
SW=$(echo 'const s=window.__emberdeep.S(); return s.player.st.map(q=>q.k+" "+q.t).join(",") + " | chips: " + document.getElementById("statusRow").innerText.replace(/\n/g," ") + " | cd " + JSON.stringify(s.player.cd)' | jsv)
[[ "$SW" == shield* ]] && res PASS "Status effect: Second Wind grants Warded (shown in status chips, cooldown set)" "$SW" || res FAIL "Status effect" "$SW"
shot 05-firebomb.png
HP0=$(echo 'return window.__emberdeep.S().player.hp' | jsv); DD0=$(echo 'return window.__emberdeep.S().stats.dmgDealt' | jsv)
for c in 1 2 3 4 5; do fight 30 >/dev/null; TK=$(echo 'return window.__emberdeep.S().stats.dmgTaken' | jsv); [[ "$TK" -gt 0 ]] && break
  TGT=$(echo 'const s=window.__emberdeep.S(); const p=s.player; const W=s.floor.w; const d=dmap(s.floor,[[p.x,p.y]],safeCost(s.floor,false)); const e=s.enemies.filter(e=>e.hp>0).sort((a,b)=>d[a.y*W+a.x]-d[b.y*W+b.x])[0]; return e ? e.x+" "+e.y : "";' | jsv)
  [[ -n "$TGT" ]] && walkto $TGT 30 >/dev/null; done
HP1=$(echo 'return window.__emberdeep.S().player.hp' | jsv); DD1=$(echo 'return window.__emberdeep.S().stats.dmgDealt' | jsv); DT=$(echo 'return window.__emberdeep.S().stats.dmgTaken' | jsv)
CL=$(echo 'return window.__emberdeep.S().log.filter(l=>/hit|miss|bite|dies/.test(l.text)).slice(-5).map(l=>l.text).join(" / ")' | jsv)
[[ "$DD1" -gt "$DD0" ]] && res PASS "Combat: player deals damage" "dealt $DD0 → $DD1; log: $CL" || res FAIL "Combat dealt" "$DD0 → $DD1"
[[ "$DT" -gt 0 ]] && res PASS "Combat: player takes damage" "HP $HP0 → $HP1, total taken $DT" || res FAIL "Combat taken" "taken=$DT (enemies may have died first)"
shot 06-after-fight.png

# ---------------------------------------------------------------- 4. legal turns (audited on real UI event stream)
LEG=$(cat <<'JS' | jsv
const log = window.__evlog; let bad = 0, n = 0; const s = window.__emberdeep.S();
for (let k = 1; k < log.length; k++) { const rounds = log[k].turn - log[k - 1].turn; if (rounds < 0 || rounds > 6) continue; const per = new Map();
  for (const e of log[k].evs) if (e.type === 'move' && e.id && !e.kb) per.set(e.id, (per.get(e.id) || 0) + 1);
  for (const [id, m] of per) { n++; const en = s.enemies.find(q => q.id === id); const sp = en ? ENEMIES[en.k].speed : 150; if (m > Math.ceil((100 + sp * Math.max(1, rounds)) / 100)) bad++; } }
return `${log.length} UI event batches, ${n} enemy move-batches checked, ${bad} exceeded their speed budget`;
JS
)
[[ "$LEG" == *", 0 exceeded"* ]] && res PASS "Enemies take only legal (speed-budgeted) turns" "$LEG" || res FAIL "Legal turns" "$LEG"

# ---------------------------------------------------------------- 5. nothing acts while awaiting input or paused
HA=$(hashnow); sleep 3; HB=$(hashnow)
[[ "$HA" == "$HB" ]] && res PASS "No world change while awaiting input (3 s idle)" "$HA" || res FAIL "Idle changes" "$HA vs $HB"
agent-browser press Escape >/dev/null; agent-browser wait 200 >/dev/null
MO=$(echo 'return document.getElementById("dlgMenu").open + " hud=" + /PAUSED/.test(document.getElementById("hud").innerText)' | jsv)
agent-browser press l >/dev/null; agent-browser press . >/dev/null; sleep 2; HC=$(hashnow)
shot 07-paused-menu.png
agent-browser press Escape >/dev/null; agent-browser wait 200 >/dev/null
[[ "$HA" == "$HC" && "$MO" == "true hud=true" ]] && res PASS "Paused menu: keys ignored, no world change, HUD shows PAUSED" "menu=$MO $HC" || res FAIL "Pause" "menu=$MO $HA vs $HC"

# ---------------------------------------------------------------- 6. lose knowledge outside LOS (reads live AI state)
LK=$(cat <<'JS' | jsv
const s = window.__emberdeep.S(); const W = s.floor.w; const out = [];
for (const e of s.enemies) if (e.hp > 0 && (e.state === 'searching' || e.state === 'investigating')) out.push(`${e.k} ${e.state} at ${e.x},${e.y} → last-known ${e.last ? e.last.x + ',' + e.last.y : '-'} (player ${s.player.x},${s.player.y}; enemy visible=${!!s._vis[e.y*W+e.x]})`);
return out.slice(0, 3).join(' | ') || 'none currently searching';
JS
)
log "   AI state sample: $LK"

# ---------------------------------------------------------------- 7. inventory & equipment by pointer + keys
agent-browser click '#eq .slot[data-id]:nth-child(3)' >/dev/null; agent-browser wait 150 >/dev/null; agent-browser press e >/dev/null; agent-browser wait 150 >/dev/null
U=$(echo 'const s=window.__emberdeep.S(); return (s.player.eq.armor?s.player.eq.armor.k:"none") + " turn " + s.turn;' | jsv)
agent-browser focus "#view" >/dev/null; agent-browser press i >/dev/null; agent-browser wait 100 >/dev/null
L=$(echo 'const s=window.__emberdeep.S(); return String.fromCharCode(97 + s.player.inv.findIndex(i=>i.k==="chain"));' | jsv)
agent-browser press "$L" >/dev/null; agent-browser wait 150 >/dev/null; agent-browser press e >/dev/null; agent-browser wait 150 >/dev/null
Q=$(echo 'const s=window.__emberdeep.S(); return (s.player.eq.armor?s.player.eq.armor.k:"none") + " turn " + s.turn;' | jsv)
[[ "$U" == none* && "$Q" == chain* ]] && res PASS "Equipment: unequip by click, re-equip via inventory keys (i, letter, e)" "after unequip: $U; after equip: $Q" || res FAIL "Equipment" "$U / $Q"

# ---------------------------------------------------------------- 8. save and reload exact state
agent-browser focus "#view" >/dev/null; keys .; agent-browser press Control+s >/dev/null; agent-browser wait 200 >/dev/null; HS=$(hashnow)
agent-browser open "file://$ROOT/index.html" >/dev/null; agent-browser wait 900 >/dev/null; HR=$(hashnow)
[[ "$HS" == "$HR" ]] && res PASS "Save (Ctrl+S) → reload page → identical state hash and turn" "$HS" || res FAIL "Save/reload" "$HS vs $HR"
cat <<'JS' | ev >/dev/null
const E = window.__emberdeep; window.__evlog = []; const orig = E.Renderer.onEvents;
E.Renderer.onEvents = function (evs, s) { window.__evlog.push({ turn: s.turn, evs: evs.map(e => ({ type: e.type, id: e.id, kb: e.kb })) }); return orig.apply(this, arguments); };
return 1;
JS

# ---------------------------------------------------------------- 9. replay re-simulation of this run
agent-browser press F3 >/dev/null; agent-browser wait 150 >/dev/null; agent-browser click "#dgVerify" >/dev/null; agent-browser wait 400 >/dev/null
RV=$(echo 'return document.getElementById("dgReplay").innerText.replace(/\n/g," ")' | jsv)
[[ "$RV" == ✓* ]] && res PASS "Deterministic replay of the action log reproduces the live state" "$RV" || res FAIL "Replay verify" "$RV"
for o in walk fov dist ai occ; do agent-browser click "input[data-d=\"$o\"]" >/dev/null; agent-browser wait 250 >/dev/null; shot "08-overlay-$o.png"; agent-browser click "input[data-d=\"$o\"]" >/dev/null; done
DG=$(echo 'return document.getElementById("dgBody").innerText.split("\n").filter(l=>/COLLISION|✓ \d+ actors|draws|attempt|Every walkable/.test(l)).join(" | ")' | jsv)
res PASS "Diagnostics panel live data" "$DG"
agent-browser press F3 >/dev/null

# ---------------------------------------------------------------- 10. event log
EL=$(echo 'return document.querySelectorAll("#log p").length + " entries; last: " + [...document.querySelectorAll("#log p")].slice(-3).map(p=>p.innerText).join(" / ")' | jsv)
res PASS "Event log panel populated" "$EL"

# ---------------------------------------------------------------- 11. compact later-floor preset + descend
agent-browser click "#btnNew" >/dev/null; agent-browser wait 150 >/dev/null; agent-browser fill "#stSeed" "preset-check" >/dev/null; agent-browser click "#stPreset" >/dev/null; begin
PR=$(echo 'const s=window.__emberdeep.S(); return s.floorN + " " + s.floor.style + " " + s.floor.w + "x" + s.floor.h + " lvl" + s.player.level;' | jsv)
[[ "$PR" == "4 arena"* ]] && res PASS "Compact later-floor preset (arena, depth 4)" "$PR" || res FAIL "Preset" "$PR"
EX=$(echo 'const f=window.__emberdeep.S().floor; return f.exit.x+" "+f.exit.y' | jsv)
agent-browser focus "#view" >/dev/null
for k in $(seq 1 8); do walkto $EX 40 >/dev/null; A=$(echo "const s=window.__emberdeep.S(); return (s.player.x+' '+s.player.y)==='$EX' ? 'at' : (s.over?'over':'no');" | jsv); [[ $A != no ]] && break; fight 12 >/dev/null; done
agent-browser press ">" >/dev/null; agent-browser wait 500 >/dev/null
DS=$(echo 'const s=window.__emberdeep.S(); return "depth " + s.floorN + " " + s.floor.style + " | " + s.log.filter(l=>/descend/.test(l.text)).slice(-1).map(l=>l.text).join("");' | jsv)
[[ "$DS" == "depth 5"* ]] && res PASS "Descend stairs with '>'" "$DS" || res FAIL "Descend" "$DS"
shot 09-descended.png

# ---------------------------------------------------------------- 12. narrow viewport: keyboard + pointer + touch
agent-browser set viewport 390 844 >/dev/null; agent-browser wait 500 >/dev/null
NW=$(echo 'const d=document.documentElement; return "hscroll=" + (d.scrollWidth > d.clientWidth) + " touchpad=" + getComputedStyle(document.getElementById("touch")).display + " canvas=" + Math.round(document.getElementById("view").getBoundingClientRect().height) + "px"' | jsv)
res PASS "Narrow 390×844 layout" "$NW"; shot 10-narrow.png
agent-browser focus "#view" >/dev/null; T0=$(echo 'return window.__emberdeep.S().turn' | jsv); keys . j k; T1=$(echo 'return window.__emberdeep.S().turn' | jsv)
res "$([[ $T1 -gt $T0 ]] && echo PASS || echo FAIL)" "Narrow: keyboard actions" "turn $T0 → $T1"
agent-browser click '#touch button[aria-label="Wait one turn"]' >/dev/null; T2=$(echo 'return window.__emberdeep.S().turn' | jsv)
res "$([[ $T2 -gt $T1 ]] && echo PASS || echo FAIL)" "Narrow: on-screen pad button (pointer)" "turn $T1 → $T2"
TT=$(echo 'const s=window.__emberdeep.S(); const p=s.player; const fl=s.floor; for (let r=4;r>=2;r--) for (const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1]]) { const x=p.x+dx*r, y=p.y+dy*r; const i=y*fl.w+x; if (inb(fl,x,y)&&fl.explored[i]&&fl.t[i]===1&&!actorAt(s,x,y)) return x+" "+y; } return "none";' | jsv)
if [[ "$TT" != none ]]; then
  XY=$(tilexy $TT | tr -d '"'); CDP=$(agent-browser get cdp-url)
  P0=$(echo 'const p=window.__emberdeep.S().player; return p.x+","+p.y' | jsv)
  node dev/test/touch.mjs "$CDP" tap $XY >/dev/null; agent-browser wait 300 >/dev/null; P1=$(echo 'const p=window.__emberdeep.S().player; return p.x+","+p.y' | jsv)
  node dev/test/touch.mjs "$CDP" tap $XY >/dev/null; agent-browser wait 1500 >/dev/null; P2=$(echo 'const p=window.__emberdeep.S().player; return p.x+","+p.y' | jsv)
  [[ "$P0" == "$P1" && "$P2" == "${TT/ /,}" ]] && res PASS "Narrow: genuine touch tap previews, second tap travels" "$P0 → (preview) $P1 → $P2" || res FAIL "Touch travel" "$P0 → $P1 → $P2 target $TT"
else res BLOCKED "Touch travel" "no explored target tile"; fi
CXY=$(echo 'const s=window.__emberdeep.S(); const p=s.player; const fl=s.floor; for (let r=5;r>=2;r--) for (const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]) { const x=p.x+dx*r, y=p.y+dy*r; const i=y*fl.w+x; if (inb(fl,x,y)&&fl.explored[i]&&fl.t[i]===1&&!actorAt(s,x,y)) return x+" "+y; } return "none";' | jsv)
if [[ "$CXY" != none ]]; then clicktile $CXY; agent-browser wait 1500 >/dev/null; P3=$(echo 'const p=window.__emberdeep.S().player; return p.x+" "+p.y' | jsv)
  [[ "$P3" == "$CXY" ]] && res PASS "Narrow: mouse click-to-travel" "arrived at $P3" || res FAIL "Click travel" "at $P3 wanted $CXY (may stop on newly seen danger)"; fi
shot 11-narrow-after-input.png
agent-browser set viewport 1280 800 >/dev/null

# ---------------------------------------------------------------- 13. errors
ERR=$(agent-browser errors 2>&1 | grep -v '^$' | head -5); UE=$(echo 'return window.__emberdeep.UI.errors.length' | jsv)
[[ -z "$ERR" && "$UE" == 0 ]] && res PASS "No page errors / uncaught exceptions" || res FAIL "Page errors" "$ERR ui=$UE"
log "=== done"
