# SYNCOPATH — validation log

Artifact: `index.html` (single file, 179 KB, no external `src`/`href`/URLs; CSP `default-src 'none'` blocks any network fetch).
Everything below was exercised against the real application in a real Chromium via **agent-browser 0.31.1**
(skill read via `agent-browser skills get core --full` and `agent-browser skills get dogfood`). Chrome build: 152.0.7977.54 (headless), Linux/WSL2.

## Environment notes (read first)

| Item | Detail |
|---|---|
| HTTP server | `python3 -m http.server 18931 --bind 127.0.0.1` from the project dir. Port 8765 was already taken by another project's server (it served a different app) — switched ports. |
| External network | `agent-browser network route 'https://**' --abort` in every session, plus the page's own CSP `default-src 'none'`. `network requests` at the end of each regression shows exactly **one** request: `GET /index.html`. |
| Audio sink workaround | In this WSL2 box, the default PulseAudio sink (WSLg RDP sink, no consumer) back-pressures Chrome: `AudioContext.currentTime` advanced only 0.14–0.6 s per wall second and `outputLatency` grew to ~1 s. All tests were run with `PULSE_SERVER=unix:/nonexistent/pulse`, which makes Chrome fall back to its null output stream; the audio clock then tracks wall time 1:1 (measured: 0.601→1.622→2.633→3.643 s at 1 s intervals, baseLatency 10 ms, outputLatency 32 ms). This is an environment fix, not an app change. |
| Audio was **not listened to** | No speakers/ears in the loop. Audio correctness was verified through the actual output `AnalyserNode` (RMS/peak/spectrum), audio-graph gain values, and by hooking the synth voice functions to log scheduled notes and times. "Sounds good" is **not** claimed. |
| Test probes | Read-only helper functions injected at test time (`evidence/harness/*.js`) read `window.SYNCOPATH` (a read-only handle the app exposes) or wrap functions to log timing. Inputs were always real CDP input (`press`, `keydown/keyup`, `click`, `mouse`, `select`, `fill`) unless stated otherwise. |
| Key event quirk | agent-browser's `keydown <key>` delivers `KeyboardEvent.key` with an **empty `code`** (only `press Space` sets it). Found in testing → the app now normalises `key`→`code` (robust for virtual keyboards too). |

## Result summary

| # | Check | Result |
|---|---|---|
| 1 | Title → enable audio via real click (user gesture); AudioContext `running` | **pass** |
| 2 | Transport / beat indicator / enemy emissions / audible events share one clock | **pass** (measured, see §2) |
| 3 | 8-direction movement, focus mode (slower, visible hitbox + graze ring) | **pass** |
| 4 | Dash + burst abilities with cooldown / resource cost | **pass** |
| 5 | Intentional damage, collision geometry, lives, i-frames | **pass** |
| 6 | Timing judgement (perfect/good/miss), combo, multiplier, accuracy, score | **pass** |
| 7 | Pause/resume after several beats — no drift, no bullet backlog | **pass** |
| 8 | Restart (R from pause, Retry from results, same seed) | **pass** |
| 9 | Pattern lab: pattern/tempo/subdivision/density/speed/seed + step grid alters actual scheduling, live | **pass** |
| 10 | Deterministic seeds (same seed identical, different seed different choreography) | **pass** (after fix, §9) |
| 11 | Replay export → import → headless verify → real-time watch; tamper detection; malformed input errors | **pass** |
| 12 | Multi-phase boss: 4 phases, phase break, arrangement/mix change, riser/crash on the bar line | **pass** |
| 13 | Victory + failure + results screens, high-score persistence across reload | **pass** (victory via bot-generated input log replayed through the UI — see §12) |
| 14 | Reduced flash (measured), reduced motion, high contrast, colour-vision palette | **pass** (reduced motion visually spot-checked only) |
| 15 | Track mute / track volume / master volume change actual output | **pass** (analyser RMS) |
| 16 | Music presets/scales change synthesized content | **pass** |
| 17 | Latency calibration (tap test) + offset apply/reset | **pass** |
| 18 | Diagnostics panel (F3) + live status overlay + collision bounds | **pass** |
| 19 | Key remapping | **pass** |
| 20 | Stuck inputs after focus loss (tab switch while key held) | **pass** |
| 21 | Narrow viewport 390×844 (DPR 3) incl. lab, touch bar, pointer-drag steering | **pass** |
| 22 | Desktop 1280×800 | **pass** |
| 23 | Direct `file://` open | **pass** |
| 24 | Graceful degradation without Web Audio | **pass** (AudioContext deleted via init script) |
| 25 | Gamepad | **partial** — synthetic Gamepad API object injected; **no physical controller available (blocked)** |
| 26 | Real touch hardware / touch events | **blocked** — device emulation did not enable coarse pointer; touch UI forced on via Settings and driven with mouse pointer events |
| 27 | Console errors / uncaught errors / failed requests | **pass** — `agent-browser errors` empty throughout the final runs; no failed requests |
| 28 | Other browsers (Firefox, Safari) | **not-run** |

