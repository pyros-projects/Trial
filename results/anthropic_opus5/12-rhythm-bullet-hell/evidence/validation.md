# PULSE CANNON — validation record

Artifact under test: `../index.html` (single self-contained file, 211 KB, 4,453 lines)
Author of this record: the implementing agent. No evaluator-owned score is stated here.

Date of run: 2026-09-08
Browser: Google Chrome for Testing 152.0.7977.54 (headless), driven by `agent-browser` 0.31.1
Host: WSL2 Linux 6.6.87.2, x86_64. **No audio output device exists on this host**
(`/dev/snd` contains only `timer`; no PulseAudio). This matters — see *Limitations*.

---

## 1. How the app was exercised

### Tooling

The installed skill `agent-browser` was used as instructed. The skill stub was read via the
Skill tool, then the version-matched workflow was loaded from the CLI itself:

```bash
agent-browser skills get core        # core workflow, read before any command
agent-browser skills get dogfood     # exploratory-testing workflow
agent-browser doctor --offline --quick
```

`agent-browser` drives the snapshot/click/screenshot/eval loop. Because bullet-hell play
requires **held** keys (agent-browser's `press` is a discrete tap), a thin CDP driver was
added on top of the same Chrome instance for genuine `Input.dispatchKeyEvent` /
`Input.dispatchMouseEvent` with independent down/up. Both talk to the same browser; the
CDP endpoint comes from `agent-browser get cdp-url`.

Harness files (all outside `index.html`): `evidence/harness/`.

| file | purpose |
|---|---|
| `ab.sh` / `abfile.sh` | fixed agent-browser launch flags (http / file:// sessions) |
| `cdp.mjs` | CDP driver: held keys, pointer, screenshots, JS eval |
| `t1-gameplay.mjs` | movement, focus, dash, bomb, graze, shooting, sync probe |
| `t2-combat.mjs` | aimed fire, boss damage, phase transition |
| `t3-sync.mjs` | audio↔gameplay sync statistics, drum grid quantisation |
| `t4-pause.mjs` | pause/resume drift + bullet backlog |
| `t5-replay.mjs` | replay export → import → checksum verification |
| `t6-lab.mjs` | pattern lab, subdivision, step grid, presets |
| `t7-a11y.mjs`, `t7b-flash.mjs` | accessibility toggles, difficulty, tempo change |
| `t8b-input.mjs`, `t8c-seed.mjs` | virtual stick, pointer drag, seeded determinism |
| `t9-victory.mjs` | full four-phase clear + high-score persistence |
| `t10-degrade.mjs` | live resize, high-DPI, gamepad absence |
| `t12-resume-guard.mjs` | resume with a wedged audio device |
| `t13-noaudio.mjs` | Web Audio removed entirely before boot |
| `t17-calib-presets.mjs` | tap calibration, musical presets/scale/root, mute, metronome |
| `t11/t14/t15/t16-*.mjs` | screenshot capture + final regression |

### Network isolation

External internet was blocked for the whole run by pointing Chrome at a dead proxy and
bypassing only loopback:

```
--proxy http://127.0.0.1:9 --proxy-bypass 127.0.0.1,localhost
```

Verified: `fetch('https://example.com')` → `BLOCKED: Failed to fetch`, while
`http://127.0.0.1:8712/index.html` loads normally.

### Serving

```bash
python3 -m http.server 8712 --bind 127.0.0.1   # dev-time only, not a runtime dependency
```

---

## 2. Result summary

| # | Check | Result |
|---|---|---|
| 1 | Loads with zero console errors / uncaught exceptions / failed requests | **pass** |
| 2 | Audio begins only after a real user gesture; AudioContext runs | **pass** |
| 3 | Transport, beat indicator, enemy attacks and audible events stay in sync | **pass** |
| 4 | Percussion quantised exactly to the musical grid | **pass** |
| 5 | 8-direction movement, focus mode, visible hitbox | **pass** |
| 6 | Dash + bomb abilities with resource cost and i-frames | **pass** |
| 7 | Collision, damage, invulnerability, lives, game over | **pass** |
| 8 | Combo / multiplier / graze / accuracy / perfect-good-miss feedback | **pass** |
| 9 | Restart from pause and from the results screen | **pass** |
| 10 | Pause/resume: no timeline jump, no bullet backlog, audio suspended | **pass** |
| 11 | Tempo change retunes the live transport without losing position | **pass** |
| 12 | Pattern lab: pattern, subdivision, density, speed, seed alter real scheduling | **pass** |
| 13 | Step grid cells map to exact 16th-note spawns; toggling off removes them | **pass** |
| 14 | Deterministic seeded runs (byte-identical state at a fixed tick) | **pass** |
| 15 | Replay export → import → identical ticks, checksum, score, boss HP | **pass** |
| 16 | Reduced flash suppresses the full-screen flash, bomb still works | **pass** |
| 17 | Reduced motion, screen-shake toggle, high contrast, colourblind palettes | **pass** |
| 18 | Narrow viewport 390×844 (+DPR 3) usable, no horizontal overflow | **pass** |
| 19 | Desktop 1280×800 and live resize / high-DPI re-layout | **pass** |
| 20 | Direct `file://` open works; exactly one network request (the document) | **pass** |
| 21 | Four-phase boss cleared → victory screen, results, high-score persistence | **pass** |
| 22 | Settings + high scores persist across reload; reset restores defaults | **pass** |
| 23 | Focus loss clears held keys and auto-pauses | **pass** |
| 24 | Degrades gracefully with Web Audio entirely absent | **pass** |
| 25 | Degrades gracefully when the audio clock stalls mid-run | **pass** |
| 26 | Touch controls (virtual stick + buttons) drive the ship | **pass** |
| 27 | Mouse pointer drag control | **pass** |
| 28 | Diagnostics derive from real scheduler/sim state | **pass** |
| 29 | Live status overlay shows all required fields | **pass** |
| 30 | Performance: 60 fps at 1280×800 with 100–2,600 bullets | **pass** |
| 31 | Tap-to-calibrate latency flow sets a real visual offset | **pass** |
| 32 | Musical presets / scale / root change the notes actually scheduled | **pass** |
| 33 | Per-track mute and the metronome toggle act on the audio graph | **pass** |
| 34 | **Audio timbre/mix heard by ear** | **blocked** — no audio device on this host |
| 35 | **Physical gamepad button mapping** | **not-run** — no gamepad attached |

---

## 3. Detailed observations

### 3.1 Audio start from a real gesture

`Input.dispatchMouseEvent` press/release on the labelled control
`▶ Enable Audio & Start` (measured bounding box, real mouse event):

```json
{"state":"COUNTDOWN","ctx":"running","sampleRate":44100,
 "countdownVisible":true,"cdText":"3"}
```

Before the gesture the status bar reads `AUDIO idle` and no AudioContext exists.
Screenshot: `screenshots/01-title-1280x800.png`, `screenshots/02-countdown.png`.

### 3.2 Audio ↔ gameplay synchronisation (t3-sync.mjs)

The probe wraps `sim.onPulse` and records, for every musical pulse that actually
spawned bullets, `Transport.nowT() − Transport.timeOf(pulse)` — i.e. how far the
visible spawn was from the moment that pulse was scheduled to sound.

```json
{"spawnEvents":30, "syncMeanMs":3.09, "syncSdMs":7.83,
 "syncMaxAbsMs":17.0, "syncP95Ms":16.98,
 "kicksScheduled":22, "kicksOffPulseGrid":0, "kicksOn16thGrid":22,
 "snareBeatPositions":[1, 3, 3.25, 3.5, 3.75],
 "simVsTransportMs":15.91, "bar":9, "fps":"60", "clock":"audio"}
```

* Every one of 22 scheduled kicks landed exactly on the 12-PPQ pulse grid (0 off-grid).
* Snares fall on beats 2 and 4 plus the pre-phase fill on beat 4's 16ths — the intended
  backbeat.
* Mean spawn-vs-sound error **+3.1 ms**, max **17 ms** ≈ one 60 Hz frame, which is the
  hard floor for a bullet that can only become visible on a frame boundary.

  *This number was originally +15.4 ms mean.* The simulation was targeting "now" instead
  of the middle of the frame about to be presented. A half-frame presentation lead was
  added (`loop()` in `index.html`), which recentred the error on zero. Re-measured after
  the fix — the figures above are post-fix.

Pattern spawn pulses observed in phase I: `96,108,120,132,144,156,168,174,180,186,192,204`
— multiples of 12 (quarter notes) plus 174/186 (`≡30, 42 mod 48`, the 8th-note
`curve` volley that the phase script fires on every 4th bar). Matches the script exactly.

### 3.3 Movement, focus, abilities (t1-gameplay.mjs, real held keys)

```json
"moveLeft":  {"from":360,"to":170.9,"dx":-189.1}      // 372 px/s × 0.5 s ≈ 186 ✓
"moveDiag":  {"dx":109.6,"dy":-109.6}                 // normalised diagonal ✓
"focusMove": {"focusFlag":true,"dx":-91,"ratioVsNormal":0.481}   // 168/372 = 0.45 ✓
"dash":      {"energyBefore":100,"energyAfter":71,"cost":29,
              "invulnGranted":0.192,"dashActive":true}
"bomb":      {"bombsBefore":3,"bombsAfter":2,"bulletsBefore":91,"bulletsAfter":74,
              "clearedDelta":33,"bossDamage":160,"invuln":1.33}
"graze":     {"graze":21,"combo":51,"maxCombo":51,"mult":2.96}
"shooting":  {"shotsFired":20,"perfect":8,"good":7,"offbeat":5}
```

Rhythm judgement is genuinely graded: of 20 shots, 8 PERFECT / 7 GOOD / 5 off-beat.
Off-beat shots still fire and still damage — the game stays playable when the rhythm is
ignored, as required.

Boss damage with the ship aligned (t2): HP 1250 → 1118 over 30 shots; sustained fire drove
a phase change to `PHASE 2/4 · II · SPIRAL`, music phase 1 → 2, HP bar `scaleX(0.75)`.

Screenshots: `03-gameplay-1280x800.png` (GOOD −86 ms judgement, live spectrum),
`06-phase1-focus-hitbox.png` (PERFECT GRAZE, focus reticle + white hitbox dot),
`07-phase4-overdrive.png` (hexagonal phase-4 boss, amber palette).

### 3.4 Pause / resume (t4-pause.mjs)

Paused with the `P` key, held for 3 s (≈1.6 bars of music), resumed with the labelled
**RESUME** button. Samples every 100 ms across the transition:

```
  t=  497  pulse=  139.16  blt= 137   PAUSED     <- four samples, 3 s apart in total
  t=  497  pulse=  139.16  blt= 137   PAUSED
  t=  497  pulse=  139.16  blt= 137   PAUSED
  t=  497  pulse=  139.16  blt= 137   PAUSED
  t=  506  pulse=  141.68  blt= 134   PLAYING    d= -3
  t=  518  pulse=  145.04  blt= 155   PLAYING    d=+21
  t=  532  pulse=  148.96  blt= 149   PLAYING    d= -6
  t=  546  pulse=  152.88  blt= 148   PLAYING    d= -1
  t=  560  pulse=  156.80  blt= 167   PLAYING    d=+19
  t=  574  pulse=  160.72  blt= 165   PLAYING    d= -2
```

```json
{"pulseFrozenWhilePaused":0, "tickFrozenWhilePaused":0,
 "bulletsFrozenWhilePaused":0, "audioSuspendedWhilePaused":true,
 "voicesKilledOnPause":0, "pulseJumpOnResume":0,
 "maxBulletDeltaPer100ms":21, "musicalPositionPreserved":true}
```

The simulation tick and the musical pulse are bit-frozen across the whole pause, the
transport re-anchors to the exact pause pulse on resume (`pulseJumpOnResume: 0`), and the
post-resume spawn rate oscillates around the normal per-beat radial burst
(+21 / −6 / −1 / +19 …) rather than emitting a single flush. A second cycle via the
status-bar **PAUSE** button behaved identically, and **RESTART RUN** from the pause screen
reset tick/score/phase (`tick 65, score 0, phase 0, COUNTDOWN`).

*(An earlier version of this test compared a pre-pause sample against a paused one, which
folded in the one frame between the snapshot and the keypress and reported a spurious
0.427-pulse "drift". The comparison now uses two samples taken while paused.)*
Screenshot: `12-pause-screen.png` (`transport frozen at bar 20 beat 4 · audio suspended`).

### 3.5 Deterministic seeds (t8c-seed.mjs)

Full simulation state captured *inside* the sim at exactly tick 600 of each run:

| run | checksum | bullets | fieldSum | bossX | bossY | rng calls |
|---|---|---|---|---|---|---|
| seed 12345 #1 | 1112814143 | 35 | 90037.1254 | 370.452095 | 211.78349 | 39 |
| seed 12345 #2 | 1112814143 | 35 | 90037.1254 | 370.452095 | 211.78349 | 39 |
| seed 99999 | 3085405485 | 35 | 96663.3763 | 393.311924 | 253.390359 | 39 |
| seed 12345, Lunatic | 160694890 | 66 | 177150.136 | 476.997692 | 190.535233 | 70 |

Same seed → byte-identical. Different seed → different bullet field and boss path.
Difficulty genuinely changes density (35 → 66 bullets) and boss HP (1250 → 1937.5).

### 3.6 Replay (t5-replay.mjs)

A short lethal run was played with a scripted key sequence, exported from the UI textarea
via the **EXPORT** button, then re-imported with **IMPORT + PLAY**:

```
{"v":1,"seed":"4242","bpm":128,"diff":"normal","lives":1,"off":0,"adaptive":true,
 "af":false,"preset":"neonPhrygian","arena":[720,960],"ticks":1202,"sum":750131783,
 "ev":"0:0,283:4,47:32,39:8,..."}          252 bytes, 13 events
```

Two independent record→replay cycles:

```
run 1975 ticks / replay 1975 ticks | {"ticks":true,"checksum":true,"score":true,
                                      "graze":true,"bossHp":true,"maxCombo":true}
run 1202 ticks / replay 1202 ticks | (same, all true)
```

The in-app verifier displays `checksum match (750131783)` with the OK pill.

### 3.7 Pattern lab and step editor (t6-lab.mjs)

`sim.emit` was instrumented to log `(patternId, pulse, step)`.

* Pattern **spiral** at subdivision **1/8** → observed pulse gaps `[6]` exactly.
* Changed the subdivision select to **1/16** mid-run → gaps became `[3]` exactly.
* Step grid: lit cells 0, 6, 10 in lane 0 (pattern `wall`) → `wall` fired on steps
  `[0, 6, 10]` and nowhere else; the counter read `3 cells`.
* Clicking cell 6 off → subsequent firing on `[0, 10]` only.
* Preset **NIGHTMARE** → tempo really moved to 168 BPM (transport, setting and label),
  pattern `bloom`, subdivision 2 (16th triplets), density 26 → 2,583 live bullets.

Screenshot: `08-pattern-lab-nightmare.png` (60 fps at 2,583 bullets).

### 3.8 Accessibility and settings (t7-a11y.mjs, t7b-flash.mjs)

```json
"normalFlash":  {"peakFlash":0.55,"shake":4.46,"bombs":4}
"reducedFlash": {"peakFlash":0,   "shake":14.41,"bombs":0,"cleared":6}
"reducedMotion":{"shakeAfterAdd":0,"htmlAttr":"reduced","particleMul":0.35}
"shakeOff":{"shake":0}  "shakeOn":{"shake":30}
"highContrast":{"attr":"high","bodyInk":"rgb(255,255,255)"}
palettes: neon #ff2e88 → deuter #3aa0ff → mono #ffffff (sprite atlas rebuilt, 45 sprites)
difficulty seg: chill dens 0.62 / lunatic dens 1.85, button state follows
```

Reduced flash removes the full-screen flash while the bomb still clears bullets and shakes.
Tempo slider at 164 BPM produced exactly **32.8 pulses/s** measured over 1.5 s
(expected `164/60 × 12 = 32.8`) with no positional jump.

### 3.8b Latency calibration and musical controls (t17-calib-presets.mjs)

**CALIBRATE BY TAPPING** was driven to completion. The harness watched the transport and
pressed `Space` just before each of eight beats:

```json
"calibStarted": {"state":"tap SPACE on the click","val":"0/8","metronomeOn":true}
"calibResult":  {"state":"done","val":"median -36 ms","offset":36,
                 "slider":"36","label":"36 ms"}
"calibReset":   {"offset":0,"label":"0 ms"}
```

Taps that land early yield a negative median and a positive offset, which pulls gameplay
*earlier* to match the player's perception — the inverse case (late taps → negative
offset, visuals delayed to match delayed audio) follows from the same expression.
The metronome is switched on automatically for the duration.

`AudioEngine.bassNote` / `leadNote` were wrapped to log the MIDI numbers actually
scheduled, then the preset/scale/root controls were driven:

| control state | distinct notes scheduled |
|---|---|
| `neonPhrygian`, A Phrygian dominant, root 45 | bass 33 40 52 58 · lead 57 61 64 67 69 70 73 — all members of A B♭ C♯ D E F G |
| `glassLydian` (tempo also moved to 112 BPM) | bass 36 43 50 55 62 · lead 60 64 67 69 71 74 76 83 86 — all diatonic to C Lydian |
| root changed to 52 (E) | bass 40 46 47 52 59 64 · lead 64 68 70 71 73 76 82 85 88 — all diatonic to E Lydian |

Muting the bass track drove `bus.bass.gain` to exactly `0`, un-muting restored `0.68`.
The metronome checkbox toggled `S.click`, which gates the click voice in `Music.onPulse`.

### 3.9 Viewports

* **1280 × 800** — arena 554 × 738 letterboxed, HUD cards in the side margins,
  waveform/spectrum panel bottom-right. 60 fps with 129 bullets.
* **390 × 844, devicePixelRatio 3** — HUD auto-stacks into the top band, boss bar sits
  directly above the arena, energy meter hugs the arena bottom, touch controls below.
  `document.body.scrollWidth === window.innerWidth` (no horizontal overflow).
  Canvas backing 780 × 1578 (DPR clamped to the user's Max-DPR setting of 2). 57–60 fps.
* **Live resize during a run** — 1280×800 → 900×620 @DPR 2 → 1600×900: backing store,
  bloom buffer and cached background/vignette all rebuilt, `w === round(cw × dpr)`, and
  the run kept playing (`state: PLAYING`, pulse continued advancing).

Screenshots: `04-narrow-gameplay-390x844.png`, `05-narrow-title-390x844.png`.

### 3.10 Direct `file://` open

```
agent-browser open file:///…/index.html
{"url":"file:///…/index.html","protocol":"file:","pulse":"object","nodes":942}
errors: (none)
network requests: [1] GET file:///…/index.html (Document) 200      ← the only request
```

Audio started from the gesture (`ctx running`, 44100 Hz), 60 fps, `localStorage OK`,
and all nine internal self-tests passed under `file://`.
Screenshot: `11-file-protocol-gameplay.png`.

### 3.11 Victory and persistence (t9-victory.mjs)

All four phases were cleared by fire, with the music phase advancing in step:

```
PHASE 1/4 · I · PULSE      musicPhase 1
PHASE 2/4 · II · SPIRAL    musicPhase 2
PHASE 3/4 · III · GRID     musicPhase 3
PHASE 4/4 · IV · OVERDRIVE musicPhase 4
→ VICTORY "SYSTEM CLEARED"
```

Results panel: score 193,901 · best 193,901 · max combo 192× · graze 14 · accuracy 75.4% ·
perfect/good/off 168/148/103 · hits 5 · bullets cleared 506 · phase 4/4 · time 0:34 ·
seed 777 · difficulty Chill.
`localStorage["pulsecannon.scores.v1"].best = 193901`, 6 runs stored, and the value
survived a reload (`uiBest = "193,901"`).
Screenshot: `09-victory-results.png`.

Settings persistence was checked independently: difficulty *hard*, particles *45%*,
palette *deuter* set through the real controls all survived a reload with the UI in
the matching state. **Reset everything** restored defaults and cleared stored scores.

### 3.12 Diagnostics

`13-diagnostics-overlays.png` shows the panel with 47 live rows across three groups —
ctx state / clock source / ctx.currentTime / sampleRate / base + output latency /
look-ahead horizon / pump interval / worst pump gap / scheduler cost / events in the last
window / pump count / bpm / seconds-per-pulse / transport pulse + beat / next scheduled
pulse / live voices; sim tick, rate, pulse, bar.beat, gameplay time, sim-vs-transport
error, steps last frame, visual offset, bullets, shots, lasers, boss HP, phase, adaptive
density, rng calls, checksum, desyncs, timing error mean and sd; fps, dropped frames,
device DPR, render DPR, canvas backing, css size, arena scale, bloom buffer, particles,
quality. Collision-bounds, beat-ruler, spawn-marker and timing-histogram overlays were
enabled and render over the playfield.

### 3.13 In-app self-test

Reachable from the DIAG tab; run in the final build over HTTP and over `file://`:

```
PASS  transport pulse<->time roundtrip
PASS  seeded rng reproducible
PASS  replay log encode/decode
PASS  all 14 patterns produce entities
PASS  bullet at player is inside hit radius
PASS  fixed-step sim is deterministic  (3470166554:145:1250 vs 3470166554:145:1250)
PASS  audio graph built  (running, clock=audio)
PASS  bullet sprite atlas  (45 sprites)
PASS  zero external resource references  (0 found)
```

### 3.14 Self-containment audit

```
grep -Eo 'https?://[^"'"'"' )]+' index.html      → (nothing)
grep -Eo '(src|href)="[^"]*"'  index.html        → href="data:,"   (favicon stub only)
grep -E 'fetch|XMLHttpRequest|WebSocket|EventSource|importScripts|sendBeacon|import\(' → (nothing)
grep -E '@import|url\(|font-face'                → (nothing)
<script> tags: 1        <style> tags: 1        eval/new Function: (nothing)
```

---

## 4. Failures found during validation, and their fixes

Every item below was found by the tests above, fixed in `index.html`, and re-tested.

| # | Symptom observed | Cause | Fix | Retest |
|---|---|---|---|---|
| 1 | 26–28 fps at 1280×800 with ~100 bullets | Three full-screen per-pixel passes each frame: `ctx.filter='blur()'` bloom at full resolution, a radial background gradient, a radial vignette, plus `shadowBlur` on the arena border | Bloom now blurs inside the 1/3-scale buffer and composites unfiltered; background and vignette baked into offscreen canvases on resize; glow discs baked as sprites; border glow drawn as a wide translucent stroke | 60 fps at 129 bullets; **60 fps at 2,583 bullets** |
| 2 | Energy meter never rendered a bar | `.meter > i` was absolutely positioned with `left:0` and no `width`, so its box was 0 px wide | added `width:100%` | bar fills and animates |
| 3 | `sim.nB` went **negative** | `playerHit()` calls `clearBullets()` from inside the collision loop, which already retired the current bullet; the loop then decremented again | guard the decrement with `if (b.alive)`; also removed a double count of `bulletsCleared` | counter stays exact across thousands of hits |
| 4 | Self-test "fixed-step sim is deterministic" **failed** | `sim._cur` (pool cursor), `_idle`, `prevMask` and several `game.*` counters survived `sim.reset()`, so a second run diverged | reset them in `sim.reset()`; introduced `resetRunState()` as the single source of truth used by both `startRun()` and the self-test | test passes; two 900-tick runs identical |
| 5 | Same seed produced different state at a fixed tick | The COUNTDOWN → PLAYING transition happened in the rAF loop, so the first gameplay tick depended on frame timing | transition moved inside `sim.step()`, keyed on `pulseAcc` | byte-identical at tick 600 |
| 6 | Replay tick count differed by 1–2 from the recorded run | after `endRun()` fired mid-frame the stepping loop kept running the remaining ticks of that frame | `break` out of the step loop when the state stops being playable | replays match tick-for-tick, twice |
| 7 | Spawn appeared on average **+15 ms after** its sound | the sim targeted `now()` rather than the frame about to be presented | half-frame presentation lead in `loop()` | mean error +3.1 ms, max 17 ms |
| 8 | After a page reload the AudioContext reported `running` while `currentTime` stayed at 0 — the whole transport froze | the previous page's context was never closed, and this host has no audio device | `pagehide` closes the context; added a transport **clock watchdog** that detects a non-advancing clock and moves the transport to the system clock, keeping the game playable | reload path works; watchdog verified firing mid-run with a user-visible toast |
| 9 | **Un-pausing could hang forever** when the audio device is wedged (`ctx.resume()` never settles) | `resumeRun()` waited on that promise unconditionally | resume now races the promise against a 350 ms timeout | verified with a stubbed never-settling `resume()`: game resumed and the sim advanced |
| 10 | Boss HP bar overlapped the score/combo cards at 390 px | HUD was anchored to the viewport, not to the letterboxed arena | arena rect published as CSS variables on resize; HUD hugs the arena and stacks into the top band when the side margins are too thin | clean at 390×844; touch buttons no longer overlap the playfield |
| 11 | **Reset everything** left the in-memory settings stale | the handler rebound `S` to a new object; any code holding the old reference kept the old values | mutate `S` and `HIGH` in place instead of rebinding; also reset `bestScore` and the displayed best | reset now clears settings, scores and UI together |
| 12 | Opening ~1.5 s after the count-in had no bullets at all | the boss carried 1.5 s of start-up invulnerability, which also gates pattern emission | initial invulnerability set to 0 (phase transitions keep theirs) | first radial burst lands on the first downbeat after the count-in |
| 13 | `Tab` (options drawer) trapped keyboard focus navigation | the key was swallowed unconditionally | `Tab` passes through while the drawer is open; focused buttons blur on Space so it reaches the game | drawer is keyboard-navigable |
| 14 | Self-test reported PASS for the determinism check when it had actually skipped it | the skip path set the result to true | it now emits an explicit `SKIP` line | honest output |

### Not app bugs (harness artifacts, recorded for completeness)

* An early flash test measured the virtual thumb-stick rect while the touch UI was hidden
  (all zeros), and clicked at (0, 0). Re-measured after the UI was on screen — stick works.
* A test used `delete fx.flashAdd` to remove a spy, which deleted the real function and
  made `sim.step()` throw. The visible effect (a bomb firing every tick) was caused by the
  harness, confirmed by the function being present again after reload.
* One seed comparison sampled the two runs on opposite sides of a checksum epoch. Replaced
  with an exact-tick capture inside the sim.

---

## 5. Limitations and honest gaps

1. **Audio was never heard.** This host has no audio device. What *was* verified: the
   AudioContext reaches `running` at 44.1 kHz only after a real gesture; `currentTime`
   advances; the look-ahead scheduler schedules nodes at exact pulse times (22/22 kicks
   on-grid); per-bus AnalyserNodes report non-zero, differentiated levels
   (`drums 0.029, bass 0.117, lead 0.024, pad 0.023`) while the master analyser sums to
   29,040 across its bins, which the on-screen spectrum/waveform panel renders. That
   establishes that signal is flowing and correctly timed. It does **not** establish that
   the music sounds good, that the mix is balanced, or that no voice clips. Marked
   **blocked**, not passed.

2. **The audio clock stalls in this container.** After roughly 25–60 s of play, Chrome's
   null audio sink stops advancing `AudioContext.currentTime` while still reporting
   `running`. This is an environment limitation (no `/dev/snd` PCM device), not app
   behaviour — it also occurred with `--autoplay-policy=no-user-gesture-required
   --mute-audio`. The app detects it within ~1 s, moves the transport to the system clock,
   and tells the user; gameplay continues at full speed. Long-session audio behaviour on a
   machine with a real sound device is therefore **untested**.

3. **No physical gamepad.** `navigator.getGamepads()` is polled and the absent case is
   exercised (the settings panel shows `none`, no input is injected, nothing throws).
   The actual button/axis mapping is **not-run**.

4. **Real touch hardware.** The virtual stick and buttons were driven with synthetic
   pointer events at real coordinates and do move the ship and fire. Multi-touch
   (stick + fire simultaneously with two fingers) was not exercised; each control is
   pointer-captured independently, so it should work, but that is reasoning, not evidence.

5. Headless Chrome renders via software rasterisation here. The 60 fps figures are
   therefore a floor, not a ceiling; a GPU-backed browser will have more headroom.

---

## 6. Reproducing this run

```bash
cd /home/pyro/projects/naked/opus5/12-rhythm-bullet-hell
python3 -m http.server 8712 --bind 127.0.0.1 &

./evidence/harness/ab.sh open http://127.0.0.1:8712/index.html
./evidence/harness/ab.sh click "#btnEnableAudio"
WS=$(./evidence/harness/ab.sh get cdp-url | tail -1)

node evidence/harness/t3-sync.mjs   "$WS"    # sync statistics
node evidence/harness/t4-pause.mjs  "$WS"    # pause/resume drift
node evidence/harness/t5-replay.mjs "$WS"    # replay determinism
node evidence/harness/t6-lab.mjs    "$WS"    # pattern lab + step grid
node evidence/harness/t8c-seed.mjs  "$WS"    # seeded determinism
node evidence/harness/t9-victory.mjs "$WS"   # full clear
node evidence/harness/t13-noaudio.mjs "$WS"  # Web Audio removed
node evidence/harness/t17-calib-presets.mjs "$WS"   # calibration + musical presets
```

The in-app self-test is reachable without any harness: **MENU → DIAG → RUN INTERNAL CHECKS**.
