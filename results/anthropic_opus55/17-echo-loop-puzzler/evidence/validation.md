# Echo Loop — validation record

Artifact: `../index.html` (single self-contained file, ~229 KB, 3.5k lines). No build step, no external assets, no network use.
Date: 2026-09-30. Author of this record: the implementing agent (Claude). Results are marked **PASS**, **FAIL**, **BLOCKED**, or **NOT-RUN** as observed.

## Tools and environment

| Item | Value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (skill loaded; `skills get core` and `skills get dogfood` read before use), Chrome via CDP, headless |
| Page origin | **direct `file://…/index.html`** for every browser check (agent-browser supports `file://`, so no HTTP server was needed) |
| Headless sim tests | Node 25.8.1 running the simulation block extracted from the delivered `index.html` (`// @@SIM-BEGIN` … `// @@LEVELS-END`) |
| Viewports | 1280×800 (DPR 1 and 2), 390×844 |
| Harness | `harness/ab.sh` (helpers), `harness/chorus.sh`, `harness/probe.sh`, `harness/simtest.js` — kept outside `index.html` |

How input was driven: real CDP key events (`agent-browser keydown/keyup/press`), real mouse events (`mouse move/down/up`, `click`), and DOM control clicks. Game state was *read* through the read-only diagnostics hook `window.EchoLoop.state()`, which reports positions, ticks, doors and so on. The hook has no gameplay shortcuts, and no test injected game inputs through it. Two exceptions used synthetic DOM events because the hardware or tool path was unavailable (gamepad, `pointercancel`, positioned wheel). They are labelled below.

### Tool quirks found (and how they were handled)
1. `agent-browser keydown ArrowRight` sends `KeyboardEvent.code === ""`, and `keydown Space` sends empty `key` **and** `code`. Real browsers set `code`, but some virtual keyboards and assistive layers don't, so the app gained a `key → code` fallback (`codeOf()`). A fully empty event can't be mapped, so scripts use **W**, which is also bound to jump.
2. `agent-browser mouse wheel` dispatches at client (0,0) (the top bar) instead of under the cursor. I tested editor zoom with the on-screen +/− buttons (real clicks) and with a positioned `WheelEvent` dispatched on the canvas.
3. Polling via `agent-browser eval` takes about 7 ms per call, so an early count-based wait loop gave up too soon. I rewrote the helpers to be time-based. That was a harness bug, not an app bug.
4. During one Chorus attempt the browser was relaunched mid-run (page went to `about:blank`). That attempt is **invalid**, not counted. The rerun used a 250 ms page-health probe (`chorus-page-health-probe.log`) and showed no page hang or crash.

## Headless simulation suite — `node harness/simtest.js ../index.html`

Output: `sim-tests.log` → **19/19 checks passed**. The bots are closed-loop: they watch world state and emit per-tick input bits exactly like a player. Their tapes become echoes that replay open-loop.

| Check | Result |
|---|---|
| L1 First Echo solvable in 2 loops; **negative control**: 1 loop cannot win | PASS / PASS |
| L2 Stand Tall (3 loops, stacking on an echo) | PASS |
| L3 Handoff (2 loops, echo throws crate out of pit) | PASS |
| L4 Rush Hour (2 loops, timer echo + two lifts) | PASS |
| L5 Laser Waltz (2 loops, pulse-laser sync) | PASS |
| L6 Switchback (2 loops); negative controls: flipping the lever yourself / never flipping it cannot win | PASS / PASS / PASS |
| L7 Chorus in 4 loops, and in 3 loops with the crate trick (gold par) | PASS / PASS |
| Exported trace → JSON → re-imported session reproduces the win with identical world hash (L1, L7) | PASS |
| Live loop re-simulated from tick 0 gives identical hash (`verify()`) | PASS |
| Divergence surfaced when an echo loses the body it stood on | PASS |
| Checkpoint `resumeFrom(40)` restores exact tick-40 state; re-sim still matches afterwards | PASS |
| Forecast preview to loop end does not touch the live world | PASS |
| Malformed levels (`null`, numbers, `__proto__`/`constructor` types, huge sizes, bad format) never throw; no prototype pollution | PASS |

