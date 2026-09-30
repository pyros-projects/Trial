# Echo Chamber validation

Artifact: `../index.html`. Tools: installed `agent-browser` with its version-matched `core` and `dogfood` workflows, Node v25.8.1, Python 3.12.3. No substitute browser tool was needed.

## Initial checks

- PASS: behavior tests were written before the engine. `node evidence/engine-tests.cjs` initially failed because no application existed (`logs/engine-red.txt`). After implementation, all five tests passed (`logs/engine-green.txt`): bounded JSON normalization, floor/jump, carry replay with independent player movement, echo-held plate/door, deterministic restart.
- PASS: extracted scripts checked with `node --check evidence/app-syntax.js` and `node --check evidence/engine-syntax.js`. A preliminary process-substitution command was rejected by Node because its temporary pipe path could not be read; extracting to files resolved the tooling issue.
- PASS: `agent-browser --session echo --allow-file-access open file:///home/pyro/projects/naked/sol61/17-echo-loop-puzzler/index.html` opened the delivered artifact directly. `set viewport 1280 800`, `set offline on`, `reload`, `snapshot -i`, `errors`, and `screenshot evidence/screenshots/01-introduction-desktop.png` succeeded. No uncaught errors. The game had frame 0, initial player and geometry, no active input and an uninitialized audio context.
- Observed layout issue: at 1280×800 the large stage pushed the timeline below the first viewport. Fixed desktop stage sizing; screenshot 02 and final screenshot 44 show the stage, controls and timeline within that viewport.

Checks below are filled as performed, not assumed from source.

## Gameplay, recorded actions and timeline

Held game input uses `evidence/browser-input.cjs`, attached to the **agent-browser session's** CDP endpoint obtained with `get cdp-url`. It sends genuine `Input.dispatchKeyEvent` key-down/up events, because the installed CLI's `press` command only supplies a tap. It does not call game functions or alter application state. Navigation, buttons, pointer operations, snapshots and screenshots use agent-browser directly.

- PASS: `focus '#game'`; `node evidence/browser-input.cjs to ArrowRight 350 pause` reached x=351.33 at frame 67, grounded on the floor, activated A and opened door-A (`logs/intro-plate.json`). Gesture enabled Web Audio: running, 44100 Hz. Audio was not audited by listening.
- Tooling note: `find role button click --name 'Record & rewind R'` did not find the composite button label. A fresh accessibility snapshot identified `@e17`; `click @e17` worked. The dependent condition wait timed out because the failed click had not started playback. This is recorded as a failed automation selector, not a gameplay pass. Repeated with the ref, the flow completed.
- PASS: Record & rewind, then hold ArrowLeft + Space for 300 ms; wait until frame ≥85; pause. At frame 90 the echo was x=351.33 / y=396, its measured maximum drift was 0, plate A active, door open. The player was independently x=71.33 with a real recorded jump event (`logs/intro-replay.json`, `screenshots/03-echo-cooperation.png`).
- PASS: paused pointer click on timeline at (152,680) created a read-only past reconstruction while live frame remained 90 (`logs/timeline-preview.json`, screenshot 04). Clicking Step returned to live frame 91, paused, with no preview. Toggled quarter speed and restored 1×. Resumed and walked through the gate; goal overlap produced a Gold victory modal and progression (`screenshots/05-first-victory.png`). Export solution downloaded a real JSON trace (`echo-solution.json`).
- PASS: Next chamber, walk to plate A / record, walk to plate B / record, walk to exit. Two echoes held A and B, both drift=0, current player reached x=1018; real win (`logs/cooperation-victory.json`, screenshot 06).
- PASS: chamber 3, walk to core, press E, carry to x=654.67, drop E, record. New player jumped left independently. Echo replayed carry at frame 21, checkpoint path at 153, drop at 173; at frame 192 delivered core was x=650.67, y=400; measured drift=0 (`logs/carry-replay.json`, screenshots 07–08). The player then picked up that core, jumped onto the raised plinth, dropped it on plate A, and walked through the door to a real win (`logs/core-on-plate.json`, `logs/handoff-victory.json`, screenshot 09).
- Observed physics issue: dropping a core from overhead briefly pulled the carrier upward as it collided with the falling core. Reproduced in engine behavior test (`logs/drop-red.txt`). Fixed by placing a dropped core beside the carrier when space is available. Carry/drop/throw retests are recorded below.

## Workshop and persistence

