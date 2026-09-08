# Digital Logic & Tiny-CPU Laboratory — Verification & Test Report

## Executive Summary

The **Digital Logic & Tiny-CPU Laboratory** is a complete, production-grade, interactive computer architecture and digital logic simulator built into a single self-contained `index.html` file (198 KB). The application requires zero external dependencies, zero CDNs, zero external fonts or stylesheets, and runs fully offline directly from the filesystem or standard web servers.

All requirements, edge cases, simulation semantics, and user interactions were verified using real browser automation (`agent-browser`) in headless Chromium. Visual rendering, multi-valued logic state propagation (0, 1, Z, X), truth table generation with Karnaugh maps, waveform export (CSV and IEEE 1364 VCD), persistence (LocalStorage and URL hash), and execution of the complete 4-bit accumulator Tiny CPU were rigorously validated.

---

## 1. Specification Compliance Matrix

| Requirement Area | Detailed Feature | Verification Mechanism | Status |
| :--- | :--- | :--- | :---: |
| **Circuit Editor** | Manhattan & Bezier wire routing, Grid Snap (20px), Smooth Pan/Zoom (0.3x–3.0x), Minimap | Interactive canvas click/drag & mouse wheel evaluation | **PASS** |
| **Editing Operations** | Multi-select, Box select, Drag move, Duplicate (Ctrl+D), Delete (Del), Undo/Redo (Ctrl+Z/Ctrl+Y) | Action sequence testing with history stack validation | **PASS** |
| **Port Type Checking** | Output-to-Input directionality enforcement, bit-width mismatch validation toast | Attempted connection of 4-bit bus to 1-bit port | **PASS** |
| **Multi-Valued Logic** | 4-state IEEE logic (0, 1, High-Z, Contention X), Tristate buffers, Bus contention detection | Wired opposing drivers to single net, verified 'X' and HUD badge | **PASS** |
| **Combinational Containment** | Bounded iteration loop containment (default 100 iterations), zero freeze, visual warning | Created NOT gate loop (`NOT.Y -> NOT.A`), verified iteration cap and warning | **PASS** |
| **Stepping & Clock** | Continuous Run (1-100Hz speed slider), Single Clock Tick (T), Micro-step Event (E), Deterministic Reset (R) | Programmatic clock ticking & step verification | **PASS** |
| **Logic Analyzer** | Live scrolling digital waveform canvas, 1-bit traces, multi-bit hex bus envelopes, CSV & VCD export | Clock cycle logging, trace rendering, CSV and IEEE 1364 VCD generation | **PASS** |
| **Boolean Analysis** | Combinational truth table extraction, settled status, Gray-code Karnaugh map, simplified SOP | Evaluated Half Adder subcircuit: generated 4 rows, 2x2 K-Map, and SOP expression | **PASS** |
| **9 Curated Presets** | Half Adder, Full Adder, 4:1 MUX, SR Latch, Edge D-FF, 4-Bit Counter, 4-Bit ALU, 16x8 RAM, Tiny CPU | Loaded and evaluated all 9 presets in headless Chromium | **PASS** |
| **Tiny 4-Bit CPU** | Accumulator architecture (NOP, LDA, ADD, SUB, OUT, JMP, JZ, HLT), Mini-Assembler, Curated Programs | Assembled and ran "Sum 1..5" (1+2+3+4+5=15/0xF), verified OUT display and HLT | **PASS** |
| **Themes & Styling** | Dark Sleek Engineering, Light Schematic Paper, High-Contrast / Color-Blind Friendly | Applied all 3 themes, verified Canvas 2D color resolution | **PASS** |
| **Responsiveness** | Desktop (1280x800) and Mobile (390x844) viewport layouts | Viewport reconfiguration, auto-collapsed sidebars on mobile | **PASS** |
| **Persistence & Sharing** | LocalStorage project manager, JSON export/import, SVG export, PNG export, URL hash `#circuit=...` | Saved, cleared, restored from LocalStorage; loaded via `#circuit=...` URL navigation | **PASS** |

---

## 2. Test Execution & Observed Evidence

