# BLACKLINE validation log

Agent-authored evidence, not an evaluator report. Started 2026-09-07.

## Environment and preparation
- Working artifact: `index.html`; no prior app or git repository.
- Browser: installed `agent-browser 0.31.1`. Read `.agents/skills/agent-browser/SKILL.md`, then `agent-browser skills get core --full` and `agent-browser skills get dogfood`; saved version-matched output in `logs/`.
- Node v25.8.1, Python 3.12.3.
- `node evidence/core.test.cjs`: expected initial failure (missing core), then five contracts passed: deterministic generation; reachability across 270 seed/preset/difficulty combinations; walls/closed doors occlude sight; four-direction routing around walls; sound attenuation/decay. Logs: `core-red.txt`, `core-green.txt`.
- Both extracted embedded scripts passed `node --check`.

## Direct-file startup — PASS
Commands: `agent-browser --session blackline --allow-file-access open file:///home/pyro/projects/naked/astra/bench/10-stealth-heist/index.html`; `set viewport 1280 800`; `snapshot -i`; `errors`; `console`; `screenshot evidence/screenshots/01-desktop-initial.png`.
Observed moving patrols, floor plan, contract, objective and loadout. No browser errors or console output. Initial telemetry saved in `logs/initial-state.json`.
External HTTP and HTTPS blocked with `network route 'http://*' --abort` and `network route 'https://*' --abort`. The artifact also has a CSP forbidding network connections and external scripts/assets.

## Mission setup / first interaction — PASS
Used the New mission button, Dockside preset, seed `DOCK-031`, Ghost difficulty. Empty seed produced “Enter a seed before generating the mission.” Entered valid seed and generated. Clicked Infiltrate, pressed E, waited for `BLACKLINE.snapshot().player.key`. Observed badge acquisition and all locks authorized. `logs/dock-badge.json` records actual simulation and running Web Audio state after the Infiltrate gesture. Audio state was inspected; audio quality was not heard.
Tool correction: `find label ... select` is unsupported by this CLI; used `select '#difficultyInput' ghost` successfully. This was a tool syntax correction, not an application failure.

## ISSUE-001 — held-key input unavailable when KeyboardEvent.code is empty
Reproduction: In active mission, `agent-browser keydown ArrowRight`, inspect keys/position, then `keyup ArrowRight`. Repeated with `d`. Player did not move. A passive browser event probe showed trusted keyboard commands supplied `key: ArrowRight` and `code: ""`; the application matched only code. Evidence: `logs/issue-001-key-input.json`.
Root cause: keyboard handler assumed every input source supplied `KeyboardEvent.code`. Fix planned: normalize key as a fallback for keydown and keyup, retaining code for physical keyboards. Retest pending.

ISSUE-001 retest — PASS: after fallback normalization, `keydown ArrowRight`; `wait --fn 'BLACKLINE.snapshot().player.x > 4.2'`; `keyup ArrowRight`; `press Escape` produced player x=4.3667 from x=3.5, empty pressed-key set, paused=true. Agent-browser session unexpectedly navigated to about:blank once during the first reload; `doctor --offline --quick` reported 8 pass / 0 fail, and reopening the direct file restored the session. No app error was reported. The original passive probe result (code empty) is present in the tool transcript; its attempted JSON save failed after that session reset and is not claimed as a saved probe.

## ISSUE-002 — investigation could stall at an off-center source
Independent review reproduced a guard stuck in investigate after 30 seconds for sound position (10.99,11.99): grid navigation reached the cell center, while arrival required distance under 0.55 from the precise source. `node evidence/ai.test.cjs` reproduced the failure; `logs/ai-red.txt` preserves it. Fix: arrival also accepts reaching the source navigation cell center; clear the prior search target. The same 30-second simulation now includes investigate, search, and return states. All five map/perception contracts still pass. Browser hearing/search flow is tested separately below.

