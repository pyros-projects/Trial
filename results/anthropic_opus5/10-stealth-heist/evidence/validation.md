# NIGHTFALL PROTOCOL — validation record

Artifact: `../index.html` (single self-contained file, 4216 lines, 214948 bytes)
Author of this record: the implementing agent. Statuses are **pass / fail / blocked / not-run**, recorded honestly.

---

## 1. Tooling and environment

| Item | Detail |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (the installed `agent-browser` skill), session `heist` |
| Browser | Google Chrome for Testing 152.0.7977.54, headless, **software GPU** (ANGLE / SwiftShader) |
| Local server | `python3 -m http.server 8971 --bind 127.0.0.1` (development only — not a runtime dependency) |
| Headless logic runner | Node v25.8.1, running the game's simulation code extracted from `index.html` |
| Skill docs read before use | `agent-browser skills get core`, `agent-browser skills get dogfood` |

`agent-browser doctor --offline --quick` → 8 pass, 1 warn (stale state files), 0 fail.

**Substitutions / harness notes (important for interpreting results below):**

* `agent-browser` has no key-hold primitive. Discrete keys (`E`, `Q`, `1`–`5`, `P`, `F1`, `Esc`, `F`) were sent as
  **real CDP key events** via `agent-browser press`. Sustained movement was driven by dispatching real
  `KeyboardEvent` keydown/keyup pairs on `window`, which enter the game through the exact same listeners.
* Long traversals were driven by a **test-only pilot** (`evidence/harness/pilot.js`, injected at runtime, *never* part of
  `index.html`). It reads live game state and dispatches real keyboard events — it is a hand on a keyboard, not an
  in-game autopilot. It never mutates simulation state. Every *assertion* below is read from live game state, not
  from the pilot.
* Headless Chrome reports `maxTouchPoints: 0`, so the touch UI was enabled through the game's own
  **Options → Force touch controls** setting and driven with real `PointerEvent`s on the stick/button elements.
* FPS figures are from software rasterisation (SwiftShader). JS cost is separately reported as `sim`/`draw` ms.

---

## 2. Headless simulation test suites

Extracted the simulation half of `index.html` (RNG, map generation, pathfinding, sound, guard AI, `Sim`) into Node and
ran three suites. Commands: `node test1.js`, `node test2.js`, `node test3.js`.

### 2.1 Map generation — `test1.js`

288 missions (6 presets × 4 difficulties × 12 seeds). For each: objective reachable from entry, extraction reachable,
≥4 rooms, ≥2 guards, ≥1 camera, ≥1 terminal, ≥1 door, every guard spawn reachable, every patrol waypoint reachable.

```
generation: 288 missions, 0 failures, avg 1.3ms, max 9ms, min rooms 6
```
**PASS**

### 2.2 Traversability, stability, determinism — `test2.js`

* **Traversability** — an A*-driven bot (guards disabled) must collect the objective *and* reach extraction:
  `48 missions, 0 not completable; median 37.2s, max 56.9s` → **PASS**
* **Stability with guards** — 24 runs across all presets × difficulties with a deliberately reckless sprinting bot:
  `1 won, 23 caught, 0 crashes`. Being caught is the correct outcome for that behaviour; the check is *0 crashes*
  and no stuck states → **PASS**
* **Determinism** — same seed + same scripted input sequence run twice, comparing tick count, status, player position
  to 6 dp, alarm level, detections, score and **every guard's state / position / awareness**:
  `0 mismatches out of 6 presets` → **PASS**

### 2.3 AI and systemic behaviour — `test3.js` (26 assertions)

