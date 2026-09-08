# Validation — Digital Logic and Tiny-CPU Laboratory

Date: 2026-09-08  
Artifact: `/home/pyro/projects/naked/grok46/15-digital-logic-lab/index.html`  
Driver: `agent-browser` (installed skill; core + dogfood workflows loaded from the CLI)  
Local HTTP: `python3 -m http.server 8766 --bind 127.0.0.1`  
Pages: `http://127.0.0.1:8766/index.html?fresh=1` and `file:///home/pyro/projects/naked/grok46/15-digital-logic-lab/index.html?fresh=1`

Network policy during HTTP checks: only the local document was observed. External HTTPS was not required. Resource list contained the HTML document (and, before a data-URI favicon was added, a local `/favicon.ico` 404). No CDN, font, or script fetches.

## How checks were run

1. Open the app in agent-browser at 1280×800.
2. Snapshot labeled controls (`aria-label` / roles).
3. Pointer: `mouse move/down/up` on canvas coordinates computed from component world position + camera.
4. Keyboard: window `t` for clock tick.
5. Buttons: click snapshot refs for Undo, Redo, Tick, Load, Truth table, Save, Projects, Place AND, Delete, Run, Pause, Zoom, Fit, Inspect, Settings.
6. Live state: `window.LogicLab.snapshot()`, `portValue`, analyzer `samples`.
7. Console: `agent-browser console` / `errors`.
8. Repeat material flows after undo-stack and RAM-reset fixes.

Screenshots live in `evidence/screenshots/`.

## Public checks

| Check | Result | Evidence |
|---|---|---|
| Switch → gate → LED, real ports, toggle, correct output | **pass** | Default half adder A=1,B=1 → SUM=0 CARRY=1. Canvas click on switch A at (455,301) → A=0,B=1, SUM=1, CARRY=0. Screenshot `02-after-click-switchA.png`. |
| Load clocked counter; manual ticks; probes match | **pass** | Load Binary counter via preset dropdown + Load. Tick×3 via “Step one clock tick”. `q=[1,1,0,0]` = 0x3. Analyzer samples CNT 0x0,0x1,0x2,0x3. `04-counter-3ticks.png`. |
| Run / pause clock | **pass** | Run ~1.2 s at 4 Hz, Pause. tick 0→4, CNT 0x4. `11-counter-running.png`. |
| Edge register | **pass** | Preset `reg`, one tick, Q=0xA (const D=10). |
| Tiny 4-bit CPU; ticks; probes | **pass** | Load Tiny 4-bit CPU. Program `LDI 0 / OUT / INC / JMP 1`. After 5 UI ticks: PC=0x2, A=0x1, OUT=0x1, IR=0xA0 (INC). Analyzer PC/A/OUT/CLK match live ports. `05-cpu-loaded.png`, `06-cpu-after-5-ticks.png`. Keyboard `t` advanced tick 5→6. |
| Waveform from live simulation | **pass** | Probe values equal `portValue` at each recorded tick for counter and CPU. |
| Undo / redo | **pass** | After canvas toggle, labeled Undo restored A=1/SUM=0; Redo restored A=0/SUM=1. Same via `LogicLab.undo/redo` after snapshot-after-edit fix. |
| Selection / deletion | **pass** | Place AND from palette + canvas click (`c49`). Delete selection removed it (27 comps). Undo of delete also verified in eval. |
| Invalid connection | **pass** | Two outputs: `Cannot join two outputs`, wire count unchanged. ALU Y (4) to 1-bit LED: `Width mismatch 4 vs 1`. |
| Oscillating / unresolved loop | **pass** | NOT output wired to input. Settles at X with warning `Combinational cycle / unresolved X`, `osc=['n1']`. `10-not-loop.png`. |
| Truth table for combinational subcircuit | **pass** | Generate + Enumerate on half adder. Rows 00/01/10/11 → SUM/CARRY 0,0 / 1,0 / 1,0 / 0,1. Simplified `SUM = A'B + AB'`, `CARRY = AB`. `03-truth-table.png`. Non-settling rows would be marked OSC (not-run on a 4-row settling circuit). |
| Save / load | **pass** | JSON roundtrip of memory circuit (8 comps, type ram). Projects modal listed saved `cpu`. `09-projects-modal.png`. Autosave in localStorage. |
| Pan / zoom | **pass** | Zoom in k 1.03→1.37, zoom out 1.19, Fit restored 1.03. CPU wires 40 / comps 27 preserved. |
| Narrow viewport 390×844 | **pass** | Layout usable: palette, wrapped toolbar, canvas, analyzer. Tick 4→5 (CNT 4→5). Inspect overlay opened. Wires 9 not lost. `12-narrow-390x844.png`, `13-narrow-tick-inspect.png`. |
| Direct `file://` | **pass** | Opened `file:///.../index.html?fresh=1`. Half adder and CPU (OUT=1 at tick 5) matched HTTP. `performance.getEntriesByType('resource')` empty. Network: only the file document. `14-file-protocol-cpu.png`. |
| No external runtime deps | **pass** | HTTP requests: local `index.html` only (plus earlier favicon 404, then inline `data:,` icon). `file://` had no extra fetches. Source has no `http(s)` URLs except SVG xmlns. |
| Console / uncaught errors | **pass** | `agent-browser console` and `errors` empty on HTTP and file sessions after load and interaction. |
| Import does not execute code | **pass** | Unknown type `hack` rejected. `__proto__` reviver dropped; `polluted=false`. |