- PASS: New room, place Core and Plate with labeled palette buttons and pointer clicks; configure plate Y=422 and channel B. Set room name through its labeled field; Undo restored the prior name and Redo restored Browser lab.
- Initial third-object attempt FAIL (automation coordinates): editing lower properties scrolled the page, so a later fixed-coordinate pointer click missed the canvas; diagnostic object count was 5, with no door. No three-object pass is inferred from that attempt. Retest: scroll to top, choose Place Door, inspect canvas bounds, click (558,368), configure channel B. Live editor state showed six objects, selected door-1, no validation errors (`logs/editor-three-objects-retest.json`).
- PASS: Save slot → Save chamber; Export JSON downloaded `browser-lab-level.json`. New room → Load slot → Browser lab restored all six objects. Play-test starts with the same level; actual right movement pushes the core and activates B, real door opens (`logs/custom-plate.json`, screenshot 12). Record and reach the goal; Return to workshop restored six objects and its 11-entry history (`logs/custom-win.json`).
- PASS: import `{not json` and `null` rejected with visible errors (screenshot 13); upload exported JSON then Validate & import restored the six-object room with no errors. Reload the file, enter Workshop: draft and local slot survived (`logs/editor-persistence.json`, screenshot 14).
- Observed transform issue: at fit zoom 0.46, dragging a 32px core from its center resized it from width 32 to 64 instead of moving it. Root cause: a 10-screen-pixel resize hit radius exceeded half of the object's world dimensions. Fixed by restricting corner hits to an already selected object and capping the radius relative to its dimensions.
- PASS: Multi-select picked core and plate, Duplicate produced two selected new IDs and object count 8; Delete restored 6; Undo and Redo restored and removed the group again. Further move/resize/pan/zoom checks follow the corner-hit fix.

## Transform retests, narrow viewport and six-chamber campaign

- PASS: corner-hit fix retest dragged the core center (270,413) → (302,413): X became 288, width stayed 32 (`logs/editor-move-result.json`). Dragging selected corner (320,432) → (336,448) resized it to 48×48; Undo / Redo changed the geometry as expected. Pan drag, zoom in/out and Fit changed and restored camera transforms. A placed laser rotated to horizontal 160×8, then Delete removed it (screenshot 15).
- PASS: editor at 390×844 had usable palette, properties and zoom buttons with no horizontal document overflow (screenshot 16). Initial desktop-to-narrow resize preserved an off-center editor view; repaired resize handling now fits the room when dimensions change substantially. Retest follows.
- PASS: intro at 390×844; real CDP touch points on labeled Move right and Jump buttons simultaneously; after 350ms touchCancel released both. Player moved from x128 to x201.33, y315.5, jump event at frame1, input=0 after cancellation (`logs/touch-cancel.json`). Document scrollWidth=viewport=390. Record / pause / diagnostics showed a replaying echo, drift=0. Undo last removed it and restored frame0, spawn, input0 (`logs/undo-echo.json`, screenshots 17–19). Resize back to 1280×800 retained diagnostics and controls.
- PASS: chamber 4. Record plate A, walk to the departure edge, wait to frame320, jump right for350ms. At frame383 player grounded=true, support=transit, y376.18; moving lift x427.45 / y412.18 (`logs/lift-boarded.json`). With no movement input the lift carried the player across (`logs/lift-carried.json`). Walk off and reach goal: win at frame615, echo drift=0 (`logs/transit-win.json`, screenshots 20–21).
- PASS: chamber 5. Record A; E activates toggle C, disabling/starting its linked lift; A disables the actual beam. E on B activates its four-second timer; jump over the hazard strip, pass gate and reach goal at frame302 (`logs/toggle-laser.json`, `logs/hazard-win.json`, screenshot22).
- PASS: chamber 6. Record A at x251.33, B at x618, C at x881.33. Fourth attempt reaches goal at x1074.67, frame287. All three echoes have drift=0; A/B/C active, final beam disabled. Final victory modal says “Every you made it.” (`logs/final-victory.json`, screenshot23). All six campaign levels have been solved by real input.

## Final physics and stability repairs

