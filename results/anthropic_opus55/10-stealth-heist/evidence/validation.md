# Ghostline — validation evidence

Artifact: `../index.html` (single self-contained file, ~245 KB, 3.2k lines; no external assets, imports, fonts, or network calls).
Date: 2026-09-29. Validation by the implementing agent (Claude Code, Opus 5.5).

## Environment and tools

| Item | Value |
|---|---|
| Browser automation | **agent-browser 0.31.1** (the installed skill). I read the skill stub (`.agents/skills/agent-browser/SKILL.md`), then `agent-browser skills get core` and `agent-browser skills get dogfood` (the exploratory-testing workflow). |
| Browser | agent-browser's headless Chromium on WSL2 (Linux 6.6). Rendering is **software-only (no GPU)**, which matters for the performance numbers below. |
| Serving | `uv run python -m http.server 8765 --bind 127.0.0.1`. I also opened `file:///…/index.html` directly (see 14). |
| Headless logic tests | Node 22 against the generator and simulation section of the same `index.html`, extracted with `scripts/extract-core.py`. |

**How I drove it:**
- **Real input** through agent-browser:
  - `keydown`, `keyup` and `press` for keys;
  - `mouse move/down/up` with left and right buttons on canvas coordinates computed from the game's own `worldToScreen`;
  - clicks on the minimap;
  - pointer drags on the on-screen joystick and taps on touch buttons;
  - `click`, `fill` and `check` on labelled DOM controls.
- **Longer scripted runs:** a small Python driver (`scripts/player.py`) that only issues those real inputs. It polls read-only state via `window.GHOSTLINE.snapshot()` to decide timing.
- **In-page bot, two scenarios only:** the pursuit/search test (9b) and the stress test (13), both timing-critical. Following my own lesson LS-G0012, the bot runs inside the page each animation frame. It acts **only through the game's input queue**, pushing the same `['go',x,y]` / `['use',x,y]` / `['sel',i]` events a left click, right click or number key produces, plus the interact latch that E sets. It never writes simulation state. Two console calls in 13b (pinning resolution and pausing adaptation) are the only renderer-state writes; they are declared there.

**Declared deviations:**
- For the pursuit/search check (9b) and the terminal check (10) I used **Rookie** difficulty, so the scripted player had enough of a lead to observe the whole chain. Rookie has the same AI state machine with shorter sight and slower reactions. Everything else was run on Operative.

## Results