## 1. Load, title, audio enable
```
agent-browser open about:blank; agent-browser network route 'https://**' --abort; agent-browser set viewport 1280 800
agent-browser navigate http://127.0.0.1:18931/index.html
agent-browser snapshot -i            # title: "▶ ENABLE AUDIO & ENTER", "CONTINUE WITHOUT AUDIO"
agent-browser find role button click --name "Enable audio"
```
Observed: state `menu`, `audio.state=running`, menu loop scheduled (voices counted), spectrum + waveform canvas animating from the real `AnalyserNode`. Screenshots `01-title-1280.png`, `02-menu-1280.png`.
**Failure found:** first menu screenshot showed the centre column collapsed (grid `minmax(0,auto)`). **Fix:** explicit stage width from viewport height. Re-shot `02-menu-1280.png`.

## 2. Audio ↔ gameplay synchronisation (measured)
Harness `syncmeasure.js` wraps `sim.previewPulse` (what the audio scheduler asks when it schedules a pulse) and `sim._pulse` (when the simulation actually spawns bullets) during a live run.

Phase 2 (8th-note spiral), ~6 s of play:
```
emittingPulsesSim 33, emittingPulsesAudio 34, matched 33, onlySim [], onlyAudio []
simFireAfterAudioTimeMs {min 45.8, max 65.2, mean 55.4}   latencyCompMs 42
scheduleLeadMs          {min 97.4, max 119.8, mean 110.8}  (look-ahead was 120 ms then; now 180 ms)
step16Histogram {0:5, 2:4, 4:4, 6:4, 8:4, 10:4, 12:4, 14:4}  (exactly the layer's 8th-note mask)
```
Interpretation: every emission the audio scheduled is the same pulse the sim fired; the sim fires when the sound is *heard* (42 ms output-latency compensation + ≤1 frame), audio is scheduled ~110 ms ahead. After a live lab tempo change 110→140 BPM: 7/7 matched, 51.5–62.3 ms, lead 98–120 ms.
Diagnostics panel values from the live run (F3): `look-ahead 180ms horizon +171ms min lead 151.7ms late/skipped 0 … behind audio 12.4ms backlog 0t` (`24-diagnostics.png`).

## 3. Movement / focus / hitbox
`probe.js` (`__q()`) prints sim state. Real key input:
```
agent-browser batch "keydown ArrowLeft" "wait 350" "keyup ArrowLeft" "eval __q()" \
  "keydown ArrowUp" "keydown ArrowRight" "wait 300" "keyup ArrowUp" "keyup ArrowRight" "eval __q()" \
  "keydown Shift" "keydown ArrowRight" "wait 400" "screenshot …05-focus-hitbox.png" "eval __q()" …
```
Observed: x 240→144.2 (≈250 u/s); diagonal Δx +62.2 / Δy −58.1 (normalised); focus `true` at ~105 u/s; focus shows graze ring + enlarged hitbox, drawn above bloom (`05-focus-hitbox.png`).
**Failure found:** arrow keys did nothing at first (empty `e.code` from agent-browser) → **fixed** with key→code normalisation, retested pass.