- PASS: side-drop fix, regression suite6/6. Browser retest kept player at y396 / grounded after E drop (`logs/drop-retest.json`). Carry at21, drop28, carry37, throw45 replayed with zero drift while the new player moved independently (`logs/throw-replay-retest.json`).
- FAIL then FIXED: a new hazard-respawn behavior check showed an echo stopped after its recorded death while the original player had respawned. Root cause was different player/echo death branches and divergence measured before post-hazard state. Unified respawn/checkpoint transitions and moved drift measurement to the completed timestep. Test logs: `logs/respawn-red.txt`, `logs/engine-nine.txt` (9/9 pass).
- PASS: browser hazard replay retest. Walked into chamber5 laser: hazard event at frame127 and player respawned. Recorded it; independently moved the new player left. Echo reproduced the respawn and continued, alive, drift=0 (`logs/hazard-respawn-original.json`, `logs/hazard-respawn-replay.json`, screenshot25).
- Fixed the five-echo limit: the timer now pauses at the exact loop endpoint, instead of repeatedly attempting to record a sixth echo and letting the input arrays grow. The explicit retest is recorded below.

## Capacity, divergence, focus and preferences

- PASS: created five echoes through movement and Record, then let the 12-second intro loop end. Frame and recorded-input length stopped at exactly 720, paused=true, echoes=5. Step at the endpoint stayed at 720; no sixth echo or growing input array. All five echoes remained on the floor with drift=0 (`logs/capacity-endpoint.json`, screenshot 27).
- PASS: deliberately recorded walking into the closed intro door, then rewound and held A with the current player. The echo advanced through the newly open door, correctly diverging from its blocked reference. Warning at frame213, distance113px; its actor warning, sidebar status, toast and overlay showed drift (`logs/divergence-original.json`, `logs/divergence-warning.json`, screenshot26). This is an intentionally induced warning, not a failed normal puzzle.
- PASS: with ArrowRight held, opened a new `about:blank` tab and returned to tab1 using agent-browser. Input cleared to0 and the world paused at frame1 (`logs/focus-loss.json`). Pointer cancellation similarly released both simultaneous touch actions.
- PASS: Settings controls for reduced motion, reduced flash, high contrast, music and volume persisted through reload (`logs/settings-persistence.json`). Remapping right to L produced real movement; W produced a jump. Attempted Throw→U and Right→ArrowLeft were rejected because they conflict with fixed controls (`logs/remap-and-w-retest.json`). Defaults were restored for later campaign checks.
- PASS: focused Field guide with keyboard and pressed Enter: guide opened. Focused Pause and pressed Space: native button activation paused the world without creating a jump/interact input (`logs/native-button-keyboard.json`).

## Independent review and targeted repairs

The read-only reviewer `/root/final_review` found five important issues and one smaller issue. These were investigated, repaired and retested; see [review.md](review.md). Its review preceded the repair pass, and is not presented as a second post-fix approval.

- FAIL → FIXED → PASS: unfinished drafts were rejected on reload. Added structural draft restoration separate from gameplay validation. Deleted a custom room's goal, reloaded and entered Workshop: name and five objects survived, with “Place at least one goal” shown (`logs/missing-goal-draft-retained.json`). Added the goal again through the palette. Engine tests also verify rejection of unsafe draft types and restoration of an empty unfinished draft.
- FAIL → FIXED → PASS: moving lifts directly displaced riders through walls and could pop them onto the wall top. Transport now resolves through collisions while ignoring the supporting platform. A loose core uses the same support transport. RED reproductions are in `logs/review-physics-draft-red.txt`; engine retests and imported browser regression rooms pass. Browser wall reproduction: player x276,y364, no wall climb (`logs/transit-wall-browser-retest.json`, screenshot33). Loose core: x297.8,y368 while the lift advanced (`logs/transit-core-browser-retest.json`, screenshot34). Fixtures are agent-authored `transit-wall-level.json` and `transit-core-level.json`.
- FAIL → FIXED → PASS: invalid negative goal width caused Canvas `roundRect` to throw and stopped rendering. Guarded invalid/nonfinite geometry and added selection by object ID so bad or offscreen geometry remains recoverable. Original screenshots29–30 document the failure; screenshot31 documents the initial fix. Fresh isolated retest: set goal Width=-8, click Play-test; editor remained at ~60FPS, showed the geometry error, and displayed “Fix the room before play-testing”. Set Width=48, reload and return to Workshop: width48 and no validation errors (`logs/final-invalid-geometry-retest.json`, `logs/final-geometry-recovery.json`, screenshot43). No browser errors in the repaired fresh session. The old session's error buffer retained the original RangeError even after `errors --clear`; an isolated session was used for clean error checks.
- FAIL → FIXED → PASS: checking Diagnostics left focus on its input, so P was ignored as a form-field key. Diagnostics now returns focus to the game while playing. The first final-campaign automation attempt continued after a movement timeout and did not establish valid campaign results; it was stopped. The input helper now exits nonzero on a movement timeout, and dependent command batches stop on failure. Focus retest is in `logs/diagnostic-input-focus-retest.json`; the complete campaign was then repeated successfully.

