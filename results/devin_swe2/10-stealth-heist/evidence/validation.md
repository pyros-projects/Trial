# NIGHTSHIFT — Stealth Heist Sandbox: Validation Report

Artifact under test: `../index.html` — single self-contained file (2,089 lines,
no external assets, imports, fonts, or network calls; Canvas renderer + Web Audio
synth; fixed-step 60 Hz sim).

## Environment & tooling

- Browser: Chrome via `agent-browser` CLI (CDP). Health check: 11 pass / 1 warn / 0 fail.
- Local server: `python3 -m http.server 8799` (dev tool only — not a runtime dep).
- Sessions: `heist` (HTTP, desktop + narrow), `heist2` (file:// + HTTP).
- Sim-level validation used the in-page `GAME`/`step()`/`newSim()`/`replaySim()`
  handles — all drive the real fixed-step simulation, not mocks.

## Method notes

- "Solver sweeps" run `newSim()` + `step()` headlessly inside the live page —
  identical code path to real play, fast-forwarded.
- "Live playback" runs a recorded `inputLog` through `GAME.playback()` in the
  real-time loop — the deterministic-replay feature itself.
- Teleport evals moved the player entity for perception tests; all perception,
  pathing, and state transitions still ran through the real sim.

## Results

| Check | Status | Evidence |
|---|---|---|
| Page loads, no build, single file | pass | shots/01,16; `file://` open works |
| No external requests | pass | `network requests`: only index.html (200) + favicon.ico 404 (browser automatic) |
| Console / uncaught errors | pass | Fresh session, load + mission + 300 ticks: `errors` and `console` empty |
| Briefing → start via labeled button | pass | clicked "START MISSION" → `state:"play"` (shot 19) |
| Full mission: hack terminal → take INTEL → extract | pass | seed 18/compact/easy: extracted @ tick 2653, "CLEAN GETAWAY" rank A (shots 17) — run end-to-end on `file://` |
| Deterministic replay verify | pass | VERIFY REPLAY → "✓ VERIFIED — deterministic replay reached extracted at tick 2653, hash 9d08d951" (shot 18) |
| Guard FSM transitions | pass | Observed PATROL→SUSPICIOUS→ALERT→(LOS break)→SEARCH→PATROL; INVESTIGATE→PATROL; multi-guard alarm cascade (INVESTIGATE→ALERT) |
| Enter/leave vision cone | pass | Player in cone: sus 0→1.2 → ALERT, alert=1, det=1 → caught. Break LOS → SEARCH w/ searchPts → PATROL ~10s |
| Noise → investigation | pass | Coin throw: guard PATROL→INVESTIGATE @0.4s, investigated ~3.2s, →PATROL; player never seen (isolated from vision) |
| Camera cone | pass | cam `see` 0.45→0.9→1.35, `tripped:true` @see≥1 → raiseAlert("camera"), alert 1→3, guards INVESTIGATE/ALERT |
| Door + terminal use | pass | E on terminal → hack channel → maglocks released; E toggles doors; E on locked door consumes PICK charge (4→3) and opens it |
| Gadgets have real effects + finite charges | pass | SMOKE: `guardSees` true→false, charge 2→1. EMP: cam.emp≈20s + alarmSup=8, charge 2→1. COIN: noise→INVESTIGATE. PICK: unlocks door, charge 4→3 |
| Diagnostics overlays | pass | F1 nav grid+paths, F2 vision rays/LOS, F3 sounds, F4 AI state, F5 collision, F6 perf — toggled live, reflect real sim (shots 08, 09) |
| Pause / resume / restart | pass | Escape → state "pause", sim tick frozen; Escape → resume (tick advances); RESTART button → fresh run same seed |
| Same-seed regeneration | pass | seed 5 regen: identical tile-hash 3111668085, identical guard waypoints/cams/objective; seed 6 differs |
| Difficulty materially differs | pass | vault seed 5 — guards 6/7/9, viewDist 6.8/8.5/10.2, FOV 1.13/1.25/1.38, hearMul 0.75/1/1.3, charges 4/3/2 (easy/normal/hard) |
| Keyboard input | pass | real `keydown`/`keyup` events: KeyD/KeyS moved player at walk speed; WASD+arrows bound |
| Pointer input | pass | `mouse down`+drag on canvas → virtual stick → player moved +4.9 tiles; pointerup releases |
| Narrow viewport 390×844 | pass | `set viewport 390 844` — briefing/end/game render cleanly; CSS fix added for statusbar/gadgetbar overlap (shots 11–15) |
| Touch controls | pass | touchstart/`pointer:coarse` → `#touch` visible: stick, THROW, ACT, SNEAK, GADGET, pause buttons |
| Persistence | pass | `localStorage.sh_runs`: 13 run records {seed,preset,diff,result,time,rank,score,when}; survives reload |
| Export/import JSON | pass | IMPORT UI → pasted run record → LOAD → `replaySim` verified → toast "Replay VERIFIED (caught)", seed field populated |
| Replay determinism | pass | `replaySim` reproduces outcome+hash exactly; live playback reaches identical tick/outcome |
| Audio | pass (state only) | `AUDIO.ctx.state === "running"` after user gesture; synth wired to footsteps/doors/alerts — not audibly verified |
| FPS | pass | status overlay 60fps steady |
| Focus-loss handling | pass (code + behavior) | `blur`/`visibilitychange` → auto-pause; `keysDown` cleared — prevents stuck keys |
| Map completability sweep | pass | seeds 1–30 (compact): every mission either extracts or ends caught — zero unresolved stalls; naive straight-line sneak extracts on ~⅓–½ of seeds; evasion-aware route extracts more |

## Failures found → fixed → retested

1. **`mission.doors` undefined** → render/interact crash. Aliased map fields onto mission. Retest: pass.
2. **End-screen crash** — `end-title` textContent wiped child `#end-sub`; end screen + run save never ran. Split into siblings. Retest: pass (shots 04, 06, 11).
3. **Door animation inverted** — `d.t` now interpolates closed→open correctly.
4. **Gadget selection/aim not synced into input record** — broke determinism for throws; `p.sel` and aim now flow through `inp`.
5. **Softlock: unlock terminal behind locked doors** — `reachFree` (BFS ignoring locked doors) now constrains terminals, cams, guard waypoints. Retest: sweep shows no stalls.
6. **Interaction priority** — doors outranked adjacent terminals; added penalty weights so mission targets win. Retest: pass.
7. **Playback hook survived mission restarts** — stale `GAME._pb` overrode live input; `startMission` clears `_ap`/`_pb`.
8. **Playback one-tick misalignment** — input log timestamps are post-increment; selector looks ahead one tick. Retest: live playback extracts at identical tick.
9. **Outcome hash included tick** — live run records one post-outcome tick → false divergence. Hash excludes tick. Retest: `✓ VERIFIED hash 9d08d951`.
10. **`replaySim`/`playback` crashed on empty log** — guarded.
11. **Guard stuck in SEARCH forever (real bug)** — when a guard stood on a search-point tile, `findPath` returned length<2 and `guardMoveTo` returned `false` forever → `searchT` never accumulated → infinite SEARCH. `guardMoveTo` now returns `true` ("arrived/unreachable — move on") for null/short paths. Retest: full ALERT→SEARCH→PATROL cycle completes ~10s.
12. **Scene too dark** — floors brightened, lighting overlay 0.62→0.5. Retest: readable (shot 19).
13. **Narrow-viewport HUD collision** — added `@media (max-width:620px)` rules. Retest: pass (shot 15).
14. **Test-harness issues** (solver leg-completion bound to terminal, eval redeclarations, helper loss on reload) — fixed in the harness, not the app.

## Honest limitations

- **Audio verified by state, not ear.** `AudioContext` runs after gesture and all
  SFX paths are exercised by gameplay events; I cannot claim subjective quality.
- **Bot win-rate.** With correctly-patrolling guards, a naive solver wins ~1/20
  on compact/easy without evasion planning (seed 18 extracted live @2653).
  Cones are small and visible; a human dodging patrol windows does far better.
  Not flagged as a defect — but the game is punishing if you stand still in
  patrol corridors.
- **`favicon.ico` 404** — browser-automatic request, not an app fetch; app makes
  zero network requests.
- Touch controls verified via synthetic `touchstart` + `pointer:coarse` CSS
  path, not a physical device.
