# Embervault validation

Agent-authored evidence. No evaluator scores or reports are claimed.

Final status: the application is delivered and the checks below pass. Seven implementation issues were found, fixed, and retested. No known blocking runtime failures remain. Final artifact and screenshots: `../index.html`, `screenshots/final-desktop.png`, `screenshots/final-mobile.png`.

Browser coverage: Chromium via agent-browser, 1280×800 and 390×844 (DPR 2), genuine pointer/keyboard gameplay, a complete 170-turn victory and a 14-turn death, exact replay of both, direct-file offline operation. Remaining coverage limits are listed at the end.

## Environment and approach
- Delivered runtime: `index.html`, one embedded CSS + engine + interface document, no dependencies.
- Browser: installed `agent-browser 0.31.1`, named session `embervault`, Chromium.
- Read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core` and `agent-browser skills get dogfood` before browser use.
- Independent engine checks execute the actual embedded engine in Node. Browser checks use navigation, labeled controls, mouse coordinates, keyboard presses, screenshots, and read-only live diagnostics.
- Test artifacts live beside `index.html` in `evidence/`.

## Initial checks
- PASS: `node evidence/tests/engine.test.cjs` — 375 floors across 25 seeds, 5 styles and 3 floors each, all connected with reachable stairs and safe entries. Same-config maps and repeated turn actions deterministic. Exact save encode/decode round-trip. Unsupported schema rejected. Logs: `logs/engine-red.txt` (expected missing engine initially), `logs/engine-first.txt`, `logs/engine-green.txt`.
- PASS: `agent-browser --session embervault open file:///home/pyro/projects/naked/astra/bench/16-procedural-roguelike/index.html` — direct-file runtime loaded.
- PASS: `agent-browser --session embervault errors` and `console` — no entries on initial page.
- PASS: `agent-browser --session embervault network requests` — only the local file document requested, status 200.
- Initial desktop state: turn 0, HP 36/36, seed EMBER-7241, map 636/636 reachable tiles, one region, exit 43 steps away, FPS 60. Screenshot: `screenshots/01-desktop-initial.png`.

## Issue 001 — desktop action controls below the fold
- FAIL on initial 1280×800 viewport: the 470px battlefield put the action rack below the visible screen.
- Reproduction: open file, `set viewport 1280 800`, screenshot. Visible in `screenshots/01-desktop-initial.png`.
- Cause: fixed battlefield height plus header/sidebar margins exceeded the viewport.
- Fix: compact-height desktop media query; reduced battlefield and sidebar spacing while preserving map and labels.
- Retest: PASS; see the later core/extended/mobile results and final screenshots.

## Validation coverage
The later sections record the completed interaction, narrow viewport, audio activation, combat/AI, persistence, replay, victory and death tests. Early failure evidence is retained below as history, followed by each fix and retest.

## Core browser interaction results
Command transcript: `logs/browser-commands.jsonl`; executable workflow: `tests/browser_driver.py`; observations: `logs/browser-core-results.json`.
- PASS: 1280×800 controls fit after compact-height layout change; `screenshots/02-desktop-fit.png`. Issue 001 fixed.
- PASS: explicit new run seed EMBER-7241, one visible safely distant scavenger. `screenshots/03-desktop-encounter.png`.
- PASS: one second of animation without input left fingerprint unchanged. Menu pause + ArrowRight also left fingerprint unchanged. `screenshots/04-paused-menu.png`.
- PASS: ArrowRight then ArrowUp moved the player. Frost selected with its labeled button and targeted by mouse; item count decreased, target skipped exactly two enemy actions.
- PASS: Satchel → Warden mail equipped at turn 5, consuming one turn. Enemy dealt damage at turns 6 and 7 (HP 34/36), one legal action per enemy. Pointer melee killed the scavenger. Mending draught restored HP 36/36. `screenshots/05-combat-damage.png`.
- PASS: keyboard E beside starting supply cache opened it, receiving gold and consumables.
- PASS: diagnostics and expanded journal displayed the live map and events. Screenshots 06 and 07.
- PASS: saved at turn 10, then browser reload; complete state object and fingerprint `a238d14c` matched exactly.
- PASS: Replay actions re-simulated ten real actions; final fingerprint matched. Original state restored afterward. `screenshots/08-replay-verified.png`.
- PASS (state only): sound button user gesture created a running AudioContext and scheduled 3 notes; recorded in `logs/browser-initial-state.json`. Reload intentionally removes that context; the initial test's end-of-run audio observation was not proof of playback and will be retested with a fresh gesture. Audio quality was not heard.
- External requests explicitly blocked with `network route 'https://**' --abort` and `network route 'http://**' --abort`; direct file remains reachable.

