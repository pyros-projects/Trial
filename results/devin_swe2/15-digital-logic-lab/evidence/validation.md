# LogicLab — Validation Report

App: `index.html` (single self-contained file, no external deps — verified via
`agent-browser network requests`: only `file:///...index.html` requests).
Browser tool: `agent-browser` 0.31.1 (Chrome CDP, real pointer/mouse/keyboard events).
App exposes `window.LAB` diagnostic API used to assert on live sim state; all UI
interactions were driven through real browser events (mouse down/up/move, clicks
on labeled controls, keyboard shortcuts, a11y refs).

## Checks

| # | Check | Method | Result |
|---|-------|--------|--------|
| 1 | Boot + default circuit | `open file://index.html`, inspect comps | PASS — loads 2×Switch→AND→LED; LED=0 |
| 2 | Switch→gate→output propagation | real mouse click on switch bodies (canvas coords) | PASS — A=1,B=1 → LED=1; A only → 0 |
| 3 | Component placement | palette item click → canvas click | PASS — Switch/AND/NOT placed at click point |
| 4 | Wire via port drag | mouse down on out-pin, up on in-pin | PASS — wire created, "wired Q → A" toast |
| 5 | Width validation | 4-bit switch dragged to 1-bit gate input | PASS — rejected "✗ width mismatch 4b ↔ 1b", no wire |
| 6 | Reject wired-input reuse | drag to already-wired input | PASS (multi-driver now allowed as real bus/contention — see #14; single-driver replacement path verified) |
| 7 | Undo/redo | toolbar buttons after toggle | PASS — switch val 1→0→1, histI tracks |
| 8 | Marquee multi-select | drag on empty canvas | PASS — 6 items selected (4 comps + 2 wires) |
| 9 | Delete selection | Delete key | PASS — 4→1 comps, 3→0 wires; undo restores |
| 10 | Duplicate / copy-paste | Ctrl+D, Ctrl+C/V | PASS — 5 comps after dup; whole-circuit paste 10→20 comps, 12→24 wires incl. internal wires |
| 11 | Oscillation containment | NOT gate Q→A self-loop | PASS — `sim.osc=true`, pins show `osc`, HUD "OSC LOOP"; app keeps running |
| 12 | Contention | two switch drivers on one LED net | PASS — `conflict` flag, net=`x` (red) |
| 13 | Tri-state bus | 2 tri-state buffers on one net | PASS — enabled driver wins, other Z |
| 14 | SR latch bistable | preset + S=1 then S=0 | PASS — Q=1/QN=0 holds after release; unresolved start flagged |
| 15 | Edge-triggered register | momentary CLK button press | PASS — pressed=1, Q←D=5, display=5, released=0 |
| 16 | Counter | preset + Run | PASS — q=3 after 3 ticks |
| 17 | Tiny CPU | preset + manual ticks + Run | PASS — PC 0→1→2…→5→2 (JMP loop); A counts 0,1,2,4; RAM[15] tracks; instr probe shows 0x4F/0x5F/0x62 fetch sequence; edges=5/tick; HALT gating logic wired |
| 18 | Manual step event/tick | `» Event`, `» Tick` | PASS — t advances per event, PC+1 per tick exactly |
| 19 | Run/pause/reset | toolbar | PASS — 6 ticks in 3s @2Hz; reset → t=0,q=0 |
| 20 | Probes + analyzer | ctx-menu "Add probe here" + preset probes | PASS — 5 probes; waveforms show clk toggles, PC/A bus values |
| 21 | CSV / VCD export | menu + payload capture | PASS — CSV `t,clk,pc,A,instr,clkg` rows correct; VCD header+vars+time dump |
| 22 | Waveform zoom/inspect | zoom buttons, fit, click-to-inspect | PASS |
| 23 | Truth table | mark A,B inputs + OUT, Σ Truth | PASS — 4-row AND table; QM output `OUT = Σm(3) → A·B` |
| 24 | Save/load project | File→Save/load modal | PASS — wire deleted then restored on load; project list shows |
| 25 | JSON export/import | export download + validateCircuit+restore | PASS — 28 comps/59 wires round-trip; malicious `type:"evil<script>"` rejected |
| 26 | Share code | base64 snapshot encode/decode/restore | PASS — 9152 chars round-trip |
| 27 | PNG/SVG export | payload capture | PASS — PNG blob 578KB; SVG 40KB valid |
| 28 | Pan/zoom | Pan tool drag + ＋/－/⌂ buttons | PASS — view.x/y/z update; fit frames CPU |
| 29 | Narrow viewport | `set viewport 390 844` | PASS — palette→horizontal strip, toolbar wraps, canvas editable, Tick works, fit works |
| 30 | Resize continuity | viewport 1280↔390 cycles | PASS — comps/wires/selection preserved, redraw clean |
| 31 | HUD overlay | inspect #hud | PASS — fps 60, counts, events, tick, iters, sel value, tool, pause, warnings |
| 32 | Themes | settings cvd/light/dark | PASS — applied (screenshot 09_cvd.png) |
| 33 | Delay model | unit-delay mode | PASS — probe samples at fractional t per settle iteration |
| 34 | Diagnostics tab | inspect panel | PASS — sim stats, eval order, overlay toggles, loop list |
| 35 | Keyboard shortcuts | Ctrl+D, Delete, Ctrl+A (via press) | PASS |
| 36 | localStorage persistence | reload page | PASS — CPU circuit + settings restored |
| 37 | RAM write | memory-test preset | PASS — write at counter addr (verified also via CPU STA) |

## Blocked / not fully covered

- `agent-browser mouse wheel` does not deliver a wheel event over the canvas
  (verified via listener probe). Zoom verified via toolbar ＋/－/⌂ buttons; the
  wheel handler + pinch-zoom code paths are implemented but untested by real
  input. Marked BLOCKED (tool limitation), not a failure of the feature.
- OS file-picker for "Import JSON" is browser plumbing; the parse →
  `validateCircuit` → `restore` path was exercised with real File/JSON payloads
  and rejects bad input.
- Multi-touch pinch implemented (pointer events) but CDP single-pointer only.

## Bugs found & fixed during validation

1. `gateLay` signature bug — comp-width 58 passed as pin bit-width → fixed (pins were 58-bit).
2. `drvSet` pre-wrote drvVal, killing the diff that resolves clock nets → no clock edges ever fired (CPU dead). Fixed: mark dirty only.
3. `s2w` typo divided y by `view.y` instead of `view.z` → all clicks missed. Fixed.
4. Snapshots omitted `state` → undo/redo lost switch/counter values. Fixed: state serialized; simReset(keepState) on restore.
5. Feedback loops converged on `x` (absorbing) so oscillation never surfaced. Fixed: `x` nets inside comp-graph cycles flagged `osc`.
6. Context-menu clicks swallowed by document pointerdown dismiss. Fixed.
7. Truth-table cell rendered `[object Object]` (nested value). Fixed.
8. Preset ids had trailing `-`; `loadPreset` silently no-oped. Fixed.
9. Analyzer didn't follow live data / fit button didn't scale. Fixed (200ms redraw + fit-to-data).
10. Single-wire-per-input prevented tri-state buses & contention. Fixed: multiple wires per net allowed, resolved by driver-resolution (Z ignored, equal agrees, else conflict-x).

## Evidence artifacts

- `01_boot.png` fresh load welcome circuit
- `02_and_on.png` AND=1 with both switches on
- `03_cpu.png` / `11_cpu_v2.png` / `12_cpu_fit.png` CPU executing
- `04_osc.png` oscillating self-loop flagged
- `05_truthtable.png` truth table modal
- `06_analyzer.png` waveform view
- `07_narrow.png` / `08_narrow_fit.png` 390×844 layout
- `09_cvd.png` color-blind-safe theme
- `10_diag.png` diagnostics tab
- `13_fresh.png` clean-profile boot

## Remaining limitations

- Auto-routed wires on the CPU preset are legible but tangled (single-file scope);
  datapath is readable at zoom ≥0.8 and every net is inspectable.
- Bus-level (not per-bit) X/Z propagation — documented simplification.
- Analyzer waveform click-inspect shows value row in status line, not a cursor marker.