## Other required behaviors exercised

- Place AND from labeled palette + pointer down/up on canvas: **pass**
- Settings modal (propagation model, theme, color-blind): **pass** opened `15-settings.png`
- Fit / zoom buttons: **pass**
- Keyboard tick: **pass**
- Memory persist (write addr=data, WE=0, reset addr, read-back 1 then 2): **pass**
- Full adder 1+1+0 → S=0 Cout=1: **pass**
- MUX sel 0→Y=d0=0, sel 1→Y=d1=1: **pass**
- SR NOR latch reset Q=0 Qn=1, hold, set Q=1 Qn=0: **pass**
- ALU 5+3 → 8: **pass**

Desktop 1280×800 default circuit: `01-desktop-halfadder.png` (A=B=1, SUM dark, CARRY lit).

## Fixes during validation

1. History snapshots were taken *before* edits, so redo restored the pre-edit state. Snapshots now commit after mutations. Retest: undo A 0→1, redo A 1→0 with SUM following. **pass**
2. Memory example had no reset button, so the first RAM readback test used an unwritten address. Wired `rst` and retested read of mem[1]=1, mem[2]=2. **pass**
3. Adder floating Cin treated as X broke PC+1 on the CPU. Cin Z now defaults to 0. CPU program then executed correctly.

## Not-run / limitations

| Item | Status | Notes |
|---|---|---|
| Real capacitive touch / pinch on a phone | **not-run** | Pointer and two-pointer pinch exist; no physical touch device. Narrow viewport used mouse. |
| Audio | **not-run** | App has no audio. |
| Unit-delay 0/1 ring oscillator | **not-run** | Zero-delay NOT loop is X + cycle warning (honest 4-value result). Inertial 0/1 toggling was not separately demoed in the UI. |
| CSV/VCD/SVG/PNG download in the browser | **not-run** | Handlers exist (`Export CSV/VCD/SVG/PNG`); agent-browser did not assert a downloaded file. JSON serialize/load was tested. |
| Share URL roundtrip | **not-run** | Share writes `#c=` JSON; not re-opened in a second tab. |
| High-DPI bitmap measurement | **not-run** as a numeric DPR audit | `devicePixelRatio` backing store is implemented. |
| Textbook gray-code K-map axes | limitation | K-map-like grid is binary order, not labeled gray-code coordinates. Boolean simplification is shown. |
| Narrow toolbar density | limitation | 390×844 wraps many instrument buttons; primary Load/Tick/palette/canvas still work. Inspector is an overlay. |
| Multi-bit waveform shape | limitation | Analyzer draws a single high/low trace per probe, not per bit. Values in the probe list are exact. |
| PNG export extent | limitation | PNG is the visible canvas, not a full-world offscreen render. SVG exports component boxes + polylines. |
| CPU ISA | limitation | Simplified 4-bit single-cycle NIBBLE-1 (clock, PC, ROM, PLA, A, ALU, RAM, OUT). Visible state is from the wired simulation. |

## Remaining unresolved failures

None of the public checks above failed after the history and RAM-reset retests.

## Commands (representative)

```bash
python3 -m http.server 8766 --bind 127.0.0.1 --directory /home/pyro/projects/naked/grok46/15-digital-logic-lab
agent-browser --session logiclab open "http://127.0.0.1:8766/index.html?fresh=1"
agent-browser --session logiclab set viewport 1280 800
agent-browser --session logiclab wait --fn "window.LogicLab && window.LogicLab.ready === true"
agent-browser --session logiclab snapshot -i
agent-browser --session logiclab mouse move 455 301 && agent-browser --session logiclab mouse down left && agent-browser --session logiclab mouse up left
agent-browser --session logiclab set viewport 390 844
agent-browser --session logiclab-file open "file:///home/pyro/projects/naked/grok46/15-digital-logic-lab/index.html?fresh=1"
```
