# Terravive — Evolutionary Ecosystem Laboratory · Validation Record

**Artifact:** `index.html` (single self-contained file, 158 KB, 3,113 lines — 1 `<style>` block, 1 `<script>` block, 0 external references)
**Author of this record:** the implementing agent (Claude Opus 5). No evaluator score is claimed or implied here.
**Date:** 2026-09-08

## Tooling actually used

| Tool | Version / how | Notes |
|---|---|---|
| `agent-browser` (installed skill) | 0.31.1, Chrome via CDP, headless | Primary driver. Loaded `skills get core` and `skills get dogfood` before use, as the skill file instructs. |
| Local HTTP server | `python3 -m http.server 8731 --bind 127.0.0.1` | Development-only. Not a runtime dependency of the artifact. |
| `node --check` | v25.8.1 | Syntax gate on the extracted `<script>` body after every edit. |

Real input was used throughout: `mouse move/down/up` at computed screen coordinates, `find text … click`, `press`, `keyboard type`, `fill`, `upload`, `set viewport`. `eval` was used to **read** live simulation state and to run long accelerated batches, not to fake interactions.

**Tool limitation recorded:** `agent-browser mouse wheel` dispatches at a fixed document position (verified: the wheel event always landed on `#topbar` regardless of a preceding `mouse move`). Wheel zoom and pinch zoom were therefore exercised by dispatching `WheelEvent`/`PointerEvent` at canvas coordinates from the page context — the application's own handlers ran unmodified, but the input was synthetic. Everything else used real driver input.

---

## 1. Runtime and delivery

| Check | Result | Evidence |
|---|---|---|
| Single self-contained file | **pass** | `grep -cE '<script[^>]+src=\|<link[^>]+href=\|@import\|url\(' index.html` → `0`. No absolute/protocol-relative URLs. |
| No network at runtime | **pass** | `agent-browser network requests` over an entire session: 20 requests, all `http://127.0.0.1:8731/index.html…` plus the browser's own `favicon.ico` probe (404, browser-initiated). Non-local requests: **0**. |
| Opens directly from `file://` | **pass** | `file:///…/index.html` in a clean session: `protocol:"file:"`, tick advancing, 331 organisms, 59 fps, **0 console errors**, exactly **1** network request (the file itself). Screenshot `15-file-protocol.png`. |
| `file://` feature parity | **pass** | Under `file://`: autosave to `localStorage` wrote 460 KB; `toDataURL('image/png')` returned 740 KB; `URL.createObjectURL` succeeded; `serialize()`+`deserialize()` round-tripped; CSV export produced 25 KB. Real click on **Save state file** → toast `State saved (1373 KB, tick 6087)`, no error. |
| Download actually written to disk from `file://` | **not-run** | The page-side path (blob URL + `a[download]` click) completed without exception, but headless Chrome's download destination was not inspected. The in-app **Save to text…** / **Load from text…** modal and the file-input path (below) cover the same data path end to end. |
| Console clean | **pass** | `agent-browser errors` → NONE; `console` → 0 messages, on both `http://` and `file://`. |

---

## 2. Agent behaviour, ecology and evolution

Default preset **Balanced meadow**, seed 1337, medium world (1600×1024, 100×64 environment cells).

### 2.1 The organisms are agents, not particles
Each mobile organism carries 24 trait genes + a 391-weight `26 → 10 → 11` tanh controller, both inherited. Sensors are computed per tick from the local environment and neighbourhood; steering is a diet-gated weighted sum of the controller's outputs applied to sensed directions.

Live read of the selected organism at two moments ~3 s apart while running (`inspect.js`):