| # | Check | How | Observed | Status |
|---|---|---|---|---|
| 1 | Page loads; no console errors; no external requests | open over http and via `file://`; `agent-browser errors`, `console`, `network requests` | Title plus a live attract-mode mission. Zero page errors and zero console warnings or errors across all sessions (last check after the final regression run). Only the document itself is requested. A `/favicon.ico` probe appeared once, so I embedded an inline SVG favicon. | **pass** |
| 2 | Desktop 1280×800 layout | screenshots `01`, `03`, `04` | Title card with presets, seed, size, difficulty, live preview map with routes, briefing, and map-validation checklist. In game: status overlay, ticker, minimap, gadget bar, meters and inventory. | **pass** |
| 3 | Keyboard movement and noise tradeoff | `keydown w` ~0.8 s; `Shift` + `d` | Walk ≈ 2.3 tiles/s with footstep noise ≈ 1.6. Run gives noise 3.9–6.2 and stance `run`. The page scroll stays at 0. | **pass** (after a fix, see F1) |
| 4 | Pointer click-to-move (A* path, auto-opens unlocked doors) | real left clicks on the canvas; minimap clicks for off-screen targets | Path drawn (`04`); the player opens doors en route. A click beyond a mechanically locked door walks to that door and says to pick it (F5). | **pass** |
| 5 | **Full mission: keycard → vault → objective → extraction** (Quiet Hours, **Operative**, seed `QUIET-HOURS-7`) | `scripts/run4.py`: real clicks and keys only. Shadow G2 to the keycard, press E; wait until G1 reaches the Office; minimap-click to the vault door; key `3` then hold/release `F` (EMP); E opens the vault with the keycard; hold E on the objective; hide in Office D; trail G1; sprint to the Garage. | **WIN**, tick 13 080 (3:38). One detection: G1 glimpsed me through two open doors 5 tiles from extraction, and I outran it. Screenshots `06`–`12`; log `logs/run4.log`. **Regression re-run on the final build:** WIN again (tick 13 078, rank C, 1 738 points; `logs/run5-final-regression.log`, `42`). | **pass** |
| 6 | Debrief: time, detections, alarms, loot, rank, score, run history | the debrief screen after runs | Detections, alarms, loot (x/y and $), gadgets, terminals, time seen, noise events, rank letter, score, best-for-seed, and a recent-runs table from `localStorage` (`12`, `05`). | **pass** |
| 7 | **Replay** (deterministic input playback plus final state hash) | "Watch replay" at 4×; also **export → page reload → import** of `sample-replay.json` | The WIN run re-simulated 13 080 ticks: hash `daa66bbb`, VERIFIED ✓ (`14`). The final regression run verified with hash `c479fe17`. The failed run was imported after a reload and verified with hash `716515aa` (`32`). | **pass** |
| 8 | Noise → investigation (driven by sound data, not the ring animation) | `scripts/scnB.py`: press E on the door, then hold and release the right mouse button (aim preview `18`) to throw the noisemaker through the doorway | Clatter landed at (7.71, 17.07). The sound event records G2 at path distance 2, strength 0.73. G2 went INVESTIGATE to (7.68, 17.32) ("Gonna check that out.", `19`, sound overlay on), looked around, then RETURN, without finding me behind the wall. An earlier throw that hit the door frame fell at my feet; G2 heard it through the open door (d=6, s=0.2), investigated, and caught me. That is also coherent. | **pass** |
| 9a | Enter a guard's cone → suspicion | runs 3–5 and scenario logs | Repeatedly observed: PATROL→SUSPICIOUS (amber cone, `?`, bark, HUD `SUS 1`, SEEN; `10b`). Also PATROL→INVESTIGATE because G2 noticed a door I had left open. | **pass** |
| 9b | **Leave line of sight during pursuit → last known position → SEARCH → RETURN** | in-page bot `scripts/pursuit-bot2.js` (Rookie; flees only after CHASE) | `PATROL→SUSPICIOUS(0.32)→CHASE` from 4.8 tiles; LOS broken while fleeing; the guard followed my footstep noise to the last known position; `CHASE→SEARCH` at 23.1 s (4 generated search points, magenta ✕ at the last known position, `23`); `SEARCH→RETURN` at 35.2 s; then three `RETURN→INVESTIGATE→RETURN` detours to close doors I had left open; `→IDLE` back on duty at 63.8 s. The long visual contact escalated to an ALARM with a radio call (`22`). A separate run showed `SUSPICIOUS→INVESTIGATE→SEARCH→RETURN→IDLE` after I stepped out of view before a chase (`logs/scnG.log`, `21`–`24` "pursuit"). | **pass** |
| 9c | A dedicated "step in, step out" choreography at Operative | `scnA`/`A2`/`A3`/`C`/`D` timing scripts | Not achieved as scripted: the idle guard's sweep never faced the doorway, and my approaches got too close so the 1.25-tile close-range sense fired. The transitions each attempt did produce are in `logs/scnA3-cone-attempt.log` and `x-cone-attempt-*.png`. The enter/leave behaviour itself is covered by 9a and 9b. | **fail as scripted** (behaviour covered elsewhere) |
| 10 | Terminals (hold E) | real `keydown e` held for 3.4 s | Camera loop terminal: `camLoopT` 44.6 s, 70 s cooldown (`35`). Breaker terminal: mean light level **0.578 → 0.109**, red emergency lighting, and the guard went INVESTIGATE "Checking the breakers." (`36`, `37`). A first attempt was caught at 9% hack progress (`x-terminal-*`). | **pass** |
| 11 | Gadgets and doors | noisemaker (8), EMP (5), smoke thrown, locked-door pathing | EMP disabled the vault camera, set the secure lock to bypass, killed lights in its radius, and emitted a sound (`08`). Charges decrement, cooldowns show on the gadget bar. A door-noticed investigation and door close was observed (run 3). | **pass** |
| 12 | Diagnostics overlays toggled live (no restart) | DIAG button and checkboxes during play | Nav nodes and paths, guard state labels, vision rays with hit markers, sound fields with heard-by lines, last-known positions and search points, collision, frame timing (`19`, `22`, `23`, `40`). | **pass** |
| 13a | Pause / restart / resume / same-seed regeneration | `Esc`; "Restart mission"; "Resume"; switching presets and back | Sim clock frozen while paused (2.25 s held). Restart returns t≈0 at spawn. Tile hash `5f35156e` identical after regeneration and restart; a different preset gives a different hash. Focus returns to the canvas. | **pass** |
| 13b | Several guards searching / chasing, high DPI | stress bot on the Large preset, Professional (7 guards, 6 cameras), `set viewport 1280 800 2` | Alarm raised; up to 4 guards CHASE/INVESTIGATE at once. Sim cost: median 0.01 ms, p95 0.1 ms per step (Node). Browser at DPR 1: median 16.7 ms, p95 33 ms. **Pinned DPR 2 (2560×1600, software raster): median 33 ms (was 66 ms before the render refactor, F7).** I pinned DPR 2 from the console (`R.quality = 1`, pausing the adaptive check) and re-enabled it afterwards; the default path steps the render scale down automatically when frames stay slow. | **pass** (with a software-raster caveat) |
| 14 | Direct `file://` open | `agent-browser open file:///…/index.html` | Loads, localStorage works, mission starts, keyboard moves the player, audio context runs, no errors (`41`). | **pass** |
| 15 | Narrow 390×844 | `set viewport 390 844`; joystick drag (mouse pointer down/move/up), RUN toggle, GADGET → tap map, USE | Touch UI appears. Joystick moved the player 20.5 → 18.3 and reset on release. RUN switched the stance (noise 5.5). GADGET entered aim mode and a tap threw it (charges 4→3, a `clatter` sound event). The camera keeps the player in the usable band above the controls (`28`–`30`). Title card scrolls (`27`). | **pass** (after fixes F9, F10) |
| 16 | Focus loss | `tab new` (the game tab hidden) while holding W | Auto-paused ("Paused — window lost focus"), held keys cleared, no stuck movement (`38`). | **pass** |
| 17 | Settings persistence and control remapping | Settings sliders and checkboxes; Controls keycap → press G; reload | Master 40, reduced motion and reduced flash persisted across reload. Interact rebound to G: E did nothing, G opened the door, and the prompt shows `G`. The remap persisted across reload. "Reset defaults" restored E (F11). | **pass** |
| 18 | Import / export JSON, including error states | IO screen | Mission export and import regenerate the mission (seed `IMPORTED-SEED-42`, standard, professional). Invalid JSON, a bad replay schema, and an unknown format each show a clear inline error (`31`). | **pass** |
| 19 | Audio (Web Audio, synthesized, starts on a gesture) | `GHOSTLINE.audio()`, analyser-tap measurement of each voice | Context `running` after the first gesture; oscillator starts increase on actions. Peaks at 70% master ranged from −26.5 dBFS (ambience) to −16.5 dBFS (clatter), with no clipping. I then raised the master curve by about 3 dB. **I did not listen to it**; only levels were measured. | **pass (levels only)** |
| 20 | Headless generator, validity and determinism | `logs/headless-harness.log` | 16 preset × difficulty combinations plus 450 random seeds (3 sizes): 0 generation failures. All pass the 8 validation checks (connectivity, keycard and override reachable without the vault door, objective and extraction reachable, guards spawn far away, routes walkable, entry unobserved). Generation is deterministic. | **pass** |
| 21 | Headless completion through sim mechanics | `logs/headless-completion.log` (perception disabled in the test only) | All 4 presets and **60/60** random seeds complete (keycard or lockpicks → vault → objective → extraction). | **pass** |
| 22 | Headless AI soak | 30 sims × up to 2 minutes with a random-input player | 0 exceptions or NaNs. Every state was visited (PATROL, IDLE, SUSPICIOUS, INVESTIGATE, CHASE, RETURN; SEARCH in the scripted chain). Replay hash matched on re-simulation. | **pass** |