## Issue 002 — asymmetric corner line of sight
- FAIL: independent review reproduced default generated map sight from (2,1) to (6,3) false while reverse sight was true. A ranged enemy could attack from outside the player's matching sight.
- Evidence: `review/probe.cjs`, `review/probe.log`.
- Cause: direction-dependent Bresenham tie breaking.
- Fix: canonical endpoint order, preserving the same corner blocking rule in both directions.
- Retest: PASS; regression suite and actual import/mobile checks below confirm the corrected behavior.

## Issue 003 — nested invalid save data
- FAIL: JSON decoder accepted null telegraph entries and an unknown loot type; a subsequent genuine engine action threw an exception.
- Evidence: `review/probe.cjs`, `review/probe.log`.
- Cause: array shape validation did not validate all nested action-consuming fields.
- Fix: validate live events, map objects, AI state, statuses, timers and turn queue before replacing a run.
- Retest: PASS; regression suite and actual import/mobile checks below confirm the corrected behavior.

## Issue 004 — replay could overwrite its return state
- FAIL: review reproduced starting a second replay from a paused in-progress replay. Escape then returned to the partial replay instead of the original expedition.
- Evidence: `review/replay-ui.cjs`, `review/replay-ui.log`.
- Fix: replay-specific pause menu only offers Resume or Stop; startReplay refuses nesting and clears prior timers; run-changing commands are blocked during playback.
- Retest: PASS; `browser-persistence.py` paused an active replay, verified run-changing controls were absent, then restored the original exact state.

## Issue 005 — boss cross warning was impossible to dodge by walking
- FAIL: cross centered under the player with one turn until impact covered all four adjacent tiles.
- Evidence: `review/probe.log`.
- Fix: mark resolves after two player turns. Two cardinal steps can escape diagonally; the warning and field guide now explain this.
- Retest: PASS; Node dodge regression and successful actual two-step evasion at turns 107/108 in the complete browser expedition.

## Correctness regression status
- PASS: `node evidence/tests/regression.test.cjs` after fixes. Reciprocal LOS for reproduced corner, six malformed nested states rejected, deterministic action replay matches. `logs/regression-red.txt`, `logs/regression-green.txt`.
- PASS: repeated 375-floor engine suite after fixes. `logs/engine-correctness-update.txt`.
- Independent review also passed 2,000 generated final floors, including boss placement; original checkpoint restoration and brace duration. Full review scope/limitations: `review/findings.md`.