```
t0: energy 118.0  age 311   sensors[0..7] 1, 0.153, -0.834, 1, 0,     0, 0.545, 0.635
    outputs 0.658, -0.318, 0.976, -0.916, 0.909, -0.379, -0.487, 0.924, -0.817, 0.528, -0.212   kids 1
t1: energy 60.4   age 1795  sensors[0..7] 1, -0.408, -0.039, 1, 0.143, 0, 0.125, 0.452
    outputs 0.902, -0.750, 1.000, 0.149, 0.459, 0.699, -0.923, 0.838, -1.000, -0.862, -0.920    kids 4
```
The DOM values (`domEnergy`, `domAge`) matched the simulation object exactly at both samples. **Sensors, decision values, genotype, age, energy, parent and behaviour all update from live state — pass.**

### 2.2 Energy transfer through four trophic compartments
Per-role energy budget, measured by accumulating each organism's per-source intake over 300-tick windows (`diag6.js`, meadow):

```
t=900    herb n=550  plant 0.723  meat 0      detr 0.001  cost 0.575  net +0.149
         carn n=41   plant 0.052  meat 0.753  detr 0.034  cost 0.692  net +0.147
t=1800   herb n=575  plant 0.249  meat 0      detr 0.004  cost 0.555  net −0.302
         carn n=83   plant 0.014  meat 0.340  detr 0.026  cost 0.690  net −0.310
```
Herbivores live on plants, carnivores on meat with a carrion side-income, and both go into deficit when the resource base thins. **pass**

### 2.3 Energy accounting closes
`__sim.energyLedger` over 2,500 ticks from a fresh seed:

```
inputs (photosynthesis + somatic release at death) 712,481
respired                                           831,583
stored change                                     −122,258
residual                                             3,156   → 0.44 % of inputs
(measured again at 1,500 ticks from the default preset: 0.88 %)
```
The remaining 0.44 % is the boundary approximation in the 4-neighbour diffusion of the food/detritus fields (edge cells clamp their index). **pass.** *Simplification, stated honestly:* body mass is a structural energy subsidy released at death rather than paid for during growth; it is booked as an explicit `somaticIn` input so the ledger balances.

### 2.4 Populations are resource-limited
Predation toggled off vs on, identical preset and seed, 2,500 ticks each:

```
predation ON   pop 153  (111 herbivore, 42 carnivore)  plant biomass 1180
predation OFF  pop 1297 (1297 herbivore, 0 carnivore)  plant biomass  423
```
A textbook trophic cascade: removing predators produces a herbivore irruption that strips the vegetation. **pass**

### 2.5 Inheritance, mutation, crossover, lineage
Audit of the live lineage registry (`lineage.js`, 1,655 records, 260 founders):

```
generation consistent (gen == parent.gen+1)   1,395     inconsistent 0
child present in its parent's kids array      1,395     missing      0
inheritance sample: child #1519 ← parent #1397 (gen 7 ← 6, asexual)
  traits changed 5 / 24 (max Δ 0.0634), brain weights changed 21 / 391, recorded mutations 26 = 5+21
```
Mutation counts recorded at birth match the actual genome delta exactly. Crossover is on by default (uniform on traits, multi-point on controller weights). **pass**

Mutation rate response, same preset/seed, 3,000 ticks:
```
mutRate 0.01 / mag 0.02  →  2 species alive,   3 total
mutRate 0.55 / mag 0.45  → 27 species alive, 105 total
```

### 2.6 Roles emerge from traits
Role is derived from the normalised diet genes (plant/meat/detritus), never assigned. In **Rapid radiation** (mutRate 0.45) after ~11,800 ticks: 1,153 organisms, **71 species alive / 254 total**, Shannon H′ 3.68, generation 17, with herbivores, omnivores, scavengers and carnivores all present in the species list (`04-lineage.png`). Carnivores also **re-evolved** from a herbivore-only population in a long meadow run (observed at t≈12,000).

---

## 3. Public validation checks

