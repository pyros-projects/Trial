# Digital Logic Lab — author validation

Status: delivered and verified. Required public workflows pass; no known unresolved functional failure remains from the checks below. This is an agent-authored record, not an evaluator report.

Environment: Linux, Node v25.8.1, agent-browser 0.31.1. Loaded `.agents/skills/agent-browser/SKILL.md`, `agent-browser skills get core`, and `agent-browser skills get dogfood` before browser use. Final runtime: standalone index.html, no external dependencies.

Exact commands, observed results, screenshots, discovered failures, repairs, and retest outcomes are recorded below. Historical RED results are retained and are followed by repair/retest evidence.

## Engine tests (development)

Command: `node evidence/tests/engine.test.cjs` (extracts and executes the real embedded production engine with Node's VM).

- Initial RED: missing production engine, 0/1 passed (`logs/engine-red.txt`).
- First implementation: 15/16 passed (`logs/engine-first.txt`). Counter reset failed: expected 0, observed 1 after reset following two ticks.
- Root cause: reset initialized clock output to 0 but retained clock source value 1; first settling pass generated an unintended rising edge. Reset now resets clock/button source values before evaluation.
- Retest: 16/16 passed (`logs/engine-green.txt`), including counter reset and same-clock register sampling. Status: **pass**.

## Direct-file desktop workflow — pass

Opened the delivered file directly with a fresh isolated browser session:

```
agent-browser --session dl-sol61 open file:///home/pyro/projects/naked/sol61/15-digital-logic-lab/index.html
agent-browser --session dl-sol61 set viewport 1280 800
agent-browser --session dl-sol61 network route 'https://**' --abort
agent-browser --session dl-sol61 network route 'http://**' --abort
```

The browser opened file:// successfully, with no external assets or cached dependencies. `network requests` shows only the delivered file document. No console messages or uncaught errors. The initial half adder outputs SUM=1, CARRY=0 for A=1, B=0, matching its initial analyzer sample. No horizontal document overflow. Screenshot: `screenshots/01-desktop-initial.png`.

Exact interaction commands and assertions: `tests/desktop-flow.sh`, outputs `logs/desktop-flow.txt` and `logs/desktop-phase2.txt`.

- Clicked B: A=B=1, live SUM=0 and CARRY=1; probes recorded exactly 0 and 1 (`02-half-adder-11.png`).
- Selected and deleted the SUM wire: five wires remain, input/output become Z. Clicked actual Sum logic output Q and SUM input A ports: sixth wire recreated, output resolves 0. Clicked A: SUM=1, CARRY=0 and analyzer agrees. **pass**.
- Keyboard undo twice removes the recreated wire; redo twice restores wire and source change. Duplicate selected gate, undo; Ctrl+A/C/V duplicates six components and six internal wires; undo restores original topology. Deleted gate removes its three connections; undo restores them. **pass**.
- Generated a table with marked A/B and SUM/CARRY: rows 00→00, 01→10, 10→10, 11→01. Live source values remain unchanged. Simplified expressions displayed (`03-truth-table.png`). **pass**.
- Loaded counter. Two manual ticks produce 2, with analyzer COUNT=2 and clock edges in samples. Ran at 4 Hz to tick 8, paused, COUNT=8 and last sample=8. Reset gives tick=0, COUNT=0 (`04-counter-waveforms.png`). **pass**.
- Loaded tiny CPU. Tick 1: ACC=1, PC=1; tick 2: OUTPUT=1; ticks 3–4: ADD then OUTPUT=2. Visible output register and captured OUTPUT=2 agree; no warnings (`05-cpu-execution.png`). **pass**.

Tool adjustment: clicking an SVG body rectangle by selector was rejected by agent-browser because its own gate glyph covers the rectangle center. Used the visible component title as the pointer target, which selects the same component. This was a tool hit-test limitation; no simulated clicks or direct state manipulation were used. Resumed the remaining flow after that command, with output in desktop-phase2.txt. Relative screenshot paths resolved outside the workspace in a preexisting browser daemon, so all subsequent screenshots use absolute paths.

## ISSUE-001 — long waveform name overlaps binary value (fixed)

Status on discovery: **fail** (static visual issue). Reproduced by loading CPU and stepping four ticks. Direct visual inspection of the initial CPU screenshot showed INSTRUCTION and its 8-bit binary value overlapping in the analyzer's label column. The numbered `05-cpu-execution.png` was refreshed during the final desktop flow and now shows the repaired rendering; the original RED image is not retained. Root cause: a fixed 132px origin could not contain both long names and eight binary digits. Repair: increase label-column width and adapt name truncation at narrow sizes while retaining full names in probe management. Retest will include CPU and phone waveform screenshots.

## Settling-limit diagnostic regression — fixed, pass

Added a behavioral regression with a 30-buffer chain and an 8-round propagation budget. RED: 16/17 passed, final diagnostics dropped the limit warning (`logs/limit-red.txt`). Root cause: containment emitted a transient warning, then a second diagnostic refresh cleared its flag. The engine now retains the limit state until a new propagation transaction/reset. GREEN: 17/17 passed (`logs/limit-green.txt`). Unknowns are still contained, with a visible reason.

## Error handling, construction, saves, and exports — pass

Exact commands: `tests/errors-persistence.sh`; full successful output: `logs/errors-persistence-retry.txt`.

- Dragged a NOT by its title using real mouse down/move/up, then connected its output to its own input. Simulator terminates with X, zero pending events, and an unresolved feedback warning (`07-unresolved-feedback.png`). **pass**.
- Added a switch, changed it to 4 bits, dragged it into position, and tried connecting it to the 1-bit NOT. Wire count remains 1 and the incompatible-width message appears (`08-invalid-width.png`). **pass**.
- Added a 4-bit LED, dragged it, connected actual switch/LED ports, and advanced source values 1 then 2. Output matches the source. Attached a probe named BUS OUT; last sample records 2. **pass**.
- Saved as “Bus experiment,” loaded another preset, reopened saved project, then reloaded file://. The three components, two wires, source values, and named probe survive. **pass**.
- Downloaded complete circuit JSON, SVG, PNG, waveform CSV, and VCD through the actual export buttons into `exports/`. Inspected the rendered PNG: correctly positioned components, live bus 0010, wires, and amber X feedback. **pass**.
- Submitted unknown RUN_CODE component JSON: rejected with “Unknown component type” and live circuit unchanged (`09-invalid-import.png`). Uploaded the exported JSON and reopened it, preserving topology and named probe. **pass**.
- Generated compact link, decoded 1,103-character representation, and verified circuit name and two wires. The subsequent real-navigation round trip passes; see Final delivery checks below.
- Console and errors remain empty; network has only local file document loads and the local blob image used for PNG export.

Tool adjustment: agent-browser mouse move accepts integer coordinates; initial fractional coordinates were rejected before input. Rounded the measured title center and repeated successfully. `errors-persistence.txt` preserves the rejected tool command.

## Narrow viewport initial inspection

Changed to 390×844 and fitted the half adder. No document overflow (document width 390). All six primary toolbar controls lie within x=8…382 (`10-mobile-initial.png`). Ports and outputs remain connected. The component titles were too small at the fitted 43% zoom; adaptive text sizing will improve readability before the editing retest.

## ISSUE-002 — keyboard momentary button remains high after Enter (fixed below)

Reproduced on phone layout: Examples → Binary counter → focus “Hold Reset” → press Enter. Observed live rst=1 after key release; assertion fails. Pointer momentary release works. Root cause: keydown supported Enter and Space, but keyup released only Space and relied on the currently focused SVG element. Dynamic rendering can also replace that element while a key is held. Screenshot: `12-keyboard-button-stuck.png`. Repair will track the held keyboard button by component ID and release it on either key's keyup or window blur, and preserve focused SVG controls during redraw.

## Narrow editing and input continuity — pass after repair

Exact commands: `tests/mobile-flow.sh`; outputs: `logs/mobile-flow.txt`, `logs/mobile-phase2.txt`, `logs/mobile-phase3.txt`.

- At 390×844, stepped counter twice. Space key resets it and releases back to rst=0. Real pointer down shows rst=1; pointer up restores 0.
- Resized 390→1280→390: five wires and selected reset component ID survive.
- Opened component drawer, searched “not,” added a gate, edited its label through the mobile inspector with keyboard input, dragged it, and wired Enable output to its actual input. Inverter follows source: enabled=1 → mirror=0; disabled=0 → mirror=1.
- Used visible mobile Undo/Redo controls: source change, wire removal, and wire recreation all work. Deleted the gate with inspector, undid deletion, and restored seven components/six wires.
- Zoomed with controls. Used pan tool and real mouse drag: 40px horizontal and 30px vertical movement matches view offsets exactly. Clicked minimap to navigate and fitted again.
- Opened settings through mobile instrument controls, changed frequency to 2 Hz and accessible blue/amber theme. Ran to tick 4 and paused. COUNT=4, last captured sample=4, all seven components and six wires remain, no document overflow (`13-mobile-edited-counter.png`).
- Engine suite still 17/17 pass after keyboard repair (`logs/engine-keyboard.txt`). Enter and Space release fixed and SVG focus preserved. The Enter regression retest observed rst=0 and focus “Hold Reset.” **pass**.

Harness adjustments (not app failures): wrapped repeated lexical declarations in an IIFE after a Runtime.evaluate name collision; scoped Lab settings selector to the open modal to avoid a hidden header button. Resumed remaining actions after each adjustment. Logs preserve the original rejected commands.

ISSUE-001 retest: long CPU waveform labels no longer overlap values (`06-cpu-waveform-labels-fixed.png`); phone analyzer columns also stay separate (`13-mobile-edited-counter.png`). **pass**.

## Independent final review — findings reproduced before repair

A read-only reviewer audited the embedded production engine and handlers and identified five important issues. Existing engine suite was 17/17. No critical or minor findings. Additional RED evidence:

1. Buffered route of one clock caused a two-register pipeline to capture new R1 data in R2 on the same source edge, contrary to the documented ideal common-edge model. Added real-engine regression; observed R2=7 instead of 0 (`logs/review-engine-red.txt`).
2. Genuine CDP touch input in the agent-browser browser: touch-hold Reset, add a second touch to begin pinch, release both. rst remained 1 (`logs/touch-cancel-red.txt`). The test uses actual `Input.dispatchTouchEvent`, not synthetic DOM events or app state writes.
3. Selected Transport delay, disabled Record, then added a gate and toggled Enable. Captured sample count increased while paused (`logs/review-ui-red.txt`).
4. Selected Input A, started a wire draft from its output, deleted A, then clicked Sum logic input A. A stale origin reference caused an uncaught error, confirmed by browser error collection and the production handler trace (`logs/review-ui-red.txt`).
5. Generated half-adder truth table, left it visible, removed SUM wire. The model result invalidated, but the obsolete table remained visible (`14-stale-truth-red.png`, `logs/review-ui-red.txt`).

Repair pass: retain pre-edge data across the source's full propagation transaction; guard all engine sampling with recording state; centralize momentary and gesture cancellation; clear and validate wire drafts after topology edits; refresh invalidated truth-table view. Each is covered by the recorded failing flow and will be repeated, followed by compact main-workflow regressions.

## Review repairs and final regression — pass

- Real-engine regressions: **19/19**, including buffered common-clock sampling (R1=7, R2=0 on first tick; R2=7 next tick) and Transport recording disabled across reset/ticks/manual sampling (`logs/review-engine-green.txt`). Ideal sequential inputs now use the source-edge transaction's pre-edge values, including buffered routes.
- Repeated paused capture, stale draft deletion, and visible truth invalidation through actual controls. All repaired flows pass (`tests/review-ui-final.sh`, `logs/review-ui-final.txt`). Invalidated truth view shows the regeneration prompt (`15-truth-invalidated-fixed.png`); no new uncaught errors.
- Repeated full desktop workflow in a fresh `dl-sol61-final` browser, including interactive reconnect/toggles, history, copy/paste, deletion, truth rows, counter manual/run/reset, CPU four instructions (`tests/desktop-final.sh`, `logs/desktop-final.txt`). **pass**.
- Repeated full narrow editing workflow after all repairs (`tests/mobile-final.sh`, `logs/mobile-final.txt`). **pass**.
- Genuine touch regression: held reset=1, second touch begins pinch, releasing both gives reset=0 (`logs/touch-cancel-final.txt`). **pass**.
- Genuine touch pinch increases zoom without changing wires or counter state; touch drag of empty canvas moves view by exactly 30×35px; touch component drag changes coordinates, snaps to 20-unit grid, and preserves wires (`tests/touch-input.cjs`, `logs/touch-gestures.txt`, `16-touch-edited.png`). These inputs are CDP dispatches into the real Chromium browser created by agent-browser, with diagnostics read through Runtime.evaluate. No application state writes or synthetic DOM events.
- Downloaded CPU CSV/VCD directly from its captured run. CSV contains 9 samples and rising-edge tuples `(tick, ACC, OUTPUT)` = (1,1,0), (2,1,1), (3,2,1), (4,2,2). VCD includes 8-bit INSTRUCTION, monotonic sample timestamps, and final OUTPUT 0010. **pass**.

Evidence correction: the initial stale-truth screenshot was accidentally overwritten by the retest script. RED evidence is preserved in review-ui-red.txt; the file named `14-stale-truth-red.png` now depicts the repaired prompt. The distinct final screenshot is `15-truth-invalidated-fixed.png`. No RED screenshot is claimed for that issue.

Tool note: agent-browser 0.31.1 retained a historical RED error after `errors --clear`. Started a fresh isolated browser for final regressions; its `errors --json` reports an empty list and console is empty. Browser doctor output is in `logs/browser-doctor.txt`. This historical buffer behavior does not block coverage.

## Large-circuit rendering and invalidation — pass

Imported the author-created fixture `fixtures/large-circuit.json` through the actual file input: 510 components and 500 wires, ten 49-buffer chains. All settled in 50 propagation rounds, 1,000 evaluations, zero pending events (`17-large-overview.png`). Zoomed toward Source 0 and clicked its real switch: output at the end of its 49-buffer path changed 1→0 and CHAIN 0 probe recorded 0. Only 51 components were evaluated for that change, leaving unrelated chains untouched. Live FPS overlay observed 35 at the inspection point (`18-large-edited.png`). No uncaught errors. Exact steps: `tests/large-flow.sh`, initial log `logs/large-flow.txt` and supplemental `logs/wheel-cdp.txt`.

Wheel-tool adjustment: agent-browser's low-level `mouse wheel` dispatched at (0,0), over the header, despite an earlier mouse move. A diagnostic capture listener observed that origin. Used actual Chromium CDP `Input.dispatchMouseEvent` at the measured circuit point instead (`tests/browser-wheel.cjs`). Observed wheel at (254,299), delta −1200, and zoom 0.08165→0.49397. This is real browser input into the same agent-browser browser; no synthetic DOM events or app state writes. Coverage is complete with this explicit supplement.

## ISSUE-003 — Enter on a focused native toolbar button triggers global Run shortcut

RED: focus header Save project, press Enter. No Save dialog opened on the combinational circuit; global shortcut intercepted native button activation. Repair: leave Enter/Space on native buttons to their browser behavior; SVG controls retain custom handling and the canvas retains shortcuts. Retest below.

ISSUE-003 GREEN: Enter on focused header Save opens “Your local projects.” Native Enter/Space behavior restored; SVG momentary and canvas shortcuts are retained. Engine suite unchanged at 19/19.

Truth-table invalidation extension: reproduced a stale mux table after changing unmarked fixed Bus A (only SEL is marked by the preset). The live bus changed 5→6 but table still showed old fixed value. Now fixed-source values are tracked in the result and source changes invalidate it; ordinary changes to enumerated input switches retain their valid exhaustive table. Retest shows the regeneration prompt, with model result null and no stale table element. Property changes also invalidate derived tables.


## Remaining presets, event stepping, and settings — pass

Exact commands are in `tests/remaining-presets.sh`, with successful segments recorded in `logs/remaining-presets-final.txt`, `logs/remaining-presets-phase2.txt`, and `logs/remaining-presets-phase3.txt`.

- Full adder: initial 1+0+1 → SUM=0/CARRY=1; toggle B → 1/1. Generated all eight truth rows and independently checked each sum/carry against the arithmetic total.
- Multiplexer: Select routes Bus B=10, then Bus A=5; live output and probe agree.
- SR latch: release Reset, assert Set → Q=1/Q̅=0; release Set → Q holds 1; assert Reset → Q=0, no pending events.
- Register: first tick captures D=5. Change D to 6 between ticks → Q holds 5; next tick captures 6. Disable Enable, change D to 7, tick → Q holds 6 and probe agrees. Enter on the momentary Reset sets Q=0 and releases Reset to 0.
- ALU: for A=3/B=5, operation 1 gives ADD=8, operation 2 AND=1, operation 3 XOR=6, operation 0 pass B=5.
- RAM: initially 0; enabled write tick stores 9 at address 0. Disable WRITE, change address to 1 → asynchronous read 0; set address back to 0, change write data to 10, tick → stored output stays 9. Reset reinitializes RAM to 0. Memory editor rejects one word, accepts exactly sixteen in-range words, and edited address 0 reads 0xB=11.
- Manual propagation model: source change queues an event and leaves old SUM=1 visible. Individual toolbar event clicks drain the real queue; final SUM=0 and recorded probe=0. Inertial model restores automatic settling.
- Changed wire routing, radix, and dark appearance through labeled controls; binary SUM=1 renders 0x1. Evaluation-order overlay renders numbers, diagnostics show live evaluation order and an empty queue; fan-out is selectable. Restored light appearance, curved wires, binary radix, and no overlay.

Harness adjustments, not application failures: the SVG nodes render on the next animation frame, so load waits for the actual preset node IDs before input. Memory controls are below the inspector's fold: scroll the `.inspector` container, which owns overflow, rather than its content child. A fixed six-event test overstepped the four-event propagation transaction and started a fresh evaluation sweep; changed the harness to click only while the live queue is nonempty. The original rejected commands/assertion are preserved. Resumed the remaining checks and all intended assertions pass. No product change was needed for these adjustments.

## Final delivery checks — pass

Command: `bash evidence/tests/final-delivery.sh`; complete output: `logs/final-delivery.txt`.

- Created a compact link through Export, after changing mux Bus A from 5 to 6. Loaded another preset, navigated to a blank document, then opened the actual generated file URL with its encoded fragment. Restored Multiplexer, five components/four wires, Bus A=6 and ROUTED=6. No network hosting or upload involved. The generated link is `exports/mux-share-link.txt`; it contains a local artifact path and must accompany the HTML file.
- Loaded CPU and ticked four instructions: live OUTPUT=2 and captured OUTPUT=2. Zoomed the camera out into overview, then downloaded actual final SVG and PNG (`exports/final-cpu.svg`, `exports/final-cpu.png`). Visually inspected PNG: all ten components, twenty wires, full labels, bus values, and OUTPUT 0010 are rendered independently of camera zoom. No missing external assets.
- Restored the functioning default half adder. Final 1280×800 screen: SUM=1, CARRY=0, six components/six wires, empty queue, no overflow (`19-final-desktop.png`). At 390×844, toggled B high → SUM=0/CARRY=1 with matching analyzer sample, then toggled back; no overflow (`20-final-mobile.png`).
- Focused native Save toolbar button and pressed Enter: real Save dialog opens, confirming the native keyboard repair after all changes.
- Final browser error list is empty, console is empty. Requests are successful local `file://` documents and one local `blob:` image for PNG. HTTP and HTTPS routes were blocked in the fresh isolated browser throughout testing. Direct-file check is **pass**, not blocked. No temporary HTTP server is needed.
- Final production-engine suite: `node evidence/tests/engine.test.cjs` → **19/19 pass** (`logs/engine-final.txt`). Source dependency audit finds no runtime imports, script sources, external stylesheets/fonts, fetch, XMLHttpRequest, WebSocket, dynamic eval, or executable imported components. The `http://www.w3.org/2000/svg` string is an XML namespace, not a request; `url(#...)` references are internal SVG definitions.

## Coverage and practical limits

| Check | Final status | Evidence |
| --- | --- | --- |
| Direct-file, self-contained/offline runtime | pass | final-delivery.txt, request log, CSP/source audit |
| Real port wiring, switches, bus validation, floating and feedback states | pass | desktop-final.txt, errors-persistence-retry.txt |
| Selection, drag/snap, delete, undo/redo, duplicate, multi-select, copy/paste | pass | desktop-final.txt, mobile-final.txt |
| Counter and CPU manual/run/pause/reset, live waveform agreement | pass | desktop-final.txt, mobile-final.txt, CPU CSV |
| Remaining six curated presets and all nine initial configurations | pass | remaining-presets logs, engine-final.txt |
| Truth enumeration, expressions, live-state preservation, invalidation | pass | desktop-final.txt, remaining-presets logs, review-ui-final.txt |
| Local project save/load, autosave/reload, validated JSON round trip | pass | errors-persistence-retry.txt |
| Compact share navigation, SVG/PNG, CSV/VCD generation | pass | final-delivery.txt, exports/ |
| Desktop/phone, resize preservation, pan/zoom/minimap | pass | desktop-final.txt, mobile-final.txt |
| Genuine touch drag/pinch and canceled momentary input | pass | touch-cancel-final.txt, touch-gestures.txt |
| Hundreds of components, affected-only invalidation | pass | large-flow-final.txt; 510 components, 500 wires, 51 evaluations for edited chain |
| Independent read-only code review, five findings repaired | pass | review-engine-green.txt, review-ui-final.txt, touch-cancel-final.txt |
| VCD opened in a separate waveform-viewer application | not-run | VCD contents and live-sample correspondence were checked; external-tool interoperability was not tested |
| Other browser engines / physical touch devices | not-run | Chromium desktop and genuine CDP touch input were tested |

Remaining design limits: ideal digital/delta propagation, without analog voltage or physical setup/hold timing; unknown/high-impedance is represented for the entire bus, rather than per bit. Truth tables enumerate at most eight input bits (256 rows). Capture retains the latest 2,048 samples. CPU has a four-bit datapath and sixteen instruction words with LDI/ADD/OUT/JMP/HALT. Named projects and autosave are browser-local; portable circuits use JSON or an encoded fragment with a copy of this HTML. No required browser check remains blocked, and no known observed failure remains unfixed.