```
== perception ==            guard detects an unobstructed player · a wall blocks LOS · guard stays unaware behind a wall
== hearing ==               loud noise → INVESTIGATE · guard physically moves to the noise · gives up and searches
== hearing occlusion ==     loudness falls off with PATH distance · sound stops at its energy budget
== pursuit ==               exposure → CHASE · LKP recorded · detection counted · alarm ≥ ALERTED
                            losing target → SEARCH · searches the LAST KNOWN position (not the real one)
                            returns to duty · alarm decays back down
== radio ==                 nearby guards respond to the radio call
== gadgets ==               EMP consumes a charge, disables cameras, kills lamps
                            smoke blocks line of sight · holo decoy draws a guard
                            door-control terminal releases badge locks
== cameras ==               a camera with clear LOS confirms and raises the alarm
== noise model ==           sneak < walk < run noise budget

=== 26 passed, 0 failed ===
```
**PASS**

---

## 3. Public validation checks (real browser)

### 3.1 Complete a mission — objective + extraction — **PASS**

Deterministic compact preset **Blackwater Annex**, seed `ANNEX-55`, difficulty **Operative** (3 guards, 2 cameras,
5 rooms, 3 terminals). Driven with real keyboard input.

Live state at completion:
```
mode:"over"  status:"won"  t:39.95s  objective taken:true  detections:0  alarms:0
rank:"A" (GHOST)  score:2224  closest approach:56px  distance moved:70 tiles
```
Screenshot: `shots/07-victory-results.png`. A second independent run of the same mission also won
(58.52 s, rank A, score 2180) — see `shots/20-run-history.png`.

Failure path also exercised: `shots/04-failed-results.png` (apprehended by security, rank F).

### 3.2 Enter and leave a guard vision cone — **PASS**

Walked into guard `KETT`'s cone; sampled live guard state each ~1 s:
```
aware 0 → 1.35, seeing:true, state observe → chase, detections 0 → 1, alarm 0 → 2
radio: ORRIN and BASS switch to "investigate" with lkp [396,208]
```
Awareness **decay after leaving** observed in the same session (noisemaker run):
`aware 0.25` → `aware 0` on the following sample once line of sight broke.

### 3.3 Enter and leave a **camera** vision cone — **PASS**

Seed `ANNEX-131`, Rookie. Walked into camera 0's sweep, then retreated behind geometry:
```
t=16.6  camSpotted:true  seeT 0.24   alarm 0 → 1      (entered the cone)
t=17.7  camSpotted:true  seeT 0.82                     (still below the 0.9 confirm threshold)
t=29.1  camSpotted:false seeT 0      alarm back to 0   (left the cone — detection decayed)
t=32.3  camSpotted:true  seeT ...    detections 0 → 1, alarm → 2   (re-entered; camera confirmed)
```
Screenshots: `shots/05-in-camera-cone.png`, `shots/05-camera-cone.png`.

### 3.4 Create a noise that causes investigation — **PASS**

Selected the Noisemaker with `1`, aimed with a real pointer move at the guard, threw with `Q`:
```
charges 5 → 4 ; sound events: ["throw", "noisemaker"]
guard BASS: heardAt loudness 0.66, state observe → INVESTIGATE
guard distance to the reported point: 513px → 28px      (it physically walked to the sound)
```
Earlier throws at 16.8 and 10.3 tiles produced **no** reaction — correct, the sound budget (11.5 tiles of *path*
travel, with closed doors adding attenuation) did not reach the guard. Screenshot: `shots/11-noisemaker-investigate.png`.

### 3.5 Break line of sight during pursuit — **PASS**

From the recorded in-browser pilot trace (`g` = per-guard state letter + awareness):
```
t=19.8  al:2 det:1  g:"i0.3,i0.3,c1.4"   ← one guard chasing, two radioed to investigate
t=22.5           g:"s0.5,i0.2,c1.4"      ← guard 1 lost sight and dropped to SEARCH
t=28.4           g:"c1.4,c1.4,c1.4"      ← all three re-acquired
```
Headless `test3` asserts the same transition deterministically, including that the guard searches near the
**last known position** rather than the player's real position.

### 3.6 AI state transitions observable, not cosmetic — **PASS**

`shots/06-midmission-diag.png` shows the diagnostics overlay reading live AI state:
guard label `ORRIN · INVESTIGATE / aware 0.00 / st 10.4s path0`, an `LKP ORRIN 18.6s` marker, vision-ray hit/miss
fan, patrol-route polylines, nav nodes, and the status bar's `GUARDS 1P 1I 0C 0S 0R` counter.