## Failures found and fixed (each re-tested)

| ID | Problem (how found) | Fix | Retest |
|---|---|---|---|
| F1 | Empty `KeyboardEvent.code` (agent-browser `keydown` sends `code:""`, as some IMEs do) matched the empty secondary-binding slots, so movement didn't work and the stance flipped to sneak. | `actionFor` ignores empty codes; `normCode()` falls back to `e.key`. | 3 passes. |
| F2 | The gadget aim preview (range circle and arc) showed on any mouse movement, cluttering normal clicking. | Hold right mouse (or F) to aim; release to throw. | 8: preview `18`, throw works. |
| F3 | Getting caught 0.1 s after CHASE started at point-blank range left no reaction time. | 0.75 s grab grace after entering CHASE. | Chases in 9b and 5 were escapable. |
| F4 | Click-to-move could not reach off-screen targets. | Click or tap the minimap to walk there. | Used in 5 and 10. |
| F5 | Click-to-move to a spot behind a mechanical lock said only "No route". | Paths to the locked door and hints to pick it. | Headless 60/60 completion including lockpicks. |
| F6 | A door could not be used from a diagonal tile next to its frame: the LOS check clipped the wall corner (found in 8). | Doors are usable from the 3×3 neighbourhood; walls can't be occupied, so this can't reach through a wall. | 8 passes (door opened, noisemaker went through). |
| F7 | High-DPI performance: about 7 full-screen composite passes per frame (66 ms at DPR 2 in a software raster). | One CSS-resolution shade layer combining lightmap, LOS fog, wall-edge reveal, vignette and alarm tint, composited once; adaptive render resolution. | 33 ms pinned at DPR 2; 16.7 ms median at DPR 1. |
| F8 | A DPR change (browser zoom or moving the window to another screen) fires no `resize`, so the canvas stayed at 1×. | Per-frame DPR and size check. | Canvas 2560×1600 at DPR 2 (`40`). |
| F9 | At 390 px the EMP gadget slot overlapped the USE button, and the camera parked the player behind the controls. | Restacked the bottom UI; the camera centres the player in the usable band and lets small maps slide. | Player at y=383 of 844, controls clear (`28`). |
| F10 | Status panel "GUARDS" label truncated; toasts covered the PAUSE button on narrow screens. | Flexible chip row; toasts moved below the status panel on narrow screens. | `28`. |
| F11 | "Reset defaults" in Controls had no handler. | Wired it up. | 17. |
| F12 | Readability: walls blended into floors, per-tile noise looked like a checkerboard, and light edges were blocky. | Lighter walls, a wall-outline layer above the lighting, subtler floor noise, and a display-only blur of the lightmap. | `03` compared with `02`. |
| F13 | Sound-field diagnostics were too faint. | Stronger tile tint and heard-by lines. | `19`, `22`. |
| F14 | Par times too tight for patient stealth, so there was never a time bonus; the debrief table clipped the Score column. | Par 240/420/600 s; a compact debrief table. | Final run scored 1 738, including the time bonus. |