## Real-browser checks (agent-browser, `file://`)

Screenshots are in `screenshots/`. "Real keys" means CDP keyboard events.

### Core loop mechanic (public checks 1–2)
| # | Steps | Observed | Result |
|---|---|---|---|
| B1 | Boot `index.html` directly | Opens straight into L1 "First Echo" with title card, stats overlay, timeline; 0 console errors; loop clock waits for first input (`01-boot-desktop.png`) | PASS |
| B2 | L1: ¼× slow-mo (G G), hold → until on plate | plate `on:1`, door `open:1` (`02`) | PASS |
| B3 | Press **R** | rewind transition plays snapshots in reverse (`03`); echoes=1, loop 2 | PASS |
| B4 | Loop 2: hold → | echo replays to x=204 (identical to recorded end position, drift 0) and holds the plate while the new player walks independently through the door → goal. Won: 2 loops, 9.9 s, **Gold** (`04`, `05`) | PASS |
| B5 | L3 Handoff, real keys: dive into pit, **E** grab, jump (W), **F** throw at apex, **R**; loop 2: jump pit, push crate into 1-tile pocket, climb, exit | echo reproduced `grab@71`, `throw@100` exactly (0 drift); plate on → door open → won (`06`–`09`) | PASS |
| B6 | L3 divergence: in loop 2 steal the crate before the echo's recorded grab | toast "⚠ Echo 1 diverged at 1.47s: missed "grab""; stats `E1@1.5s` in red; red ⚠ marker on the E1 lane; echo outlined red; its future "throw" intent still shown (`20`) | PASS |

### All built-in levels with real keys
| Level | Loops | Notes | Result |
|---|---|---|---|
| L1 First Echo | 2 | plate cooperation | PASS |
| L2 Stand Tall | 3 | landed on echo's head (y=284 = echo top), ledge, 2-plate door (`23`) | PASS |
| L3 Handoff | 2 | carry + throw handoff | PASS |
| L4 Rush Hour | 2 | echo pressed 3 s timer at ~6 s; rode horizontal + vertical lift; door open on arrival (`24`) | PASS |
| L5 Laser Waltz | 2 | crossings timed from live laser phase; echo held plate turning channel laser off (`19`) | PASS |
| L6 Switchback | 2 | echo flipped lever at ~4 s: inverted door closed behind, far door opened (`31`) | PASS |
| L7 Chorus | 3 | echo 1: crate→gate plate, lasers, one-way climb, timer at 12.7 s; echo 2: lift plate at 12.3 s; player rode channel lift, sky door open (`25`, `26`, `chorus-realkeys.log`). Run was made when Chorus was level 6, before Switchback was inserted; its definition is unchanged and the headless suite re-verified it at index 6. | PASS |
| Smoke: load all 7 levels, move, 0 errors, 60 FPS | — | `level-1.png` … `level-7.png` | PASS |

### Physics, objects, controls
| Check | Observed | Result |
|---|---|---|
| Jump, crate collision/push/carry/throw, doors, plates, levers, timers, lifts, lasers, spikes, one-ways | exercised across the level runs above | PASS |
| Hazard death → auto-retry | L5 with 1 echo: walked into a live beam → state `dying`, toast "Vaporised by a laser — the loop restarts (echoes kept)" → loop restarts at tick 0 with echo 1 intact; stats deaths=1, retries=1 (`32-laser-death.png`) | PASS |
| Simultaneous move + jump (both held) | vx=3 and vy<0 at the same time | PASS |
| Focus loss while holding → | `blur` → held keys cleared (0), player stops, toast "Focus lost — all held inputs released" | PASS |
| Touch buttons (390 px) with real mouse on on-screen ▶ and Jump | player moved / jumped (`29`) | PASS |
| Touch `pointercancel` | synthetic `pointercancel` on held ▶: counter 0, `held` class removed, vx→0 | PASS (synthetic event) |
| Gamepad | `navigator.getGamepads` overridden with a fake pad (stick right + A) → bits R\|J, run+jump; pad removed → bits 0, no stuck motion | PASS (**simulated**, no physical pad) |
| Undo echo / Clear / Retry / Restart (buttons, keys, confirm dialog) | counts and stats behaved as expected | PASS |
| Echo cap | 5th R with max 4 → "Echo limit (4) reached — this loop was not kept" | PASS |
| Pause menu (Esc), frame step (`.`) with → held: tick 25→28, scrub back (`,`) ×5 → preview 23 | (`27`) | PASS |
| Settings: reduced motion (body class), master volume, key remap Jump→O persisted to localStorage, O jumps in game, Help table shows "O · ↑ · W", reset | (`21`) | PASS |