| Check | Result | Evidence |
|---|---|---|
| Observe feeding, energy change, reproduction, inherited variation, death, population change | **pass** | §2.1–2.5. Over one 1,500-tick meadow run: 758 births, 414 deaths, generation 6, 605 organisms across 3 roles. |
| Select a creature; sensors / decisions / genotype / age / energy / lineage / behaviour update from live state | **pass** | Real mouse click at the organism's screen position selected exactly the intended id (`selected 1339 == expected 1339`). §2.1. Screenshots `00-hero.png`, `09-overlays-sensors-targets.png`. |
| Alter food → measurable response | **pass** | foodGrowth 0.35 → **189** organisms; 2.6 → **461** (same seed, 2,500 ticks). Food-pulse button: plant biomass 1,172 → **5,696** in 2 ticks. |
| Alter climate → measurable response | **pass** | Cold snap: mean temperature 14.67 → **2.34 °C** in 6 ticks. Heat wave: 14.12 → **26.78 °C**. Drought: mean moisture 0.581 → 0.522, population 540 → 283 over 400 ticks. |
| Alter obstacles → measurable response | **pass** | Habitat barrier: rock cells 679 → **1,090** (+411), a wall bisecting the world (visible in `16-ancestry.png`). Organisms buried by the new wall escape over ~250 ticks (38 → 5). |
| Alter mutation → measurable response | **pass** | §2.5. |
| Alter predation → measurable response | **pass** | §2.4; predator introduction spawned +34 carnivores instantly, herbivores then fell 633 → 490 over 700 ticks. |
| Pause | **pass** | Real click on **Pause**: `paused true`, tick frozen at 366 across a 2 s wait. |
| Single step | **pass** | Three real clicks on **Step** → tick 366 → **369** (exactly +1 each). |
| Deterministic reset | **pass** | UI-level: seed `20260908`, **Reset** clicked twice while paused → both runs tick 0, pop 260, state hash **2979641922**, identical leading genes. Seed `555` → hash 3174121550, different genes. Programmatic: same seed reproduces both the initial state *and* the state after 400 ticks. |
| Charts | **pass** | 5 time-series charts + trait histogram + trait-mean series, drawn from retained samples (607–808 samples in a long run). CSV export values match the retained arrays exactly (`csvPop 559 == histPop 559`, `csvPlant 525.4821 == histPlant 525.4821`). Screenshot `03-charts.png`. |
| Lineage view | **pass** | Species list (71 rows), clickable species highlight (clicked row → `membersOnCanvas 179` matching its live member count, non-members dimmed on the canvas), time-scaled species phylogeny with parent connectors (253 of 260 species carry a parent link), and a per-organism ancestry tree: `#57 gen 0 → #296 gen 1 → #433 gen 2 → #555 gen 3 (selected) → 3 offspring`, footer `ancestors 3 · direct offspring 3 · descendants(3) 4`. Screenshots `04`, `05`, `16`. |
| Save and load | **pass** | Round trip is **bit-exact**: state hash, population, all genome/controller sums, lineage size, species, field totals identical before and after (`roundTripMismatches: NONE`). Continuing from a reloaded state is deterministic. Three routes tested: in-page serialize/deserialize, **Save to text… / Load from text…** modal via real clicks (1.68 M chars, tick 2533 → restored to 1933), and the real `<input type=file>` via `agent-browser upload` (a medium desert world was replaced by a saved 1120×720 world at tick 400 with 90 organisms, seed 4242, lineage and species restored). |
| Multiple diagnostic modes | **pass** | 9 field layers and 10 creature-colour modes each produce a **distinct** rendered image (9/9 and 10/10 unique frame signatures). All 7 overlays change the render, measured by full-frame pixel diff: sensors 56,027 px · steering 27,930 · targets 763 · spatial grid 49,053 · decision outputs 454 · trails 13,411 · species labels 44,751. |

---

## 4. Controls, viewports, performance

