# Logic Lab validation log

**Artifact:** `../index.html`, one self-contained file (3,638 lines, 261 KB). It contains no external URLs except the SVG XML namespace string. A CSP meta tag (`default-src 'none'; connect-src 'none'`) forbids network access.

**Browser tool:** `agent-browser` 0.31.1 (Chromium over CDP). I read its `core` and `dogfood` skill docs before use. The app was opened **directly from `file://`**, so no HTTP server was needed. The direct-file check passes.

**Input:** real CDP input events throughout:
- agent-browser `mouse move/down/up`, `press`, `click`, `fill`, `upload`, `download`.
- For wheel and touch, raw `Input.dispatchMouseEvent` / `Input.dispatchTouchEvent` sent over the same browser's CDP socket (`harness/cdp.js`). agent-browser's own `mouse wheel` always fires at viewport (0,0).

Port and component screen coordinates were computed from live app state (`window.LogicLab`) so that drags land on real ports. The helpers are in `harness/ab.sh`.

**Network audit:** `agent-browser network requests` on a fresh profile showed exactly one request, the `file://` document itself.

**Final regression (fresh profile, final build):** 0 page errors, 0 console errors or warnings.

## 1. Engine unit tests (headless Node)
Command: `node evidence/harness/simtest.js`. It extracts the `<script>` from the delivered `index.html` and runs it in a VM.

**Result: PASS 17/17.**
- Half-adder truth table.
- Ring oscillator: contained (3 nets forced to X, no fault), then recovers when enable is off; oscillation flags clear.
- SR latch: X at reset, then set/hold/reset.
- DFF + adder counter: 1…15, 0, 1, 2.
- Tri-state: Z (floating), then driven, then contention (X + flag), then the flag clears.
- RAM: write-through read.
- Width mismatch: net forced to X and flagged.

## 2. Browser checks (1280×800 unless noted)
| # | Check (real input) | Result | Evidence |
|---|---|---|---|
| 1 | Boot from `file://`, default Welcome circuit running, analyzer capturing | PASS | 01, 02 |
| 2 | File ▸ New; drag Switch×2, AND, LED from the palette; three port-to-port wire drags; click switches | PASS: LED 0,0,**1**,0 for (0,0), (1,0), (1,1), (0,1) | 03 |
| 3 | Reload: autosave restores the hand-built circuit including switch state | PASS | — |
| 4 | Select gate → Delete (gate and 3 wires) → Ctrl+Z → Ctrl+Shift+Z → Ctrl+Z | PASS: counts and LED re-settle correctly | — |
| 5 | Marquee selection, Ctrl+D duplicate, undo | PASS: exactly 2 switches selected; duplicated as new ids | 04 |
| 6 | Invalid connection: 1-bit switch → 8-bit Display | PASS: red rubber band while hovering; rejected with an explicit width message; wire count unchanged | 05, 06 |
| 7 | Oscillating loop example: click EN | PASS: 3 nets detected and forced to X (purple), HUD and toast warnings; EN off recovers | 07 |
| 8 | Tiny CPU: Space (pause), R (reset), 12 Tick clicks | PASS: machine state matches the program trace; OUT=1 at tick 8 | 08 |
| 9 | CPU running (speed slider moved with keyboard) | PASS: halts at PC=0xE `HLT`; OUT=233; A=0x79 (377 mod 256); HALT LED lit; measured Hz matches the setting | 09, 10 |
| 10 | Analyzer records the same live signals | PASS: OUT tick samples and sim-time transitions are both `0,1,2,3,5,8,13,21,34,55,89,144,233` | 09 |
| 11 | CSV and VCD export via the analyzer buttons | PASS: files in `exports/`; the CSV OUT column has the same sequence; the VCD has valid headers and scopes | `exports/cpu-waveform.*` |
| 12 | Wheel zoom at cursor (CDP `mouseWheel` at canvas coordinates) | PASS: z 0.855→2.232; component under the cursor stays within 1 px | 12 |
| 13 | Zoom buttons, `F` fit, `+`/`-` keys | PASS | — |
| 14 | Truth table, Full adder (Ctrl+A → Use selection → Generate) | PASS: 8/8 rows; COUT minimised to `B·Cin + A·Cin + A·B`; K-map shown | 13 |
| 15 | Truth table, non-settling row (oscillator) | PASS after fix (see §3.5): `EN=1 → ⟳`, 1 non-settling row | 14 |
| 16 | ALU exhaustive: truth table (1024 rows) checked against an independent reference model | PASS: 0 mismatches in Y, Z and C | — |
| 17 | Named project: Ctrl+S → dialog → save → load another example → Projects ▸ Open | PASS: modified state (Cin=1) restored | 15 |
| 18 | Export JSON → File ▸ New → Import (file input) | PASS: 11 parts, 12 wires, 5 probes restored; circuit computes correctly | `exports/adder-test.logiclab.json` |
| 19 | Malicious import (unknown type `eval`, HTML in name, `__proto__` key, dangling wire) | PASS: rejected with a reason; current circuit untouched; no prototype pollution | 16 |
| 20 | Unreadable file on import | PASS after fix (§3.6): clear toast, no unhandled rejection | — |
| 21 | Share link (File ▸ Copy share link → open URL) | PASS: 901-char deflate+base64url link loads a validated copy | — |
| 22 | SVG and PNG export | PASS: SVG is well-formed (76 paths, 14 texts) and renders identically; PNG at 2× (1176×708) | `exports/adder-test.*`, 17 |
| 23 | Pan tool drag, middle-button pan | PASS: view offset matches the drag exactly; parts not moved | — |
| 24 | Edge-triggered register (CLK button held with the mouse; D changed with the keyboard mid-pulse) | PASS: captures only on the rising edge; falling edge ignored; EN=0 holds | 24 |
| 25 | Master–slave DFF built from two D latches | PASS: master transparent while CLK is low; slave takes value on the rising edge | 24 |
| 26 | Micro-stepping: pause, toggle A, press `E` repeatedly | PASS: evaluate A → `A.out←1`@t121 → evaluate XOR, AND → `XOR.out←1`@t122; SUM changes only on its event; Diagnostics lists dirty components | 25 |
| 27 | Diagnostic overlays (order, queue, domains, fan-out) on the CPU mid-propagation, after `.` edge + 6 steps | PASS: badges and outlines render; the queue panel lists `PC.q←0x1`, `A.q←0x01` | 26 |
| 28 | Memory test: write pass, read-back, corrupt 3 writes | PASS: RAM = `f0 e1 … 0f`; read-back MATCH 16/16; after corruption exactly 3 misses and 3 `ff` words | 27 |
| 29 | Tri-state bus contention and theme cycling (dark / light / high-contrast / colour-blind) | PASS: contention flagged (X, contention colour) in all 4 themes; CSS tokens switch | theme-*.png |
| 30 | Stress example: 603 parts, 561 wires | PASS: 60 FPS at 20 Hz and 200 Hz (measured 202.5 Hz); half-tick settle of ~1000 micro-steps takes 0.16 ms; drag frame time max 16.8 ms | 28 |
| 31 | High-DPI (device scale 2) | PASS: canvas backing store 1600×1018 for 800×509 CSS px; crisp render | 29 |
| 32 | Resize 1280→900 with a selection active | PASS: 11 parts and 12 wires still selected; state kept; canvas resized; no horizontal scroll | 30 |
| 33 | All 13 examples load | PASS: import validation OK; no width conflicts; no unconnected required inputs; SR latch reports its intended loop | preset-*.png |