## Review fixes and regression tests
- ISSUE-003 (review finding): restarting after selecting smoke/EMP left the old button highlighted although the simulation reset to distraction. `reset()` now also synchronizes the selected button and `aria-pressed`. Browser retest selected smoke, restarted, then confirmed selected=0 and pressed flags `[true,false,false]`. Logged in `browser-commands.log`.
- ISSUE-004: a looped security terminal promised an offline alarm network, but guards could still broadcast a global alarm. `security-red.txt` shows the failing contract. The disabled network now suppresses broadcast and radio fan-out; guards retain local perception and pursuit. `ai.test.cjs` passes.
- ISSUE-005: pursuit stopped or turned toward a tile center before close contact with an off-center player. The first exact-target patch still returned to the center on replanning. The trace probe exposed that turn. Navigation now skips the redundant start node and approaches the visible last-known point inside the final cell. `capture-red.txt` preserves the failing case; the fixed fixture is captured after 2.483 seconds. The hearing fixture was isolated from player vision so its independent search/return assertion tests hearing without new visual stimuli.
- ISSUE-006: array-valued difficulty and false/numeric run payloads bypassed import schema checks. Added string/own-property checks, telemetry object checks, monotone nonnegative timestamps, finite angles/alerts, booleans, and valid walkable player positions. `import-red.txt` shows the initial failure. `node evidence/import.test.cjs` now accepts a genuine sampled record and rejects 12 malformed cases. Browser rejection keeps the current mission and error dialog intact; no uncaught errors.

## Complete mission — PASS
Exact input commands and read-only observations are in `logs/browser-commands.log`. `browser_driver.py` invokes the installed agent-browser CLI; it computes screen coordinates from the displayed map but never injects game state or bypasses mechanics.

Played `DOCK-031 / Dockside / Ghost`:
1. Infiltrate, press E to clone the entry badge, hold ArrowUp to approach the lower door, press E to open it.
2. Use real mouse movement/down/up to walk through the corridor and approach the Records door; press E.
3. Select smoke with 2 and use Q. Walk into Records, wait for the shared gadget cooldown, select distraction with 1, aim at floor (1.49,6.50), and press Q.
4. The live event record logs `G01 investigating distraction` at 5.900s, with exactly that sound position. Walk to the ledger, press E and remain still through decryption. Collect optional intel with E.
5. Return through the opened doors. Deploy smoke at extraction to lose visual contact, then press E.

Observed: victory at 15.7 seconds, 1 detection, 1 alarm, 1/3 optional intel, score 1503, rank B. The result was saved locally. Evidence: `screenshots/07-extraction-success.png`, `logs/mission-victory.json`, `logs/completed-run.json`.

The first genuine attempt acquired the ledger but tried to extract while visible. The game correctly rejected extraction, then a guard caught the player at 17.7s. It displayed the failure summary and saved the failed run. Evidence: `logs/mission-attempt-1.json`, `screenshots/05-attempt-state.png`. This was a gameplay loss, not an application defect. A distraction attempted before its 1.1-second cooldown elapsed was rejected without consuming a charge; the retry waited for the actual cooldown.

## Stateful perception, pursuit, hearing and return — PASS
A separate deliberate test opened the Records door and waited in G01's cone. Live telemetry showed seeing=true and rising suspicion, followed by pursuit and a real alarm/radio report. Ran to the lower room, closed its door, and walked away behind geometry. At 8.8s G01 was in search, seeing=false, with lastKnown (4.3765,10.4953); the player was at (5.6657,12.4997). G02 investigated the earlier broadcast position, not the hidden player's position. After waiting safely in the room, G01 returned to duty and cleared lastKnown.

Evidence: `guard-visual-suspicion.json`, `guard-pursuit.json`, `guard-contact-lost-search.json`, `guard-return-duty.json`; screenshots `12-guard-pursuit.png`, `13-search-after-los-break.png`, `15-live-diagnostics.png`.
All six diagnostic switches were exercised through checkbox controls: paths/states, vision ray hits, sound state, memory positions, collision bounds, and frame timing. They rendered live without a restart. In that captured test, telemetry reported about 60 FPS and 0.6–0.7 ms render time; this is an observation in this browser, not a hardware-wide performance claim.