### Timeline, checkpoint, diagnostics (public check 3, part)
| Check | Observed | Result |
|---|---|---|
| Drag on timeline (real mouse) while paused to t=5 s | FORECAST view (player assumed idle), live tick stays 73, "Resume from here" disabled (`15`) | PASS |
| Click t=0.5 s → preview → "Resume from here" | live tick 30, checkpoint counted; `verify()` ok at 30 and again at 123 (`16`) | PASS |
| Click echo lane label | "Echo 1 is locked: editing a recorded echo would silently desync every later echo…" | PASS |
| Diagnostics (F3) | hitboxes, contact normals, grounded/coyote/buffer, IDs, channel counts, echo drift, accumulator, world hash, frame-time graph, recorded-input strip, determinism button (`17`) | PASS |
| Resize to 390×844 with diagnostics + timeline on | both still render; compact stats; smaller diag panel (`18`) | PASS (after fix F7) |
| High-DPI (DPR 2) | canvas backing 2560×1358 for 1280×679 CSS; timeline 2× (`28`) | PASS (after fix F9) |

### Editor (public check 3)
| Check | Observed | Result |
|---|---|---|
| Open editor (F2 → "Open draft") | palette, grid, bounds, SPAWN/GOAL labels, loop-duration card (`10`) | PASS |
| Place ≥3 types with the mouse | plate (click), door (drag 1×3), lever, crate; later wall, laser | PASS |
| Configure | lever and door set to channel 2 via properties; dashed link line and "Linked on channel 2" list; unlinked plate flagged (`11`) | PASS |
| Undo/redo | Ctrl+Z / Ctrl+Y and toolbar buttons revert/reapply channel change; 4× undo restores original position after move+nudges | PASS |
| Move / nudge / resize / rotate / duplicate / marquee / delete | drag-move (8,14)→(14,13); ←←↓ nudge; east handle 4→7 wide; laser dir 0→2; Ctrl+D; box-select 2 lasers; Delete | PASS |
| Pan / zoom | right-drag pan; +/− buttons 0.81→1.26→1.01; positioned wheel → 1.84; Fit | PASS (wheel synthetic, see quirk 2) |
| Invalid geometry | crate inside floor → "embedded in a wall" error, red hatch; play-test blocked with message; undo clears (`22`) | PASS |
| Play-test → back to editor | lever opened ch2 door, won; "Back to editor" restores selection and undo history (`12`) | PASS |
| Save slot, full reload, reload slot | saved "Lever Test" → page reload → Level select lists it (`13`) → Edit loads identical objects/channels | PASS |
| Export level JSON; import malformed / hostile / valid | broken JSON, wrong format and non-array are rejected with messages. Hostile payload is sanitised: `<img onerror>` name stays text (0 `img` elements), no prototype pollution, sizes clamped, out-of-bounds flagged. Valid export round-trips | PASS |
| Replay trace export → import | L1 solution trace (`L1-solution.trace.json`) re-simulated: "✓ Final world hash 83c20c5d matches the trace" (`14`) | PASS |
| Editor at 390×844 | palette strip, stacked properties, no horizontal page overflow (scrollWidth 390), tap placed crate (`30`) | PASS |