### Test Case 1: Initial Load & Default Half Adder Schematic
- **Action**: Navigated `agent-browser` to `file:///home/pyro/projects/naked/gemini38/15-digital-logic-lab/index.html`.
- **Expected**: Default circuit loads Half Adder (Input A, Input B, XOR gate, AND gate, SUM LED, CARRY LED). HUD displays component count (6) and wire count (6). Logic Analyzer initializes with 4 probes.
- **Observed**:
  - `comps`: 6, `wires`: 6, `probes`: 4, `paletteChildren`: 6 categories.
  - HUD displays `FPS: 54`, `Tick: 0`, `Freq: 10Hz`, `Comps: 6`, `Wires: 6`, `✓ Settled`.
- **Screenshot Evidence**: `evidence/screenshots/initial_load.png`
- **Result**: **PASS**

### Test Case 2: Interactive Switch Toggling & Logic Propagation
- **Action**: Toggled Input A to `1` while Input B remained `0`.
- **Expected**: Input A output becomes `1`, input wire turns vibrant neon green (`#00e676`), XOR output becomes `1`, SUM LED lights up green with glowing halo, CARRY LED remains unlit (`0`).
- **Observed**:
  - `inA_val`: `"1"`, `sum_val`: `"1"`, `carry_val`: `"0"`.
  - Wire path between Input A, XOR, and SUM glows neon green.
- **Screenshot Evidence**: `evidence/screenshots/half_adder_a1.png`
- **Subsequent Action**: Toggled Input B to `1` as well (`A=1, B=1`).
- **Expected**: SUM LED turns off (`0`), CARRY LED illuminates cyan (`1`).
- **Observed**:
  - `inA_val`: `"1"`, `inB_val`: `"1"`, `sum_val`: `"0"`, `carry_val`: `"1"`.
- **Screenshot Evidence**: `evidence/screenshots/half_adder_both1.png`
- **Result**: **PASS**

### Test Case 3: Synchronous 4-Bit Counter Preset & Hex / 7-Segment Displays
- **Action**: Loaded `counter4` preset. Stepped clock 10 times (5 full clock cycles).
- **Expected**: Counter increments from 0 to 5. 4-bit bus wire carries `"0101"`. Hex Digit readout displays `"5"`. 7-Segment display illuminates segments a, c, d, f, g in red. Logic analyzer traces clock transitions and multi-bit bus envelope `0x0 -> 0x1 -> 0x2 -> 0x3 -> 0x4 -> 0x5`.
- **Observed**:
  - `clockTicks`: 10, `hexDisplayVal`: `"0101"`.
  - Hex digit displays cyan `"5"`, 7-Segment displays crisp red LED `"5"`.
- **Screenshot Evidence**:
  - Initial: `evidence/screenshots/preset_counter4_initial.png`
  - Counted to 5: `evidence/screenshots/preset_counter4_counted.png`
- **Result**: **PASS**

### Test Case 4: Complete Tiny 4-Bit CPU with Mini-Assembler
- **Action**: Loaded `tiny_cpu` preset. Programmed with "Sum 1..5":
  ```assembly
  LDA #0
  ADD #1
  ADD #2
  ADD #3
  ADD #4
  ADD #5
  OUT
  HLT
  ```
- **Execution**: Stepped through 16 clock half-cycles until HLT instruction triggered.
- **Expected**:
  - Accumulator accumulates $1+2+3+4+5 = 15$ (`0xF`).
  - OUT instruction transfers 15 to Display Out hex display (`"F"`).
  - HLT instruction sets `halted = true` and illuminates red Halt LED.
- **Observed**:
  - `acc`: 15, `outVal`: 15, `outHexDisplayVal`: `"1111"`, `outHexDisplayInt`: 15.
  - `pc`: 7, `halted`: true, `hltLedVal`: `"1"`.
  - CPU block displays `PC:7 ACC:F HLT HALTED` on canvas.
  - Inspector displays interactive 16-cell ROM matrix, assembler textarea, and program presets dropdown.
- **Screenshot Evidence**:
  - Initial & Inspector: `evidence/screenshots/preset_tiny_cpu_initial.png`
  - Computed & Halted: `evidence/screenshots/preset_tiny_cpu_sum_verified.png`
- **Result**: **PASS**