## Run history, export/import and replay — PASS
Clicked View timeline, Play timeline, observed index advance to 3, then paused. Clicked Export JSON and verified the actual downloaded file at `/home/pyro/.codex-naked-home/Downloads/blackline-DOCK-031.json`; copied it to `evidence/exported-operation.json`. Archive contained both the failed and successful runs and still contained both after reload.

Using the import dialog, malformed JSON displayed a parse error. A valid record modified to have an array difficulty displayed a validation error without changing the current seed. Uploaded the actual downloaded JSON via the file input and loaded it. The imported facility fingerprint was `998045ba`, matching the completed mission. Focused the replay slider and pressed End: recorded timeline reached sample 31 of 32, showing the completed route. Console and error logs remained empty. Evidence: screenshots `08-replay.png`, `09-archive.png`, `10-import-error.png`, `11-imported-replay-end.png`; `logs/import-replay-verified.json`.

## Narrow viewport, input continuity and pause — PASS
Set viewport to 390×844. The canvas follows the player, with a minimap and a visible direction pad and action controls. Document scroll width=390 and scrollY=0; no horizontal overflow. Used real pointer down/up on Move up, moving player y=15.5 to y=14.46. Released pointer: touchDirections empty. Held ArrowDown and ArrowRight for keyboard movement at narrow width, interacted with the terminal, and toggled WALK/RUN through the touch control.

Focus-loss test: held ArrowLeft, opened a real second tab (`tab new about:blank`), switched back to t1. Game was paused, keys and touchDirections were empty. Resumed, explicitly paused again, and verified elapsed time stayed exactly 2.5333333333 while paused. Evidence: `mobile-pointer-movement.json`, `focus-loss-paused.json`, `pause-time-frozen.json`, screenshot `17-mobile-active.png`.

For genuine touch cancellation, `node evidence/touch-cancel.cjs` connected to the same agent-browser Chrome via its reported CDP URL using Node's built-in WebSocket. This supplements the installed CLI, whose command reference has no desktop touch-cancel primitive. Sent trusted `Input.dispatchTouchEvent` touchStart to the direction pad, observed 1.17 tiles of upward movement, then sent touchCancel. Input cleared and movement stopped across another 450 ms. No synthetic game-state mutation was used. Evidence: `logs/touch-cancel.json`.

## Cameras, EMP, security terminal and locked access — PASS
Navigated to a camera cone in the right corridor and waited for camera seeing=true. Selected EMP with 3 and pressed Q: nearby camera disabled timer became 12s and one EMP charge was consumed; the distant camera remained enabled. The cone disappeared. The immediate diagnostic sample retains its previous `seeing` value until the next simulation step; later feed/terminal state is sampled after stepping. Evidence: `camera-visual-contact.json`, `emp-camera-disabled.json`, screenshot `18-emp-camera.png`.

Walked into the upper middle room using smoke, interacted with its security terminal and completed the connection. Both live guard states were search, securityOff=true, the camera feed indicator became FEEDS LOOPED. Evidence: `security-terminal-offline.json`, screenshot `20-security-offline-active.png`. Alarm suppression after the terminal is also covered by the direct simulation contract.

Restarted without cloning a badge, approached the locked Records door, used smoke, and pressed E. The action was a 3-second lock bypass. It completed with door locked=false/open=true while player.key remained false. Evidence: `locked-door-bypass-start.json`, `locked-door-bypass-complete.json`.