## 4. Abilities
- Dash (Space/Z): displacement ~83 u, 0.24 s i-frames, cooldown 1.1 s ×0.5 (perfect) / ×0.75 (good) / ×1 (miss) — observed `dashCdMax 0.55 / 0.825 / 1.1`.
- Burst (X/C): needs Pulse 100. Lab run, invulnerable practice + "Chaos engine" preset (~750 live bullets): Pulse 100→4 (−100, +4 for GOOD), **183 bullets cancelled** into score, i-frames granted; immediate second press denied ("PULSE < 100"). `09-burst.png`.
**Failure found:** first burst press ignored because keyboard focus was still on a lab `<select>` (form fields swallowed all keys). **Fix:** text fields keep keys; select/slider/checkbox keep only navigation keys; action keys pass through; tapping the arena releases focus. Retested pass.

## 5. Damage, collision correctness, i-frames
`hits.js` hooks the hit handler and measures the nearest bullet at the moment of each hit; also counts bullet/hitbox overlaps while invulnerable. Standing still on Normal:
```
hits 3, overlapsWhileInvulnerable 33, gapsBetweenHits ["2.02s","2.67s"]
hit1: dist 5.65 < threshold 5.84 (lives 5→4, inv→2.0)
hit2: dist 5.47 < 5.84 (4→3)   hit3: dist 4.55 < 5.84 (3→2)
```
Every hit had a bullet inside `r·0.72 + hitR`; 33 overlap ticks during i-frames cost nothing. Hit feedback `07-hit-feedback.png`. Boss/drone bodies were **not** hazards initially (dashing into the boss was free) → **added** body collision.

## 6. Rhythm judgement, combo, scoring
`timing.js`: `__rdy(x)` returns true when the next beat is x ms away; the harness then sends a real `press Space` (anticipating like a player; pipeline latency ≈ 40 ms).
```
wait --fn __rdy(40) → press Space   (×3)   → p−23, p+14, p+5
wait --fn __rdy(115) → press Space         → g−74 (early)
wait --fn __rdy(420) → press Space         → g+67 (late)
wait --fn __rdy(267) → press Space         → m+220 (OFF-BEAT)
```
All classified correctly for Normal (perfect ±45 ms, good ±100 ms). Accuracy shown 66.7% = (3+0.5·2)/6 ✓. Pulse +8 per perfect, combo increments, meter READY state, timing meter marks early/late. `08-judgement.png`, `08b-perfect.png`. Beat grazes counted separately (e.g. `GRAZE 34 (7♪)`).

## 7. Pause / resume (no drift, no backlog)
`sync.js` (`__sync(n)`), real Escape presses:
```
1 running  ctxT 20.4916 songBeat 6.314 simBeat 6.267 simMinusSong −21.4ms tick 560 late 0 bullets 44
2 paused   ctxT 20.4916 (frozen, AudioContext suspended)            tick 560
3 +3 s     ctxT 20.4916 songBeat 6.314 simBeat 6.267               tick 560 late 0 bullets 44
4 resumed+0.4s ctxT 20.9328 (+0.44 s) songBeat 7.284 (+0.97 beat)  tick 614 (+54)
5 +3.4s    ctxT 23.9601 songBeat 13.944 simBeat 13.912 −14.8ms late 0 bullets 50
```
Audio time, transport and sim stop together and continue from the same point (0.44 s → 0.97 beat at 132 BPM). No skipped pulses, no bullet burst. Final regression repeats this (`regression-output.txt` §3). `06-paused.png`.

## 8. Restart
Pause → `R`: new run from `countdown t8 beat −3.85`, same seed (regression §4). Results → Retry (and Space on focused Retry) also restart.