### 3.7 Use a door — **PASS**

Walked to the nearest door and pressed `E`:
```
door.open 0 → 1, door.target 1, stats.doors 0 → 1, prompt "[E] Open door" → "[E] Close door"
```

### 3.8 Use a terminal — **PASS**

Held `E` on a **camera hub** terminal:
```
prompt "Hack camera hub" ; progress 0 → 0.43 → 1 ; terminals hacked 0 → 1
cameras enabled: 1/1 → 0/1        ← the terminal genuinely altered the security system
```
Screenshot: `shots/09-terminal-hacked.png`.

### 3.9 Use gadgets — **PASS** (all four in-browser; five including the headless decoy)

| Gadget | In-browser evidence |
|---|---|
| **Noisemaker** | charges 5→4, sound event emitted, guard investigated (§3.4) |
| **Smoke Veil** | charges 3→2→1→0, cloud r=62.7. Occlusion measured on an otherwise-clear sightline: `clearWithoutSmoke:true, clearWithSmoke:false`. Screenshot `shots/10-smoke-deployed.png` |
| **Lock Shim** | prompt "Shim the badge lock (5 left)", hold 0.62→1.73→complete, `door.locked true→false`, `picked:true`, shims 5→4. Screenshot `shots/23-lockshim.png` |
| **EMP Charge** | charges 3→2, target camera `enabled:false` with `disabledT 19.4s`, cameras on 1→0, lamps on **15→12**. Screenshot `shots/24-emp.png` |
| **Holo Decoy** | headless `test3` only (guard chased/investigated the decoy) — see limitation L2 |

### 3.10 Toggle perception and navigation diagnostics — **PASS**

`F1` opened the panel; clicked NAV/PATHS, GUARD STATE, VISION RAYS, SOUND EVENTS, LAST KNOWN:
```
{"open":true,"nav":true,"guard":true,"rays":true,"sound":true,"lkp":true,"collision":false,"timing":true}
```
Toggled mid-mission without restarting; overlays rendered against live state (`shots/06-midmission-diag.png`).

### 3.11 Pause and restart — **PASS**

```
P  → mode "paused", HUD state "PAUSED", sim time frozen (simFrozen:true), rendering continues (fps > 5)
P  → mode "playing", sim time advanced
Menu → "Restart mission" → fresh sim at t < 1s
```
Screenshot: `shots/12-paused.png`.

### 3.12 Regenerate with the same seed — **PASS**

Fingerprinted the full grid (`solid` array), every door position + lock state, every prop, camera base/sweep,
terminal action, loot, lamp, patrol waypoint, plus objective/entry/exfil tiles. Regenerated through the UI:
```
same seed  → identical:true   (1485-char fingerprint matched exactly)
new seed   → changed:true
```

### 3.13 Keyboard + pointer at desktop and narrow widths — **PASS**

**Desktop 1280×800:** WASD moved the player 202 px; pointer move set the aim angle; left-click and `Q` fired the
selected gadget; `1`–`5` selected slots; mouse wheel adjusted zoom.

**Narrow 390×844 @ DPR 2:**
```
view 390×844, canvas 780×1688 (high-DPI), zoom 0.903, touch UI on, no horizontal scroll
HUD collision scan across status/topBtns/minimap/gadgets/action-buttons/sticks/run-toggle: []  (none)
```
Touch driven with real PointerEvents:
```
move stick dx:-1     → player moved 238 px in −x over 1.5 s, mode "run" (RUN toggle), noise 0.85
aim stick  ang:-1.57 → player.facing -1.57
GADGET button        → noisemaker charges 5→4, sound events ["throw","noisemaker"]
```
Screenshots: `shots/13-narrow-briefing.png`, `shots/14-narrow-play.png`, `shots/15-narrow-touch-move.png`.

---

## 4. Artifact and runtime checks