## Settings, difficulty, regeneration and display density — PASS
Changed master/effects sliders using keyboard range controls, enabled synthesized audio using a button gesture, and checked Reduced motion & flashes. AudioContext was running with active oscillator nodes and master/effects values 0.02/0.99. Reloaded and reopened Settings: controls retained 2%, 99%, checked. Restored 50% master / 65% effects / normal motion using the controls. Evidence: `audio-preferences.json` and exact range key commands in `browser-commands.log`. No claim that sound quality was heard.

Generated Black Vault / Elite with seed DENSITY-08: eight guards, fingerprint `304e0d61`. Regenerated unchanged controls and got the same fingerprint. Changed seed to DENSITY-09 and got `4b8e5749`. The independent live simulation test measured confirmed sight at 1.700s for Ghost and 0.817s for Elite with identical viewing geometry, so difficulty alters behavior.

Played the eight-guard Elite mission into an alarm. Initial captured state had two pursuits and two investigations; after escape, seven guards simultaneously investigated and one remained suspicious. The simulation stayed active and rendered at about 60 FPS. Evidence: `eight-guard-alarm-response.json`, `eight-guard-escape.json`, screenshot `22-eight-guard-response.png`.

Changed the desktop viewport to 1280×800 at device scale factor 2. Canvas backing width was 1836 for CSS width 918. Exercised held keyboard movement, released and paused; no console/uncaught errors. Evidence: `high-dpi.json`.

## Final offline regression — PASS
After all implementation changes, ran `python3 evidence/final-mission.py` using only real agent-browser input and read-only diagnostics. A new Dockside extraction succeeded in 15.98s, 1 detection, 1 alarm, 1 intel, score 1503, rank B. Export, file upload/import, timeline playback, and End-key scrubbing passed again. Repeated 390×844 held-key movement and screenshots, then restored the default desktop briefing. Evidence: `final-regression-victory.json`, `final-completed-run.json`, `final-replay-roundtrip.json`; screenshots `23-final-objective.png`, `24-final-victory.png`, `25-mobile-final-briefing.png`, `26-mobile-final-active.png`, `27-delivered-desktop.png`.

The final run occurred with `agent-browser set offline on`, directly on the file URL. Fresh startup and reload succeeded. Network request log `final-requests.txt` contains only successful reads of the local HTML document; no external assets/services or failed requests. Final console and uncaught-error commands returned no output. A separate HTML parser inspection found no external src/href attributes and confirmed the CSP's `connect-src 'none'`. A local HTTP server was unnecessary and was not used.

Fresh final checks:
```
node --check evidence/logs/script-0.js
node --check evidence/logs/script-1.js
node evidence/core.test.cjs
node evidence/ai.test.cjs
node evidence/import.test.cjs
```
Observed: both embedded scripts parsed; 5 core contracts, 4 AI contracts, and 13 import/round-trip checks passed. The map contract covers 270 seed/preset/difficulty combinations. Independent bounded review confirmed the import fixes and reported no remaining Important findings at that boundary.

## Delivery status and limits
- PASS: completed single-file game; complete heist and failure loop; real sight/sound/navigation/search behavior; devices and all three gadgets; pause/restart; controls at both required viewports; focus loss and trusted touch cancellation; deterministic generation and meaningful difficulty; local run history; real JSON export/import; recorded timeline; live diagnostics; offline direct-file runtime; high-DPI canvas; clean console.
- No unresolved functional failure observed in the checks above.
- Not-run: subjective audio listening quality and physical mobile-device testing. Browser Web Audio state and trusted emulated touch were exercised. No exhaustive proof of every arbitrary seed or every browser engine is claimed.
- Replay is sampled telemetry (player and guard positions, doors, objective/alert state, event log), rather than deterministic action resimulation; this is the implemented recorded-run option.
- Local history uses browser storage and keeps the last eight runs. If a browser denies storage or quota is exhausted, export remains available. Telemetry is bounded to 14,400 samples.

Final artifact: `index.html`, 97,926 bytes.
SHA-256: `1f5edc2265e1e92660bc561ae697d7991176cbbc246307245d7622a719460421`.