## Repaired six-chamber campaign

The actual browser campaign was repeated from chamber1 through the final victory after the collision, draft, remapping and focus repairs. Each row has a genuine goal event and `won:true`; none is inferred from a screenshot or from the Next button. Later contact-arrow and inventory-warning additions were followed by the compact regressions below.

| Chamber | Live outcome | Echoes | Win frame | Divergence | State log |
|---|---|---:|---:|---|---|
| 1 · A second you. | PASS, echo holds A while player exits | 1 | 347 | None | `logs/final-intro-win.json` |
| 2 · Better together. | PASS, two echoes hold A and B | 2 | 270 | None | `logs/final-cooperation-win.json` |
| 3 · Handle with care. | PASS, delivered core is received and placed on raised A | 1 | 357 | None | `logs/final-handoff-win.json` |
| 4 · The right moment. | PASS, lift transport and one-way landing | 1 | 623 | None | `logs/final-transit-win.json` |
| 5 · An interruption. | PASS, timed gate and hazard jump | 1 | 288 | None | `logs/final-hazard-win.json` |
| 6 · All of us, at once. | PASS, three echoes open final route | 3 | 287 | None | `logs/final-multi-win.json` |

Additional live diagnostics confirm the chamber4 landing was actually grounded with support=`landing` on the one-way platform (`logs/final-oneway-support.json`). The final victory screenshot42 shows the complete campaign flow; `final-solution.json` was downloaded using Export solution. Progress ranks/loop counts are stored locally and displayed in chamber selection.

Exact held-input commands use this form from the working directory:

```bash
ECHO_BROWSER_SESSION=echo-final node evidence/browser-input.cjs to ArrowRight 350 pause
agent-browser --session echo-final click @e17 # fresh snapshot's Record & rewind button
ECHO_BROWSER_SESSION=echo-final node evidence/browser-input.cjs hold ArrowLeft,Space 300
agent-browser --session echo-final wait --fn 'echoLab.state.frame >= 95'
ECHO_BROWSER_SESSION=echo-final node evidence/browser-input.cjs tap KeyP
```

For campaign2, move to x288/record, x704/record, then x1025. For campaign3, approach x180/E carry, x650/E drop/record; the new player goes to x650, waits for the dropped core, E receives, jumps right from x690 to x802, faces left, drops on A, and exits. For campaign4, A at x288/record, departure x400, wait frame320, hold Right+Space350ms, ride until frame530, move to x852 (one-way support check), then exit. For campaign5, A at x304/record, B at x728/E, approach x792, Right+Space650ms, then exit. For campaign6, x248/record, x616/record, x876/record, then x1085. Pause between inspection points, and resume before movement. The JSON logs retain actual event frames, rather than assuming key-command latency equals simulation time.

## Final contact and carry-warning regressions