| Check | Result | Evidence |
|---|---|---|
| Desktop 1280×800 | **pass** | `documentElement.scrollWidth 1280`, both side panels visible, canvas 628×754. Screenshots `00`–`10`. |
| Narrow 390×844 | **pass** | Canvas 390×798, no horizontal overflow (`scrollWidth 390`), panels become drawers with working toggle buttons, top bar scrolls horizontally (1102 → 390) so the preset selector stays reachable, toolbar wraps to two rows, 60 fps. Real tap on the canvas selected the intended organism. Screenshots `11`–`14`. |
| High-DPI | **pass** | Canvas backing store is sized by `devicePixelRatio` (capped at 3) with a matching context transform; charts do the same. |
| Pointer / touch input | **pass** | Real drags exercised every tool; two-pointer pinch (synthetic `PointerEvent`s) zoomed 0.209 → 0.502 for a 2.4× finger spread. |
| Pan | **pass** | Right-drag with any tool: camera (800, 512) → (1141, 669). Pan tool selectable from the toolbar. |
| Zoom | **pass (synthetic input)** | Wheel in 0.465 → 0.882, wheel out → 0.209; anchored at the cursor (drift ≤ 0.3 world units, except at the camera clamp boundary where clamping takes precedence). Driver cannot target wheel events at coordinates — see tool limitation above. |
| Keyboard | **pass** | Arrows pan (x 1141 → 1351), `+` zooms (0.381 → 0.465), `F` toggles follow, `Space` toggles pause, `1`–`0` pick tools, `Esc` deselects. |
| Input continuity | **pass** | Typed `20260908` into the seed field while the simulation ran at 32×; field value and focus survived 5 s of animation and HUD/inspector repaints, and the parameter updated live. |
| Every pointer tool | **pass** | select (id match), spawn (+2 over a 5-point drag), erase (−6), grow food (+food), enrich/deplete soil (fert 3762.84 → 3765.58), rock (+13 cells), water (+16 cells), restore soil, warm (tempMod 0 → 16), cool, protected reserve (drag → 630×498 rect). |
| Protected observation area | **pass** | Reserve drawn by drag; a mass-extinction event then killed **338 of 814** organisms world-wide while **all 97 inside the reserve survived (97 → 97)**. |
| Presets (7) | **pass** | All load without error and produce distinct worlds. After 1,200 ticks: meadow 573 (530 H / 42 C / 1 S), predator–prey 259 (126 H / 129 C — the oscillation the preset is named for), island 566 in a 2240×1440 world with 40 % water, desert 109 (103 H / 3 C / 3 S) then a dip to ~42 and recovery to 195 by t≈4,800, rapid radiation 602 across **56 species** with all four roles present, mass-extinction fires its scheduled meteor at t=1500 (548 → 148 → 24 under drought → recovers to 157), dense stress test 1,481 in a large world. |
| Performance | **pass** | 1.27 ms/tick at 363 organisms; **7.35 ms/tick at 1,763 organisms** (≈4.2 µs per organism-tick) after optimisation (fast `tanh`, precomputed allometric powers, `Math.hypot` removed from the inner loop, coarser spatial hash — 21 % faster than before). Rendering is 6.1 ms/frame at 1,903 organisms. The stepping loop is time-budgeted (15 ms) so pointer input stays responsive at any speed multiplier; the HUD reports the real fps and ms/step rather than hiding the throttle. Dense stress test: 47 fps at 1,352 organisms in a 2240×1440 world. |
| Live HUD | **pass** | Shows fps + ms/step, tick + speed multiplier, day/season, population + drawn count, births/deaths per 15-tick sample, species count + Shannon H′, oldest generation, biomass, total energy pool, selected entity, active intervention with remaining ticks, and a RUNNING/PAUSED pill. |
| Autosave / CSV / PNG | **pass** | Autosave wrote 1,637 KB to `localStorage` and **Restore autosave** (real click) rolled tick 2,633 / pop 122 back to tick 1,933 / pop 549. CSV: 21 columns × 129 rows. PNG: valid `data:image/png` (739 KB) via a real button click. |

---

## 5. Defects found during validation, and their fixes

All were found by these tests and fixed in `index.html`; each was re-tested afterwards.