| Check | Status | Evidence |
|---|---|---|
| Single self-contained file | **pass** | `grep` for `src=`/`href=`/`@import`/`fetch(`/`XMLHttpRequest`/`Worker`/`WebSocket` → **0 matches**. 1 inline `<script>`, 1 inline `<style>`, `externalRefs: []` |
| Opens directly from `file://` | **pass** | `file:///…/index.html` → mission generated, `mode:"playing"`, 53–60 fps, `frameErrors:0`, guards chasing/investigating, `localStorage:"ok"`. `shots/16-file-protocol.png`, `shots/25-final-file-protocol.png` |
| No external network activity | **pass** | Network log over the whole session: only the document itself, plus browser-initiated `favicon.ico` 404s. Zero third-party requests on either origin |
| Console / uncaught errors | **pass** | After the replay fix: `errors: 0`, console empty across a full file:// run |
| Audio starts on a user gesture and produces signal | **pass (amplitude measured, not heard)** | `AudioContext state:"running"`, 44.1 kHz, ambience running. Tapped an `AnalyserNode` on the effects bus: **silence RMS = 0**, effects-burst peak RMS = **0.0275**, 15/31 sampled windows above threshold. See limitation L1 |
| High-DPI | **pass** | DPR 2 → backing store 780×1688 for a 390×844 CSS viewport |
| Resize during play | **pass** | 1280×800 → 900×620 live: canvas follows, zoom 1.481 → 1.042, `mode:"playing"`, 60 fps, `frameErrors:0`, no horizontal scroll. `shots/19-resized-900x620.png` |
| Focus loss | **pass** | `blur` → `mode:"paused"`, held keys cleared, sim frozen while blurred, resumes cleanly |
| Local persistence | **pass** | Completed run stored; **after a full page reload** the Records tab shows `ANNEX-55 · Operative · EXTRACTED · 00:58 · 0 det · 0/3 · 2180 · A`. Settings and key bindings also persist. `shots/20-run-history.png` |
| Export mission JSON | **pass** | 601-byte `nfp-mission` document with generated counts |
| Import mission JSON | **pass** | Exported ANNEX-01 → switched to a different seed (map changed) → imported → map fingerprint **identical**; UI reported "regenerated identically" |
| Export replay JSON | **pass** | 3324 bytes, `nfp-replay` v2, 146 input frames, 3510 ticks, embedded result |
| Import replay JSON | **pass** | Pasted the exported replay → "✔ Replay loaded · 146 input frames · playing…", `mode:"replay"` |
| **Deterministic replay** | **pass** | Recorded input replayed in a *fresh* simulation reproduced the run exactly. Run 1: `deterministic ✔ status=won score=2224 rank=A ticks=2397`. Run 2 (after reload): `deterministic ✔ status=won score=2180 rank=A ticks=3511`. Visual playback also reproduced `t=39.95, won, score 2224, det 0` |
| Control remapping | **pass** | Clicked the "Interact / hold" binding → "press…" → pressed `F` → binding `KeyF`, persisted to `localStorage`, control reference updated. "Reset bindings" restored `KeyE` |
| Difficulty meaningfully changes the sim | **pass** | Operative → Rookie on the same seed: guards 3 → 2, cameras 2 → 1, lock shims 3 → 5 (plus FOV/view/detect/speed/response multipliers in `DIFFS`) |
| Reduced motion / flash | **pass** | On: `shake(20)`/`flash()` produce `shakeMag 0, flashT 0` and `body.noflash` disables toast/banner animation. Off: `shakeMag 20, flashT 0.5` |
| Stability with several guards hunting | **pass** | file:// run with `guards:["investigate","chase","chase"]`, alarm 2 → 53 fps, `frameErrors:0`, JS heap 10 MB |
| Performance | **pass (with caveat)** | 60 fps at 1280×800 and at 390×844 on the 34×24 map; 33–53 fps on the 48×32 map with 5 guards — all under **software** rasterisation. JS cost is small: `sim 0.10 ms`, `draw 1.2–2.2 ms` per frame |