- PASS: collision diagnostics now draw directional arrows for actual actor/core contacts. Real held-right input into the closed intro gate yielded x728,y396, contacts `door-A=(-1,0)` and `floor=(0,-1)`, at ~60FPS (`logs/final-contact-normals.json`, screenshot46). Commands: `node evidence/browser-input.cjs down ArrowRight`, `wait --fn 'echoLab.state.player.x >= 727'`, read diagnostics, tap P, and release ArrowRight. These are live collision results, not injected diagnostics.
- PASS: after that change, restart, move to A, record, move/jump left independently. At frame143, player x68 and echo x351.33, A active, echo drift0 (`logs/delivery-echo-replay.json`). Actual timeline pointer move/down/up at (150,668) produced preview frame32 while live frame remained143 and recording remained67 frames. Step returned to live frame144, paused (`logs/delivery-timeline-inspection.json`, `logs/delivery-step.json`). Resume/right reached a real goal at frame476 with zero drift (`logs/delivery-intro-win.json`, screenshot47).
- FAIL → FIXED → PASS: a pure-engine regression showed a missed pickup was not warned about when the echo's position stayed correct. Added sustained carry-state mismatch detection alongside positional drift. RED log: `logs/carry-divergence-red.txt`; final suite13/13. Browser reproduction imports the agent-authored `carry-divergence-level.json`, records a delayed pickup, then the new player picks up the core before the echo's recorded interaction. Original pickup at209; new player pickup45; warning at233 with distance0, reason=`carry interaction changed`, expected core, actual null (`logs/carry-divergence-browser-original.json`, `logs/carry-divergence-browser-ownership.json`, `logs/carry-divergence-browser-warning.json`, screenshot49).
- Automation FAIL → RETEST PASS: using a relative upload path (`upload '#importFile' evidence/carry-divergence-level.json`) stalled two browser sessions; subsequent Runtime.evaluate and Page.enable timed out, and screenshot capture failed with Internal error. No screenshot48 was produced. `agent-browser doctor --offline --quick` passed its environment/Chrome checks (`logs/browser-tool-doctor.txt`). Closing/reopening the session and using the **absolute** file path loaded655 characters immediately, validated and play-tested normally (`logs/carry-divergence-browser-import.json`). This failure was in the upload automation; absolute-path import is the successful retest.
- Automation FAIL → RETEST PASS: the first extra handoff attempt left the simulation running while the agent inspected output, exceeded the 18-second loop, automatically recorded another echo and timed out before the goal. `logs/delivery-handoff-win.json` contains `won:false` despite its filename and is not a pass. Added an optional `pause` argument to the development-only input helper (it sends P through actual keyboard events). Repeated chamber3 from deterministic load with pauses between inspections: recorded pickup65/drop309; new player received core360, jump475, drop620, goal740. Final frame741, one echo, A active, zero drift, actual victory (`logs/handoff-fresh-win.json`, screenshot50). The carry warning does not falsely flag this intended handoff.

The fresh handoff command sequence was:

```bash
agent-browser --session echo-delivery find role button click --name 'Chambers'
agent-browser --session echo-delivery find role button click --name 'Play chamber 3: Handle with care.'
# Prefix each input command below with:
# ECHO_BROWSER_SESSION=echo-delivery node evidence/browser-input.cjs
to ArrowRight 180 pause
tap KeyP
tap KeyE pause
tap KeyP
to ArrowRight 650 pause
tap KeyP
tap KeyE pause
agent-browser --session echo-delivery click '#recordBtn'
to ArrowRight 650 pause
tap KeyP
agent-browser --session echo-delivery wait --fn 'echoLab.state.objects.some(o=>o.type === "crate" && o.x > 620 && !o.heldBy)'
tap KeyE pause
tap KeyP
to ArrowRight 690 pause
tap KeyP
to ArrowRight,Space 802 pause
tap KeyP
hold ArrowLeft 60 pause
tap KeyP
tap KeyE pause
tap KeyP
to ArrowRight 1025
```

## Responsive, direct-file and audio checks

- PASS: actual desktop1280×800 and narrow390×844 rendering, navigation and controls. Final default-opening screenshots51–52 (earlier44–45 retained). Narrow document scrollWidth=390, no horizontal overflow. Editor resize repair retest fitted the whole room at zoom0.2875/pan14.4 (`logs/editor-narrow-fit-retest.json`, screenshot32). Timeline and diagnostics were exercised at both sizes (screenshots18–19 and37–38).
- PASS: repeated narrow simultaneous touch + jump with genuine CDP touch points, then touchCancel: x201.33,y316, jump event1, input0 after release (`logs/delivery-touch-cancel-retest.json`). An earlier final touch command had been allowed to overlap a subsequent Pause command because its shell process yielded; that attempt is retained in `delivery-touch-cancel.json` and is not used to assert full350ms coverage. The retest waited for process completion before dependent actions.
- Initial high-DPI attempts NOT A PASS: direct CDP device metrics did not persist across CLI calls (`logs/high-dpi.json` still reports DPR1), and an iPhone13 preset was unavailable. PASS retest: `agent-browser --session echo-final set device 'iPhone 15'` gave DPR3, CSS canvas363×320, bitmap1089×960 at393×852 (`logs/high-dpi-retest.json`, screenshot40). This is Chrome device emulation, not a Safari test.
- PASS: opening the delivered `file://` document directly, including reload, works. No local HTTP server was needed. `set offline true` followed by reload and an immediate diagnostic check reported navigator.onLine=false at frame0 (`logs/direct-file-offline-state.json`). The browser's offline emulation was later reset during further command/CDP activity, so it is not claimed as continuously active for every gameplay test. Source audit and recorded requests independently establish no network runtime dependencies. HTTP/HTTPS abort routes were also used in the earlier final session; no remote request occurred.
- PASS: `node evidence/verify-artifact.cjs` extracts and syntax-checks both embedded scripts, finds no external src/href, CSS URL/import, network API call or module script. The only tracked requests in fresh sessions are successful requests for `file:///.../index.html` (`logs/final-network.json`, `logs/delivery-network.json`). No external cached resources are required. Audit hash is stored in `logs/dependency-audit.json`.
- PASS (state only): gesture-enabled Web Audio context is running at44100Hz after keyboard input and after clicking Enable sound (`logs/intro-plate.json`, `logs/final-audio-gesture.json`, `logs/handoff-fresh-win.json`). Synthesized touch alone left the context suspended in a later isolated attempt; explicit Enable sound click resumed it. Mute/enable buttons and volume/music settings were exercised. **NOT-RUN:** listening evaluation of procedural sound/music quality; no claim that sound was heard.
- PASS: fresh-session browser `errors --json` and `console --json` return empty arrays after repaired workflows (`logs/final-errors.json`, `logs/final-console.json`, `logs/delivery-errors.json`, `logs/delivery-console.json`). Tool-generated evaluation errors from a mistaken `#soundBtn` selector and failed composite-name selectors were corrected to `#audioBtn`/fresh snapshot refs; they are not hidden as successful interactions.