1. **Crash on first paint** — `resizeCanvas()` ran before the world existed, so `createImageData(0,0)` threw. Added dimension guards in `draw()`/`drawField()`.
2. **Predation never occurred** — prey selection required a different *species id*, but speciation lumped herbivores and carnivores together, so nothing could hunt. Kin are now recognised by species **and** diet similarity, independent of the clustering; threat detection likewise keys on "more carnivorous than me".
3. **Speciation too permissive** — the species descriptor sampled random hidden-layer weights. It now samples the hidden→output policy block, diet genes carry more weight, and the default distance dropped 0.30 → 0.22. Founder herbivores/carnivores/scavengers now separate correctly (1 species → 3 at t=0).
4. **Grazed cells could never recover** — logistic growth from `f ≈ 0` is glacial, so grazers created permanent deserts and starved amid an otherwise healthy landscape. Added a seed-rain term (`f + 0.17·capacity`) plus lateral seed dispersal.
5. **Scavengers could not find carcasses** — detritus is a sparse point field, invisible to an 8-direction gradient probe, and an over-aggressive blur smeared carcasses into an unusable film. Added a coarse (4×4-cell) carrion "scent" grid that scavengers scan, and reduced the blur. Also seeded soils with an initial litter layer so the decomposer niche exists from tick 0.
6. **Behaviour label stuck on "attacking"** — `o.beh` was never reset, so any organism that once attacked reported "attacking" for life. Replaced with a per-tick `attacked` flag.
7. **Predators chased grass** — steering terms were ungated, so a starving carnivore was pulled toward vegetation as strongly as toward prey. Steering weights are now gated by the diet phenotype, and predators commit to a quarry instead of re-targeting the nearest prey every tick.
8. **Interventions silently did nothing** — the disasters panel is a collapsed `<details>`; clicks on hidden buttons appeared to succeed. (Test error, not an app defect — but it masked the real behaviour until the section was opened. All intervention effects then measured correctly.)
9. **Preset parameters leaked between presets** — loading *Desert* then *Rapid radiation* left the desert's temperature and rainfall in place. Presets now reset every simulation parameter to its default before applying their own overrides.
10. **Desert preset was sterile** — 200 → 1 organism. Rebalanced (fertility penalty removed, aridity expressed through rainfall/temperature); now dips to 42 and recovers to 195, evolving to generation 10.
11. **Horizontal overflow at 390 px** — the off-canvas drawers extended the document to 737 px. Added `overflow:hidden` on the app/main containers.
12. **Spawn brush stalled while paused** — its rate limiter used `tick % 2`, which is frozen when paused. Replaced with a pointer-event counter; brush strengths raised; spawn scatter tied to the brush radius so the eraser can undo it.
13. **Reset button unreachable by accessible name** — pending world changes renamed it to `Reset *`. It now keeps the name and only changes styling/tooltip. Reset also preserves the current pause state instead of force-resuming.
14. **Organisms buried by newly painted terrain were stuck forever** — an organism inside a blocked cell may now always move, so it can escape.
15. **Save/load was not bit-exact** — positions and energies were stored as float32. Now float64 (format version 3, still reads v2); `deserialize` no longer appends a spurious history sample. Round trip is exact.
16. **Energy ledger did not close (7.9 % drift)** — plant die-back, decomposer respiration, the max-energy clamp, meteor-destroyed biomass and the starvation shortfall were unbooked. All are now accounted; residual 0.44 %.
17. **Save-format version collision** — the payload version was bumped to `3` twice during development for two different layouts (float64 positions, then an added `somaticIn` field), so a file written by the first v3 failed to load with `grid mismatch 1×1 vs 257×0`. Found by loading the shipped `evidence/sample-state.json`. The `somaticIn` addition is now version **4**; the reader handles v2 (float32 positions), v3 (float64, no ledger fields) and v4. The JSON envelope's `version` field, which had drifted out of sync at `2`, now tracks the payload version. Both the old v3 file and a freshly written v4 file load correctly.
18. **`energyLedger.balance` was only meaningful as a delta** — it compared cumulative inputs against the *absolute* stock, so it read ~41 % on a young world. It now records the stock present at world creation (`storedAtReset`, persisted in saves) and reports a true absolute balance: 0.88 % residual after 1,500 ticks, 0.44 % after 2,500.