## Extended browser results
- PASS: closed door at (13,15) blocked sight to (14,15). From (12,15), ArrowRight consumed one turn opening the door without moving; the tile beyond became visible. Inspect screenshots: `09-closed-door-occlusion.png`, `10-door-opened.png`.
- PASS: older schema and null telegraph rejected through Import UI; current full state unchanged. Actual Export button downloaded JSON; uploading the exported file restored the exact turn-15 state. Replay-specific pause menu preserved the original run and blocked gameplay. Direct-file reload in Chromium offline mode restored exactly. `tests/browser-persistence.py`, `logs/browser-persistence-results.json`, screenshots 11–13.
- PASS: second seed MOSS-2048, compact arena, Story difficulty; 202/202 connected floor tiles, exit 19 steps away. Screenshot 14.
- PASS: keyboard 2 → Enter fired the longbow. Initial test assertion incorrectly expected raw 6 damage against an armored sentinel; observed 4 (6 attack − 2 armor) was correct. Corrected the agent-authored expectation and reran from a fresh seed; no runtime change for this test error.
- PASS: smoke item prevented perception for four phases; sentinel memory countdown observed 3 → 2 → 1 → 0, then null and return-to-post intent. Screenshot 15.
- PASS: actual UI expedition with keyboard movement/targeting and labeled inventory actions, no live state mutation, descended to floor 2 (turn 53), then floor 3, killed the Warden, claimed heart, and won at turn 170. HP 48/70. Occupancy/queue invariants checked after moves, 145 combat/navigation actions audited. A bot chose routes from read-only map state; all actions still used UI keys/buttons. `tests/browser-arena.py`, `logs/browser-arena-results.json`, `logs/completed-arena-state.json`, screenshots 16–18.
- PASS: genuine unseen-enemy observations retained old player positions (e.g. turn 33: memory 14,6; player 14,5), rather than updating through cover.
- PASS: Warden cross evaded via two cardinal moves at turns 107/108, HP remained 52. Other attempted bot dodges were blocked by enemies, and damage correctly occurred; these are recorded in `bossDodge`, not all labeled successful dodges.

## Issue 006 — mobile health/status out of view
- FAIL at 390×844, DPR 2: main controls fit, but the live strip was at y=1414, leaving current health below the fold. Screenshot `19-mobile-before.png`.
- Cause: desktop footer placement persisted below stacked sidebar panels.
- Fix: fixed mobile status strip and 50px shorter mobile map to preserve space for the movement pad.
- Retest: PASS; regression suite and actual import/mobile checks below confirm the corrected behavior.

## Mobile, run loop and replay results
- PASS: full 170-action victory replay fingerprint `c1cacea3`; screenshot `21-boss-cross-replay.png` shows the actual cross telegraph while re-simulating, `22-full-run-replay.png` shows equality verification.
- PASS: local chronicle recorded MOSS-2048 victory, 1,382 game score, 170 turns, 25 foes. This is an in-game score, not an evaluator score. Screenshot 23.
- PASS: mobile 390×844, DPR 2; empty seed rejected, seed input retained focus without moving player, UTC daily seed produced DAILY-2026-09-08, Ranger final-floor preset started at floor 3 / level 4. Screenshot 24.
- PASS: pointer D-pad north, keyboard east, and canvas pointer south continued input correctly. Inspecting a closed door consumed no turn. Screenshots 25–26.
- PASS: mobile multi-step preview consumed no turn; confirmation stopped because of visible danger (turn remained 3). This verifies danger gating, not completed auto-travel.
- PASS: inventory equipment, large text, high contrast, reduced motion, master volume, and Vi alternate movement. Screenshots 27–28.
- PASS: no horizontal overflow at width 390. Live strip bounds y=792..844; D-pad bottom 784.5. Canvas backing 728×640 for a 364×320 CSS viewport. Issue 006 fixed.
- PASS: forgiving restart restored the exact original final-floor checkpoint, including full inventory/state.
- PASS: a genuine Veteran/permadeath run died at turn 14 with HP 0; no floor retry offered. Death replay matched fingerprint `da06c486`. Chronicle contained both death and victory. Screenshots 29–31.
- Commands and assertions: `tests/browser-mobile.py`; observed results: `logs/browser-mobile-results.json`.

## Final refinement
The all-floor diagnostic validation now uses the actual style rotation for that expedition. Connectivity reports compute all regions even for malformed/disconnected input. A retained sound preference resumes its AudioContext on the next genuine pointer/keyboard gesture after reload; it never autoplays on file load.