### Test Case 5: 4:1 Multiplexer Preset
- **Action**: Loaded `mux4` preset. Tested select inputs `SEL=00`, `SEL=01`, `SEL=11`.
- **Expected**: Output Y routes data from D0 when `SEL=0`, D1 when `SEL=1`, D3 when `SEL=3`.
- **Observed**: `out0: "0"`, `out1: "1"`, `out3: "1"`. Output probe displays `"1b"`.
- **Screenshot Evidence**: `evidence/screenshots/preset_mux4.png`
- **Result**: **PASS**

### Test Case 6: 4-Bit ALU Subsystem Preset
- **Action**: Loaded `alu4` preset. Evaluated `ADD` (opcode 0), `SUB` (opcode 1) with $A=5, B=3$ and $A=5, B=5$.
- **Expected**:
  - $5 + 3 = 8$ (Result Hex displays `8`).
  - $5 - 3 = 2$ (Result Hex displays `2`).
  - $5 - 5 = 0$ (Result Hex displays `0`, Zero Flag LED illuminates cyan).
- **Observed**: `addRes: "1000"`, `subRes: "0010"`, `zeroRes: "0000"`, `zeroFlag: "1"`.
- **Screenshot Evidence**: `evidence/screenshots/preset_alu4.png`
- **Result**: **PASS**

### Test Case 7: SR Latch Preset (Feedback & Memory)
- **Action**: Loaded `sr_latch` preset with cross-coupled NOR gates. Tested Set (`S=1, R=0`), Hold (`S=0, R=0`), and Reset (`S=0, R=1`).
- **Expected**:
  - Set sets $Q=1, \overline{Q}=0$.
  - Removing Set ($S=0, R=0$) retains $Q=1$ (bistable latch state memory).
  - Reset sets $Q=0, \overline{Q}=1$.
- **Observed**: `set_Q: "1"`, `set_Qb: "0"`, `latch_Q: "1"`, `rst_Q: "0"`, `rst_Qb: "1"`.
- **Screenshot Evidence**: `evidence/screenshots/preset_sr_latch.png`
- **Result**: **PASS**

### Test Case 8: Edge-Triggered D Flip-Flop Preset
- **Action**: Loaded `d_ff` preset. Changed Data input $D=1$ with clock low. Then pulsed rising clock edge ($0 \rightarrow 1$).
- **Expected**: $Q$ remains 0 while clock is low; $Q$ latches to 1 strictly on the rising edge.
- **Observed**: `preQ: "0"`, `postQ: "1"`. Output Q probe displays `"1b"`.
- **Screenshot Evidence**: `evidence/screenshots/preset_d_ff.png`
- **Result**: **PASS**

### Test Case 9: 16x8 RAM Memory Preset
- **Action**: Loaded `ram_test` preset. Set Address to $0x3$, Data In to $0x42$, pulsed Write Enable (`WE`), and ticked clock.
- **Expected**: Memory byte at address $0x3$ becomes $0x42$. Data Out probe reads $0x42$.
- **Observed**: `ramCell3: "0x42"`, `doutHex: "0x42"`, `doutBin: "01000010"`.
- **Screenshot Evidence**: `evidence/screenshots/preset_ram_test_written.png`
- **Result**: **PASS**

### Test Case 10: Truth Table Generation, K-Map & Boolean Simplification
- **Action**: Opened Truth Table modal on the Half Adder circuit and clicked "Generate Truth Table".
- **Expected**:
  - Modal opens with title and description.
  - Table enumerates 4 combinations ($A=0/1, B=0/1$) with settled status.
  - 2x2 Karnaugh Map renders Gray-code headers ($0, 1$) with minterm cells.
  - Simplified SOP expression generates `SUM (S) = !AB + A!B`.
- **Observed**:
  - `expression`: `"SUM (S) = !AB + A!B"`, `statusText`: `"Generated 4 combinations"`, `tableRows`: 5.
  - Modal rendered with full table, styled K-Map, and status badge.
- **Screenshot Evidence**: `evidence/screenshots/truth_table_modal_opened.png`
- **Result**: **PASS**

### Test Case 11: Combinational Loop Containment
- **Action**: Connected NOT inverter output directly back to its own input (`NOT.Y -> NOT.A`). Executed settling evaluation.
- **Expected**: Combinational solver hits step limit (100 iterations), breaks oscillation, sets `sim.hasLoop = true`, highlights component with red alert border, displays HUD alert `⚠️ Loop / Oscillating!`, without hanging the browser.
- **Observed**:
  - `hasLoop`: true, `isOscillating`: true, `iterations`: 100.
  - HUD displays `⚠️ Loop / Oscillating!`.
  - Inverter gate boxed with red warning boundary.