**Narrow 390×844, real touch events (CDP `dispatchTouchEvent`):**

| # | Check | Result | Evidence |
|---|---|---|---|
| N1 | Layout | PASS: no horizontal scroll; dock collapsed by default; header wraps | 19 |
| N2 | Examples menu by tap | PASS | — |
| N3 | Swipe the palette strip, tap NOT to add, touch-drag to move, touch-drag B.out → NOT.in, tap B | PASS (after fixes §3.8, §3.9): NOT.out 1→0 while SUM follows | 20 |
| N4 | Two-finger pinch (fingers 50→200 px apart) | PASS: zoom ×4.00 | — |
| N5 | Long-press → context menu → Properties → inspector drawer; edit Label | PASS | 21, 22 |
| N6 | Drawer close button; tap outside the drawer closes it | PASS (after fix §3.10) | 22 |

## 3. Bugs found during validation, fixed and retested
1. Toolbar wrapped to 2 rows at 1280 px. Fixed by tightening spacing and hiding the brand text below 1400 px.
2. Fit placed the circuit under the HUD, and the minimap could cover it. Fit is now overlay-aware, and falls back to full size on small stages.
3. The inspector "Value" field went stale after a switch toggle.
4. The *default bit width* setting overrode intrinsic widths: a new Display became 1-bit, which masked the width check (#6). It now applies only to generically 1-bit parts.
5. Truth-table rows settled from an all-X reset never exposed oscillation. Each row now settles a known baseline (inputs 0), then applies its inputs as a stimulus.
6. Import of an unreadable file caused an unhandled promise rejection. It is now caught and reported.
7. An idle clock with no clock components opened empty propagation epochs, which wiped the "last settle" and evaluation-order diagnostics.
8. On touch, palette tiles blocked horizontal swiping of the narrow palette strip (`touch-action:none`). Tiles now use `pan-x`.
9. Tap-to-add placed parts overlapping existing ones. Parts now go to the nearest free spot.
10. The phone inspector drawer covered its own toggle, leaving no way to close it. Added a close button, Esc, and dismissal on any tap outside the drawer.

Improvements added during validation:
- Junction dots at same-net branch points (plain crossings stay unmarked).
- The Display/LED inspector wording is corrected.
- A restored view is re-fitted when most of the circuit would be off-screen.
- The minimap is smaller at widths up to 980 px.

## 4. Known limitations
- The wheel and touch checks used CDP events sent directly, because agent-browser's `mouse wheel` fires at (0,0). Real hardware trackpads and touchscreens were not available.
- The **SR latch race** (pressing S and R together, then releasing) was not exercised by hand. The engine test covers latch set/hold/reset and loop containment.
- No keyboard-only accessibility audit or screen-reader test was run. Keyboard shortcuts were tested (Space/E/./T/S/R/F/H/V/Tab-free flows, Ctrl+Z/Y/D/A/S, Delete, Enter, arrows) except Tab-cycling selection.
- Pause freezes propagation as well as the clock (by design): a toggle while paused shows the new switch position but its effect stays queued until stepped or settled. The hint text explains this.

## 5. Foreign file in this directory
`foreign-not-from-this-run/01-desktop-initial.png` was **not produced by this run and does not show this app**. It is a different "logic lab" UI, written at 2026-09-29 23:44 while this session was paused. The likely cause is another agent-browser session whose relative screenshot path resolved against the shared daemon's working directory. I moved it out of `screenshots/` so it can't be mistaken for evidence; it was not deleted. `index.html` was verified byte-identical (SHA-256) to this run's build output.