---

## 5. Defects found and fixed during validation

| # | Defect | How it showed up | Fix |
|---|---|---|---|
| 1 | A closed door blocking the player was never offered as the interact target when an already-open door was nearer — the player could wedge permanently between two doors | Headless traversability: 41/48 missions uncompletable | Closed/locked doors now outrank open ones in `findInteract`; added push-to-open (leaning into a shut unlocked door for 0.3 s shoulders it open) |
| 2 | Path smoothing string-pulled *across* doorways, so actors clipped door jambs and wedged | Traversal stalls at doorways | Doorway tiles are now mandatory waypoints in `PathFinder.smooth` |
| 3 | The lock-shim budget was guaranteed per leg (entry→objective, objective→exfil) but not for the whole run, so a mission could become unwinnable halfway | Helix seeds ran out of shims after taking the objective | Generator now guarantees `cost(entry→obj) + cost(obj→exfil) ≤ shims − 1`, unlocking doors along the costlier leg until it holds |
| 4 | **Guards could not open badge-locked doors**, so A* routed them through locks they could not pass | Guards wedged against locked doors | Guards carry badges (`autoDoors(..., badge=true)`); the door opens but stays flagged locked, so the player can tailgate through |
| 5 | The idle head-sweep target was relative to the guard's *current* facing, so guards slowly spun in place | Headless perception test: awareness never accumulated | Sweep is now anchored to a `lookBase` heading captured on state entry (same fix applied to the search-point look-around) |
| 6 | A guard with a maxed awareness meter re-entered CHASE **every tick** with no visual contact, re-firing detections and alarms forever | Guard never dropped to SEARCH after losing the player | CHASE promotion now requires actual contact (`seeing`), and awareness is capped on the chase→search transition |
| 7 | `startSim()` cleared `App.replay` immediately after `playReplay()` assigned it, so the replay stepped with a `null` input and the **exception killed the render loop** | Replay froze the whole game at t=0 | Assign the replay after `startSim()`; `replayInputAt` always returns a neutral input; the frame body is wrapped in try/catch so one bad frame can never stop the loop |
| 8 | Guards patrolled through the player's entry pocket, so a mission could open with a guard on top of you | Repeated captures within 5–8 s of starting | Patrol waypoints now exclude nodes within 7 tiles of the insertion point |
| 9 | HUD panels (objectives, minimap, gadget bar, diagnostics) hid the player when the camera clamped at a world edge | Player invisible under the objectives panel | Panels auto-fade to 12 % opacity when the avatar is underneath |
| 10 | Narrow layout: touch sticks sat on top of the gadget bar and objectives panel | 390×844 screenshot | Narrow layout rebuilt around a measured `--statusH` variable; automated rect-overlap scan now reports **no collisions** |
| 11 | Two gadget glyphs (`⌁`, `⚿`) rendered as tofu boxes | Briefing screenshot | Replaced with widely-supported geometric glyphs |
| 12 | Replay **export** did not fall back to `localStorage` after a reload (play/verify did) | `jsonOut` empty after reload | Export now uses the same fallback chain |
| 13 | Scene was too dark to read floor/prop detail | Hero screenshots | Floor/prop palette lifted, wall edge lighting strengthened, cone alpha raised, darkness 0.90 → 0.87 |
| 14 | Forcing touch UI on a wide screen overlapped the minimap | Desktop screenshot with touch on | `body.touchui` lifts the minimap clear on wide screens |

Every fix was followed by re-running the full headless suite (`0 generation failures / 0 uncompletable / 0 determinism
mismatches / 26 AI assertions passing`) plus the affected browser flow.

---

## 6. Limitations and checks not fully covered

* **L1 — Audio quality was not *heard*.** I measured that the Web Audio graph emits real signal (silence RMS 0 vs
  effects-bus peak RMS 0.0275) and that the context runs at 44.1 kHz after a user gesture. I cannot listen, so
  **no claim is made about how the synthesis sounds**.