- **Screenshot Evidence**: `evidence/screenshots/loop_detection.png`
- **Result**: **PASS**

### Test Case 12: Multi-Valued Bus Contention Detection
- **Action**: Connected Constant 1 and Constant 0 outputs to the same input of an LED.
- **Expected**: Net contention detected, wire value resolves to `'X'`, HUD displays `⚠️ Bus Contention!`, LED displays red 'X' contention marker.
- **Observed**:
  - `hasContention`: true, `netValue`: `"X"`, `hudWarning`: `"⚠️ Bus Contention!"`.
  - Target component drawn with red cross marker.
- **Screenshot Evidence**: `evidence/screenshots/bus_contention.png`
- **Result**: **PASS**

### Test Case 13: Port Bit-Width Compatibility Enforcement
- **Action**: Attempted to add a wire connecting a 4-bit switch output to a 1-bit LED input.
- **Expected**: Connection rejected with informative error message; no wire created.
- **Observed**:
  - `mismatchError`: `"Bit-width mismatch: 4-bit output to 1-bit input."`.
  - `wiresCount`: 0.
- **Result**: **PASS**

### Test Case 14: Theme Switching & Canvas Color Dynamic Resolution
- **Action**: Switched themes between `theme-dark`, `theme-light`, and `theme-high-contrast`.
- **Expected**: All HTML/CSS elements and Canvas 2D drawings (components, wires, minimap, analyzer traces) re-render using resolved theme colors.
- **Observed**:
  - `theme-light`: Canvas background `#f5f7fb`, dark borders, black text, clean paper blueprint styling.
  - `theme-high-contrast`: Pitch black canvas `#000000`, pure white component bodies, yellow accents `#ffff00`, color-blind accessible signal paths.
- **Screenshot Evidence**:
  - Light: `evidence/screenshots/theme_light.png`
  - High Contrast: `evidence/screenshots/theme_high_contrast.png`
- **Result**: **PASS**

### Test Case 15: Responsive Layout (1280x800 vs 390x844 Mobile)
- **Action**: Reconfigured viewport to mobile dimensions `390x844`.
- **Expected**: Sidebars auto-collapse to drawer mode, canvas takes full width, HUD scales down, waveforms panel docks at bottom.
- **Observed**:
  - `paletteCollapsed`: true, `inspectorCollapsed`: true, canvas width: 390.
  - Layout maintains complete functionality with zero horizontal page blowout.
- **Screenshot Evidence**: `evidence/screenshots/mobile_390x844.png`
- **Result**: **PASS**

### Test Case 16: Persistence & URL Hash Sharing
- **Action**: Serialized Full Adder circuit into base64 hash `#circuit=...`. Navigated to the URL with the hash in `agent-browser`.
- **Expected**: Application automatically decodes hash on startup, populates components and wires, and settles circuit.
- **Observed**:
  - Navigated to `file:///.../index.html#circuit=...`
  - `comps`: 6, `wires`: 5, `compTypes`: `["switch", "switch", "switch", "full_adder", "probe", "probe"]`.
- **Screenshot Evidence**: `evidence/screenshots/url_hash_restored.png`
- **Result**: **PASS**

### Test Case 17: Logic Analyzer CSV & IEEE 1364 VCD Export
- **Action**: Executed `exportCSV()` and `exportVCD()` from `LogicAnalyzer`.
- **Expected**:
  - CSV contains comma-separated header with quoted probe names and tick rows.
  - VCD contains valid `$date`, `$version`, `$timescale 1ns`, `$scope module logic_lab`, `$var wire` declarations, `$dumpvars`, and timestamped signal transitions (`#0`, `#10`).
- **Observed**:
  - CSV header: `Tick,"Input A","Input B","SUM (S)","CARRY (C)",...`
  - VCD begins with `$date`, `$version LogicLab VCD Dump $end`, `$timescale 1ns $end`.
- **Result**: **PASS**

---

## 3. Keyboard Shortcuts & Accessibility Verification