## Blocked, partial, or not run

- **Real touch input: partial.** Touch controls were exercised with mouse-type pointer events at 390×844, not with a touch-emulated device or a physical phone. The handlers are Pointer Events with capture and cancel paths, so touch should route the same way, but that is not verified here.
- **Audio quality: not heard.** Only levels, oscillator counts and context state were measured.
- **GPU performance: not measured.** All browser timings come from headless software rasterization. On GPU-backed browsers they should be better, but that is not verified.
- **WebKit / Firefox: not run.** Only Chromium was used.
- **9c:** the scripted step-in/step-out at Operative did not come off, as explained in the table. The underlying behaviour is shown by 9a and 9b.

## Reproduce

```bash
cd <repo>; uv run python -m http.server 8765 --bind 127.0.0.1 &
export AGENT_BROWSER_SESSION=heist
agent-browser open "http://127.0.0.1:8765/index.html?v=1"; agent-browser set viewport 1280 800
python3 evidence/scripts/run4.py         # full Operative heist through real clicks and keys (about 4 minutes of game time)
# pursuit / search chain (in-page bot through the input queue): evidence/scripts/scnG2.py + pursuit-bot2.js
# headless: cd evidence/scripts && python3 extract-core.py && node harness.js && node bot2.js && node perf.js
```