### Stability, network, direct file
| Check | Observed | Result |
|---|---|---|
| Churn: 5 rewinds to cap, undo, clear, retry×10, rewind+undo×10, restart, 5 editor↔play-test round trips | 0 errors, 60 FPS, heap ~10 MB, no particle/snapshot build-up | PASS |
| Network | request log shows only the `file://` document; HAR of a fresh load has 1 entry; static scan finds no external URL, fetch/XHR, import, eval or `new Function`; CSP `connect-src 'none'` | PASS |
| Offline emulation | `set offline on` → loads and plays, 0 errors | PASS |
| Direct `file://` open | every browser check above ran from `file://` | PASS |

## Failures found during validation → fixes → retest
| ID | Failure | Fix | Retest |
|---|---|---|---|
| F1 | Loop clock ran before the player touched anything | loop waits at 0.00 for first input (with on-screen hint); echoes wait too, so determinism is kept | PASS |
| F2 | Top bar overflowed at 1280 px (Editor/Settings/Help hidden) | secondary buttons icon-only with labels/tooltips | PASS |
| F3 | Keys with empty `code` ignored | `codeOf()` fallback everywhere (game, editor, remap capture) | PASS |
| F4 | "YOU" lane label clipped (text-align leak) | reset alignment/font per label | PASS |
| F5 | Walls barely distinguishable from air | new wall palette + per-rect gradient, darker air | PASS |
| F6 | Editor toolbar hid Play-test at 1280 px; unreachable on phones | compact icon buttons; floating ▶ in the zoom box | PASS |
| F7 | 390 px: Jump button cut off; stats/diag panels swamped the view | narrow touch layout, auto-compact stats, smaller diag | PASS |
| F8 | Door "1/2" badge text overflowed | measured badge width | PASS |
| F9 | DPR change (zoom / DPR 2) did not rescale the main canvas | DPR re-checked every frame → `onResize()` | PASS |
| F10 | Action prompt hidden under sign bubbles | prompt drawn under the player's feet | PASS |
| F11 | No built-in level used the toggle lever | added L6 "Switchback" (lever + inverted door + one-ways + spikes), with bot + real-key solves and negative controls | PASS |
| F12 | During design, crates in Chorus sat in every echo's path, and several echoes pushing at once legitimately desynced them (the detector caught it); Rush Hour lifts were step-ups that blocked walking | moved the crate out of the lane; sank lifts flush into shafts; re-verified | PASS |

## Not verified / limitations (honest)
- **Audio quality: NOT verified by ear.** Only checked that the `AudioContext` reaches `running` after a gesture, the music scheduler advances, and gain follows the volume setting.
- **Physical gamepad and real touch hardware: BLOCKED** (none available). Covered by the simulated `getGamepads` pad and by pointer events from the mouse plus a synthetic `pointercancel`.
- **Mouse-wheel zoom** was verified through a synthetic positioned `WheelEvent` only (tool quirk 2).
- **Other browsers NOT-RUN:** only Chromium/Chrome was tested, not Firefox or Safari. No screen-reader pass.
- Level difficulty and par times were tuned against bots and one tester (me); human playtesting of difficulty is not done.
- The live stats line "player" shows the live player state even while a scrub preview is displayed (minor).
- Actor-to-actor contact is deliberately simple: actors are solid only from above (you can stand on an echo's head), pass through each other horizontally, and an actor that jumps passes up through whoever stands on its head. Lifts do carry riders and never crush (they halt instead). All of this is deterministic, but it is not a full rigid-body solver.

## Commands (representative)
```bash
agent-browser skills get core; agent-browser skills get dogfood
node harness/simtest.js ../index.html            # headless: 19/19
source harness/ab.sh; fresh 1                     # opens file://…/index.html#level1
holdUntil ArrowRight "EchoLoop.state().player.x > 200" 4; agent-browser press r
agent-browser mouse move X Y; agent-browser mouse down left; agent-browser mouse up left
agent-browser set viewport 390 844; agent-browser set viewport 1280 800 2; agent-browser set offline on
agent-browser errors; agent-browser console; agent-browser network requests
harness/chorus.sh > chorus.log & harness/probe.sh > probe.log
```