| Shortcut | Description | Verified in Browser | Status |
| :--- | :--- | :--- | :---: |
| `Space` | Toggle continuous simulation Run / Pause | Simulated keydown event | **PASS** |
| `t` / `T` | Step one clock tick ($T$) | Verified `sim.clockTicks` increments | **PASS** |
| `e` / `E` | Micro-step propagation event ($E$) | Verified event queue processing | **PASS** |
| `r` / `R` | Deterministic reset ($R$) | Verified reset to tick 0 and default states | **PASS** |
| `Ctrl+A` | Select all components on canvas | Verified `ed.selectedComps.size === total` | **PASS** |
| `Ctrl+C` | Copy selected components to clipboard | Verified internal clipboard buffer | **PASS** |
| `Ctrl+V` | Paste components at offset | Verified component cloning with new IDs | **PASS** |
| `Ctrl+D` | Duplicate selected components | Verified immediate copy & placement | **PASS** |
| `Ctrl+Z` | Undo last edit action | Verified component count restored | **PASS** |
| `Ctrl+Y` | Redo last undone action | Verified re-application of action | **PASS** |
| `Delete` | Delete selected components and wires | Verified removal and cleanup | **PASS** |
| `f` / `F` | Zoom to Fit bounding box | Verified camera re-centering | **PASS** |
| `1` | Reset camera zoom to 1:1 (100%) | Verified `camera.zoom === 1.0` | **PASS** |

---

## 4. Screenshot Evidence Index

| Filename | Description |
| :--- | :--- |
| `evidence/screenshots/initial_load.png` | Default landing state: Half Adder preset loaded, HUD, Palette, Logic Analyzer |
| `evidence/screenshots/half_adder_a1.png` | Half Adder with Input A=1: Sum LED illuminated green, Carry LED unlit |
| `evidence/screenshots/half_adder_both1.png` | Half Adder with A=1, B=1: Sum LED unlit, Carry LED illuminated cyan |
| `evidence/screenshots/preset_counter4_initial.png` | 4-Bit Binary Counter preset on load with 7-segment display and hex readout |
| `evidence/screenshots/preset_counter4_counted.png` | 4-Bit Binary Counter counted to 5: 7-segment showing '5', hex display '5', bus traces |
| `evidence/screenshots/preset_tiny_cpu_initial.png` | Tiny 4-Bit CPU preset: CPU block, Prog ROM, PC/ACC/OUT readouts, Inspector assembler |
| `evidence/screenshots/preset_tiny_cpu_sum_verified.png` | Tiny CPU after executing Sum 1..5: ACC=15, OUT=F, Halt LED illuminated red |
| `evidence/screenshots/preset_mux4.png` | 4:1 Multiplexer preset: 2-bit select routing D3 input to Output Y probe |
| `evidence/screenshots/preset_alu4.png` | 4-Bit ALU Subsystem preset: subtracting 5 - 5 = 0, Zero Flag LED illuminated |
| `evidence/screenshots/preset_sr_latch.png` | SR Latch preset: cross-coupled NOR gates showing bistable memory retention and reset |
| `evidence/screenshots/preset_d_ff.png` | Edge-Triggered D Flip-Flop preset: data latched on rising clock edge to Q output |
| `evidence/screenshots/preset_ram_test_written.png` | 16x8 RAM preset: data 0x42 written to address 0x3 and read back to probe |
| `evidence/screenshots/preset_full_adder.png` | Full Adder preset: 3 inputs summing to Sum and Cout |
| `evidence/screenshots/truth_table_modal_opened.png` | Truth Table modal: 4 rows, 2x2 Karnaugh map, and simplified SOP formula |
| `evidence/screenshots/loop_detection.png` | Combinational loop containment: bounded 100-iter containment with red warning box |
| `evidence/screenshots/bus_contention.png` | Electrical bus contention: red X marker over contended component and HUD warning |
| `evidence/screenshots/theme_light.png` | Light Schematic Paper theme: crisp white canvas and dark schematic lines |
| `evidence/screenshots/theme_high_contrast.png` | High-Contrast theme: stark yellow highlights and color-blind friendly cues |
| `evidence/screenshots/mobile_390x844.png` | Mobile responsive layout: auto-collapsed sidebars, maximized canvas at 390x844 |
| `evidence/screenshots/url_hash_restored.png` | Circuit automatically restored from base64 `#circuit=...` URL hash |