## Final verification and coverage limits

Final commands from the application directory:

```bash
node evidence/verify-artifact.cjs
node evidence/engine-tests.cjs
agent-browser --session echo-delivery errors --json
agent-browser --session echo-delivery console --json
agent-browser --session echo-delivery network requests --json
```

Final engine suite: **13/13 PASS**. It tests bounded JSON sanitization, floor/jump, exact carry replay with independent movement, actual plate/gate state, deterministic restart, side drop, positional divergence, throw replay, same-frame hazard respawn, lift-wall collision, core lift transport, unfinished draft restoration, and missed-pickup divergence. No evaluator-owned tests, fixtures or reports were modified or fabricated. All test harnesses and regression rooms here are agent-authored and are outside the delivered HTML.

Final render-bound repair/retest: the invalid-geometry guard also rejects oversized dimensions/coordinates before decorative geometry loops can run. Set the floor Width to `1e25` through the editor's labeled field, Tab, wait600ms, then read diagnostics: the floor was flagged invalid and rendering continued at59.99FPS (`logs/large-solid-bound-retest.json`). Goal Width=`1e25` was similarly guarded; restoring48 returned to no errors (`logs/large-geometry-bound-retest.json`, `logs/large-geometry-recovery.json`). Restored floor1152 and reloaded. The first attempt at this extra check found the automation session had been relaunched on `about:blank`; missing selectors and `echoLab is not defined` were tool navigation failures, not passes. Explicitly opening the file URI and repeating the controls produced the successful results. After the last source change, script audit and all13 engine checks were rerun, and direct-file offline reload again reported frame0, intro level, zero echoes and navigator.onLine=false (`logs/delivery-direct-file-offline.json`). Final error/console arrays are empty and all three tracked requests are successful file-document requests. No external services or cached assets were needed.

| Coverage | Status | Limit |
|---|---|---|
| Six-level campaign and complete victory flow | PASS | Actual keyboard/pointer interactions and state logs |
| Cooperative replay, crate physics, hazards, switch types, lift/one-way | PASS | Built-in and authored regression rooms |
| Editor placement/configuration, history, transforms, links, play-test, slots, JSON | PASS | Three configured types plus spawn/goal; all core types available |
| Timeline preview/step/slow motion and diagnostics | PASS | Read-only scrub preserves live recordings/state |
| Direct file, no external assets, desktop/narrow/DPR3 | PASS | Chrome143 only |
| Gamepad hardware/disconnection | BLOCKED | No physical controller in the environment; implementation exists, no hardware pass claimed |
| Audio listening quality | NOT-RUN | Audio context state and explicit activation tested |
| Other browser engines and physical mobile devices | NOT-RUN | Device emulation is not a hardware/browser-engine test |

No known unresolved application failure remains from the exercised flows. Physical gamepad and listening coverage remain unverified. Custom-room validation checks safe structure/geometry/links, not guaranteed puzzle solvability; timeline inspection is read-only and has no timeline editing/checkpoint mutation feature.