## 9. Seeds / determinism
`seed.js` runs the exported `Sim` headless with scripted input:
- Before fix: seed 1337 vs 1338 gave different hashes **but identical bullet positions/score** — the seed only changed RNG state. **Failure** (seeds didn't change the choreography).
- **Fix:** every pattern layer now derives a rotation offset/shape parameter from the seed plus per-fire jitter from the seeded RNG.
- After: `storySameSeedIdentical true, storyDiffSeedDiffers true` — 1337: first bullet (122.1, 644.8), score 2645; 1338: (−11.8, 680.9), score 5314. Lab: same true / different true (713 vs 734 bullets).

## 10. Replays
UI flow (all real clicks): seeded Easy run "demo-42" with real moves/dashes → pause → Quit (quitting now saves the replay) → Replays → **Export current / last run** → `story · seed demo-42 · 934 ticks (7.8 s) · score 1,515 · hash 246c1725 · 442 chars` → **Verify (headless)** → `✔ Deterministic match — 1,515, 246c1725` (live sim hash at pause was also `246c1725`) → **Watch** → plays in real time with audio → results `Replay · … ✔ identical to recording`. Screens `12`–`14`.
Error states: `hello world` → "Not a SYNCOPATH replay code"; `SYNC1:e30=` → "malformed or unsupported version"; one flipped input entry → `✖ Mismatch — 7,507 vs recorded 17,497`; original → `✔`. `35-replay-tampered-vs-original.png`. Import now also validates lab configs / events (**added** after code review: a malformed lab replay could previously throw inside the sim step) and a sim exception can no longer kill the main loop.

## 11. Pattern lab
Real `select`/`click`/keyboard on the lab panel; `labmeasure.js` logs every emission the lab sim performs.
- Preset "02 Heartbeat rings" (1/4): A fires at pulses 0,24,48,72; B at 12,60 — matching `x.x.x.x…` / `.x...x…`.
- Subdiv 1/16, **Clear**, click A step 1 + A step 5 + B step 9 → A at `pulse%48 ∈ {0,12}`, B at `{24}` — the grid drives scheduling.
- Tempo slider +30 (ArrowRight ×30) → queued, applied on the bar line: segments `0@110, 52@140`; later emissions at 140 BPM; sync re-measured 7/7 matched.
- Final regression §5: grid A={0}, B={24}; tempo `0@110, 8@120`.
**Failures found/fixed:** preset dropdown went blank after choosing a preset; lab "Restart" used the initial rather than current editor config; narrow-screen lab drawer covered the ship → now in-flow and collapsed by default.

## 12. Boss phases, arrangement, victory, failure
- Phases 2–4 reached via the **Start at: Phase N · practice** option (added; practice runs are excluded from high scores): `16-phase2/3/4.png` — distinct boss colours/shapes; walls/lanes/lasers/rain in Bass Drop; orbit/flower/ratchet/curves in Crescendo.
- Headless bot (`bot.js`) over whole fights: phases progress by damage or by the per-phase bar timer (e.g. `ph1@0s ph2@40s ph3@85.5s ph4@130.9s`), bullet peaks 100–290, ~0.1 s CPU for 190 s of simulation.
- Phase transition in the UI (bot input log watched as a replay, `botreplay.js`, `mix.js`, `cues.js`): at beat 72.17 `pending → phase 2 at beat 76, riser at 75`; audio hooks logged **riser scheduled for beat 75.000 and crash for 76.000**, ~170 ms ahead; after the bar: `arrangement p0→p1`, track buses retargeted (bass .95→1, lead .9→.95, pad .8→.75). `33-phase-break.png`, `34-phase2-entered.png`.
- **Victory:** I could not survive a full fight through CLI key presses, so a headless bot generated an input log (Easy, practice from phase 4, seed 12) in the app's own replay format (`evidence/bot-victory-replay.txt`). It was pasted into Replays → Verify `✔ 127,706 / 3ee63b67` → Watch → boss destroyed (`18-boss-down.png`) → results "Phase: cleared … ✔ identical to recording" (`19-victory-results.png`). The victory path is therefore exercised through the real UI/audio, but driven by a recorded bot log, not live human input.
- **Failure:** standing still on Normal → 5 hits → "Signal lost" results with stats/hash (`27-gameover.png`).
- **Persistence:** reload → menu "Best score: 2,900", High scores table lists the run (`28-highscores.png`). (Two identical rows: two AFK runs with the same seed produce the same deterministic score; an equal score is correctly not flagged "new best".) Fixed: HUD BEST read 0 for the first second after reload; replays/practice no longer inflate the BEST display.

## 13. Accessibility & visual settings
- **Reduced flash** (`lum.js`, mean arena luminance of the rendered canvas at the frame right after a hit): off → 28.3→51.8 (+83 %), red cast +58.6; on → 22.7→32.1 (+41 %), red cast +12. Burst/phase white flashes disabled, bloom halved. `15-hit-reducedflash-off/on.png`.
- High contrast palette (black arena, outlined bullets) `32-high-contrast.png`; colour-vision palette selectable; screen-shake toggle; reduced motion (static grid scroll, slower stars, no shake) — spot-checked only; render quality (auto/low/medium/high).
- Hitbox is drawn after bloom with black+white+pink rings in every mode.
- Boss hit-flash was a large white disc under constant fire → **toned down** to a ring + small core.

## 14. Audio mix controls (actual output)
`energy.js` averages RMS/peak of `AnalyserNode` time-domain data over 1.5 s (menu loop):
```
baseline rms 0.2082 | all 5 tracks muted 0.0056 (reverb tail) | drums only 0.0195 | unmuted 0.2412
master 0 (Home key on slider) → rms 0.0000 | master 1 → 0.2327 | restored 0.8, persisted in localStorage
```
Presets (`notes.js` logs synthesized lead/bass MIDI notes): Neon A-aeolian 132 BPM (C E A G F B), Storm E-phrygian 150 BPM (F♮ present), Rain C-major-pentatonic 104 BPM (no F/B).

## 15. Latency calibration
Settings → Calibrate → 9 real Space taps timed ~80 ms late (`calib.js`): deltas `70,48,50,89,49,49,69,78,68` → median 68 ms − auto-comp 42 ms → suggested **+26 ms** → Apply → `settings.offsetMs = 26`; Reset offset → 0. `31-calibration.png`.

## 16. Input robustness
- Remap: Settings → Rebind dash → `J` → toast "dash → J"; in game Space no longer dashes, J does; Reset keys → Space.
- Focus loss: hold ArrowLeft → `tab new` → back: paused ("Window lost focus"), held keys `[]`; resume without ever sending keyup → x unchanged (181.7) while ticks advance. No stuck input.
- Pointer: relative drag in the arena, 60 px → −98 units (= 60/0.692·1.15). Touch bar Focus/Dash/Burst/❚❚ work (Focus shows pressed state).
- Gamepad (synthetic object via `fakepad.js` init script): A on menu starts run, stick/d-pad move, LB focus, A dash (judged), Start pauses. **Physical controller: blocked.**
- Added: render-stall watchdog (pauses if no frame for 750 ms during a run). (While chasing a suspected stall I mis-read my own probe — the sim was fine; the watchdog stays as a safety net.)

## 17. Layout / viewports
- 1280×800: HUD columns, arena 600×800-ish, lab panel in right column.
- 390×844 DPR 3 (iPhone 14 emulation): compact 3-column HUD, arena 378×504 (story) / 310×414 (lab collapsed), status + visualiser cards, touch bar. Several fixes were needed: lab drawer overlaying the ship, pause button wasting a row, arena shrinking to 143×190 with the lab open, spectrum canvas overflowing. Final: `91-regress-narrow.png`, `22-narrow-run-touch.png` (earlier layout), `23-narrow-lab.png`.

## 18. file:// and degradation
- `agent-browser navigate file:///…/index.html` → enable audio → run: `location.protocol file:`, audio running, game running, no errors, one request (the document). `26-file-protocol.png`.
- No Web Audio (`noaudio.js` deletes `AudioContext`): title shows "Web Audio: unavailable — visual-only mode", toast explains, pausable fallback clock drives the same transport; movement/pause/resume verified (tick frozen 374→374 while paused, +122 ticks in 1 s after resume). `29-no-webaudio.png`.

## Final regression
`evidence/harness/regression.sh` (output in `evidence/regression-output.txt`) — run after the last code change: load errors none; audio running; move/focus/perfect dash (−30.5 ms); pause frozen / resume −14.6 ms, late 0; R restart; lab grid A{0} B{24}; tempo 110→120 at bar; replay export+verify ✔; narrow arena 378×504; no page/console errors; only `index.html` requested. `node --check` on the extracted script: OK.

## Remaining limitations (honest)
- Audio quality/mix was never *heard*; only measured.
- Physical gamepad and real touch hardware not tested; Firefox/Safari not tested (the code avoids Chrome-only APIs except optional `ctx.filter` for bloom, which degrades to a downscale-only bloom).
- Victory/all-phase clear was demonstrated with a bot-generated input log replayed through the UI, not by live human play.
- In this headless environment frame rate was ~50–60 fps normally and ~46 fps with ~750 bullets (software rendering); auto quality steps down if it stays under 45 fps.
- Balance is tuned from bot runs and short manual sessions, not from human playtesting.
- Replays reproduce exactly on the same simulation version/JS engine; cross-engine floating-point differences are not guaranteed identical.