* **L2 — Holo Decoy was verified headless only.** `test3` asserts a guard is drawn to the decoy. It was not
  separately exercised through the browser UI; the other four gadgets were.
* **L3 — GIF/video capture not produced.** Evidence is PNG screenshots plus live-state JSON samples.
* **L4 — Long-session stability is a spot check.** JS heap stayed at 3–10 MB across multi-minute runs and no frame
  errors occurred, but no multi-hour soak test was run. The browser tab was reset to `about:blank` twice during the
  session by the automation environment (not reproducible from the page, no console errors, no crash reported by the
  page) — I could not attribute this to the artifact and did not observe it while the page was actively driven.
* **L5 — The in-browser mission completion used a deterministic compact preset** (`annex`, seed `ANNEX-55`) as the
  task permits. Larger presets (Vermeil, Cassiopeia, Helix, Marrow) were exercised for generation, traversability,
  determinism, stability and rendering, but were not played to completion inside the test budget.
* **L6 — The keyboard pilot is not a good stealth player.** Several early browser attempts ended in capture. This
  reflects the harness, not a defect: headless traversability proves 48/48 missions are completable, and the seed
  search found 8 `annex` seeds (including one on full Operative difficulty) completable by a cautious policy.

---

## 7. Reproducing

```bash
cd /home/pyro/projects/naked/opus5/10-stealth-heist

# 1. Open the artifact directly — no server needed
xdg-open index.html            # or: agent-browser open "file://$PWD/index.html"

# 2. Optional: serve it for automation
python3 -m http.server 8971 --bind 127.0.0.1

# 3. Headless suites (harness lives in evidence/harness/, nothing is added to index.html)
cd evidence/harness
node extract-core.js   # pulls the simulation code out of ../../index.html into core.js
node test1.js          # 288-mission generation validity
node test2.js          # traversability, stability, determinism
node test3.js          # 26 AI / perception / sound / gadget assertions
```

In-game, the fastest way to reproduce the completed run: **Menu → Mission**, seed `ANNEX-55`, preset
*Blackwater Annex*, difficulty *Operative* → **Begin Infiltration**. **Menu → Data → Verify replay** re-runs any
recorded run in a fresh simulation and prints whether it reproduced exactly.

## 8. Screenshot index

| File | What it shows |
|---|---|
| `01-briefing-1280.png` | Briefing: contract, parameters, loadout, recon layout, control reference |
| `02-play-1280.png` / `03-play-moved.png` | First frames; keyboard movement and the visibility polygon |
| `04-failed-results.png` | Failure summary (rank F, apprehended) |
| `05-in-camera-cone.png`, `05-camera-cone.png` | Standing inside a camera sweep |
| `06-midmission-diag.png` | All diagnostic overlays: nav nodes, patrol routes, vision rays, guard state, LKP, frame graph |
| `07-victory-results.png` | Extraction complete — rank A "GHOST", score 2224, 0 detections |
| `08-replay-playing.png` | Deterministic replay playing back |
| `09-terminal-hacked.png` | Terminal hack (camera hub) |
| `10-smoke-deployed.png` | Smoke veil + vision-ray diagnostics + HUD auto-fade |
| `11-noisemaker-investigate.png` | Noisemaker thrown, guard investigating |
| `12-paused.png` | Pause overlay |
| `13-narrow-briefing.png`, `14-narrow-play.png`, `15-narrow-touch-move.png` | 390×844 @ DPR 2 with touch controls |
| `16-file-protocol.png`, `25-final-file-protocol.png` | Running from `file://` |
| `17-briefing-vermeil.png` | Larger curated preset briefing |
| `18-hero-desktop.png` | Desktop gameplay: guard cones, camera cone, restricted zone, minimap |
| `19-resized-900x620.png` | Live resize during play |
| `20-run-history.png` | Run history persisted across a reload |
| `21-data-tab.png` | Export / import panel |
| `22-controls-rebind.png` | Key rebinding |
| `23-lockshim.png` | Badge lock being shimmed |
| `24-emp.png` | EMP effect on cameras and lamps |