## Final browser checks and evidence
- PASS: an actual three-step pointer route moved from (12,15) to (9,15), consuming exactly three turns (16 → 19). Preview itself consumed none. The stalker behind the closed doorway forgot the trail and returned to guard its post. Screenshots 32–33; `tests/browser-final.py`, `logs/browser-final-results.json`.
- The agent-authored safe-travel script initially assumed no enemy was visible immediately after importing turn 15; the opened door had in fact revealed a stalker. A subsequent test hypothesis expected it to reopen the closed door, but it lost its trail and returned home. These were test-scenario assumptions, not runtime failures. The final test asserts the actual safe-travel and memory behavior. Newly revealed-danger interruption was not separately isolated; visible-danger gating was tested on mobile.
- PASS: diagnostics read actual rotated styles: floor 1 636/636 connected, floor 2 627/627, floor 3 675/675. FOV, walkability, AI paths, occupancy and queue overlays switched during play. Screenshots `34-debug-*.png`.
- PASS: staged an older localStorage save as an explicit startup fixture, with autosave disabled through Settings. Reload rejected it, created a playable fresh expedition, displayed the compatibility notice, and preserved local records. Screenshot 35. This fixture was not a live-state mutation used to claim gameplay success.
- PASS: fire flask, purifying salt, trail ration and targeted blink used through labeled inventory/target controls; item counts, position and statuses advanced. Together with frost, smoke and mending, seven consumables were exercised. Screenshot 36.
- PASS: after reload a retained sound preference left AudioContext uncreated; a real keyboard gesture then created a running context and scheduled a note. No listening/audio-quality claim is made.

## Issue 007 — mobile minimap overlapped the opening enemy
- FAIL in visual review: fixed top-right minimap obscured the initial scavenger at narrow width. Before: `37-mobile-minimap-overlap.png`.
- Cause: minimap placement did not account for visible actors.
- Fix: at narrow widths, choose among four corners by live actor overlap, also avoiding the inspection panel.
- Retest: PASS, `logs/mobile-minimap-retest.json` has no overlapping enemy centers; final screenshot visibly exposes the scavenger. Followed by pointer north + keyboard east, reaching turn 2 at (8,14), no overflow, no errors. `logs/mobile-final-input-retest.json`, `logs/final-after-layout-errors.txt`.

## Final artifact verification
Commands:
```bash
node evidence/tests/engine.test.cjs
node evidence/tests/regression.test.cjs
node --check evidence/tests/syntax-0.js
node --check evidence/tests/syntax-1.js
agent-browser --session embervault-final open about:blank
agent-browser --session embervault-final network route 'https://**' --abort
agent-browser --session embervault-final network route 'http://**' --abort
agent-browser --session embervault-final set offline on
agent-browser --session embervault-final open file:///home/pyro/projects/naked/astra/bench/16-procedural-roguelike/index.html
agent-browser --session embervault-final set viewport 1280 800
agent-browser --session embervault-final screenshot evidence/screenshots/final-desktop.png
agent-browser --session embervault-final set viewport 390 844 2
agent-browser --session embervault-final screenshot evidence/screenshots/final-mobile.png
agent-browser --session embervault-final errors
agent-browser --session embervault-final console
agent-browser --session embervault-final network requests
```
- PASS: independent final engine/regression suites, outputs `logs/final-engine.txt`, `logs/final-regression.txt`; both embedded scripts parse successfully.
- PASS: a fresh isolated browser session with no prior page resources, HTTP/HTTPS blocked and browser offline, opened the file and rendered the game. Resource Timing external resources: empty. Network log: only the local file document, HTTP-style status 200. No errors or console entries. `logs/fresh-offline-*` and `logs/delivered-browser-*`.
- PASS: static artifact audit found zero HTML resource attributes, CSS URLs, imports, fetch, XHR, WebSocket or EventSource calls. The file includes a CSP denying network connections. Final byte count and SHA-256: `logs/artifact-audit.json`.
- The fresh final browser was returned to a new, playable default expedition at turn 0.

## Coverage limits
- Audio was enabled by real gestures and verified by AudioContext state and scheduled notes; sound quality was not heard.
- Browser checks used Chromium with desktop and narrow emulated viewports, pointer and keyboard. Physical touchscreen devices, Safari and Firefox were not run.
- Direct-file operation passed; no local HTTP server or runtime build was needed. No tool substitution or blocked browser capability was necessary.
- No claim that every possible seed was enumerated: 375 floor combinations were checked by the main suite, plus 2,000 final floors by independent review. All connected-map construction and entry/exit checks use actual generation logic.
- No unresolved application failure is known from these checks.