---

## 6. Known limitations (honest)

1. **The default preset runs a strong consumer–resource cycle.** Balanced meadow gives ~2,500–3,000 ticks of a rich three-role community (typically ~500 herbivores, 40–80 carnivores, a handful of scavengers), then herbivores overshoot carrying capacity, strip the vegetation and crash to ~40–120, usually taking the carnivores with them; the herbivore population then oscillates between roughly 200 and 1,800 with a ~4,000-tick period. This is the expected behaviour of a consumer–resource model with a fast grazer and it is visible in the charts, but it does mean the default world is not a stable three-trophic steady state over very long runs. Carnivores do sometimes re-evolve from herbivores (observed at t≈12,000). Extensive tuning was applied (Holling type-II intake, handling time, hunt-success probability, density-dependent fecundity, gut capacity, vegetation cover as prey refuge, longer predator generations); a grazing-refuge variant was tried and reverted because it drove the world extinct. Predators can be reintroduced at any time with the intervention button, and *Predator–prey oscillation* is a preset in its own right.
2. **Autosave can exceed `localStorage` quota** on large worlds. A full state is ~1.2 KB per organism (391 float32 controller weights dominate), so ~1.8 MB at 1,500 organisms and more beyond. The failure is caught and reported in the Data panel as `failed: storage quota exceeded`; manual file/text save is unaffected.
3. **Wheel and pinch zoom were verified with synthetic events** because the driver cannot dispatch a wheel at chosen coordinates (§Tooling). Pan, clicks, drags, typing and file upload all used real driver input.
4. **The `file://` download destination was not inspected** (`not-run`, §1). The page-side blob/anchor path completed without error and the equivalent data path is fully covered by the text modal and the file-input load.
5. **Field rendering is soft at low zoom.** The environment grid is 16 world units per cell, so at "fit world" zoom each cell is ~6 px and the smoothed upscale reads as painterly rather than crisp. A static grain overlay mitigates this; zooming in resolves it.
6. **Overlays are drawn for at most 300 on-screen organisms** (always including the selection) to keep frame time bounded. This is a deliberate cap, not a failure.
7. **The energy ledger carries two documented simplifications**: body mass is a structural subsidy released at death (booked as `somaticIn`), and the 4-neighbour field diffusion is not mass-conserving at the world edge (0.44 % residual).

---

## 7. Reproducing this validation

```bash
cd <this directory>
python3 -m http.server 8731 --bind 127.0.0.1 &     # development server only
agent-browser --session tv open http://127.0.0.1:8731/index.html
agent-browser --session tv set viewport 1280 800
agent-browser --session tv errors                  # expect: none
# direct-file check (no server):
agent-browser --session tvf open "file://$PWD/index.html"
```
The diagnostic scripts used above read live state through `window.__sim` (an inspection-only hook; the simulation never depends on it) and are reproduced inline in this document's measurements.

## 8. Files

```
index.html                          the delivered application (161 KB, self-contained)
evidence/validation.md              this record
evidence/sample-state.json          a real saved world (376 KB) — load it via "Load state file"
evidence/screenshots/00-hero.png            selected carnivore, sensor cones, live inspector
evidence/screenshots/01-desktop-default.png fit view at 1280×800
evidence/screenshots/02-zoomed.png          zoomed world with herbivores and predators
evidence/screenshots/03-charts.png          all live charts from retained samples
evidence/screenshots/04-lineage.png         71 species, rapid radiation
evidence/screenshots/05-phylogeny.png       species phylogeny with highlight
evidence/screenshots/06-stress.png          dense stress test
evidence/screenshots/07..10                 visualization modes and overlays
evidence/screenshots/11..14                 390×844 layout, drawers, mobile inspector
evidence/screenshots/15-file-protocol.png   running from file://
evidence/screenshots/16-ancestry.png        ancestry tree + habitat barrier
```
