# FLUXWORKS — validation record

Artifact: `index.html` (single self-contained file, 196 KB, one `<script>` block, no external references)
Validated by: Claude (Opus 5) — agent-authored record
Tool: `agent-browser` 0.31.1 (Chrome via CDP), loaded from the installed `agent-browser` skill
(`agent-browser skills get core` + `skills get dogfood`).
Primary URL under test: `file:///home/pyro/projects/naked/opus5/11-factory-automation/index.html`
(the delivered artifact opened **directly**, no HTTP server involved at any point).

Every number below was read out of the live page (`agent-browser eval`) or observed in a screenshot.
Interactions were driven with real pointer input (`agent-browser mouse move/down/up`), real key
presses (`agent-browser press`), and real control clicks (`agent-browser click <selector>`)
unless a line says otherwise.

---

## Summary

| Area | Result |
|---|---|
| Direct `file://` open | **pass** — all 35 screenshots and every check below were taken from `file://` |
| No network dependency | **pass** — only the document request; zero external refs in source |
| Logistics correctness (belts, splitter, merger, inserter, backpressure) | **pass** |
| Recipes / multi-stage production / two-component assembly | **pass** |
| Power network, brownout, fuel | **pass** |
| Build ergonomics (drag, rotate, copy/paste, area delete, eyedropper, undo/redo) | **pass** |
| Pause / single-step / speed invariance | **pass** |
| Analytics, overlays, bottleneck detection | **pass** |
| Save / load / slots / share code / PNG | **pass** |
| Responsive 1280×800 and 390×844, touch | **pass** (touch via synthesized PointerEvents — see note) |
| Performance | **pass** — 60 FPS with 9,216 moving items |
| Audio | **pass (measured, not heard)** — see the honest caveat in §11 |

Bugs found during validation and fixed: **10** (§13). Remaining limitations: §14.

---

## 1. Direct-file load and self-containment

```
agent-browser --session fw open "file:///home/pyro/.../index.html"
agent-browser --session fw get title      -> FLUXWORKS — Factory Automation & Logistics
agent-browser --session fw console        -> (empty)
agent-browser --session fw errors         -> (empty)
agent-browser --session fw network requests
  [..] GET file:///home/pyro/.../index.html (Document) 200      <- the only request
```

Static scan of the delivered file:

```
grep -ncE '<link|<script[^>]+src|<img|<iframe|url\(|@font-face|@import|https?://' index.html  -> 0
grep -c '<script' index.html -> 1        (a single inline <script>, no src)
wc -c index.html -> 200583
```

HTML well-formedness smoke test (`html.parser` tag-stack walk): `unclosed: [] errors: []`.

**pass** — the artifact opens directly from the filesystem, needs nothing else, and fetches nothing.
Screenshot: `screenshots/01-boot-file.png`, `screenshots/35-final-boot.png`.

## 2. Default state produces immediately

Clean session, `localStorage.clear()`, fresh open at 1280×800:

```
t=0s : {ents:54, running:true, mode:campaign, contract:plates, items:11, nets:1, sup:1350, dem:818}
t=8s : {delivered:12, items:16, rate:1.55/s, fps:60, stalls:[]}
```

Extraction → belt transport → smelting → pressing → delivery is visibly running on load.
Screenshot: `screenshots/35-final-boot.png`, `screenshots/04-starter.png`, close-up `screenshots/05-zoom-line.png`.

## 3. Building a chain by hand (pointer input)

### 3.1 Belt drag with automatic L-routing and validity preview

Drag `(34,26) → (44,26) → (44,32)` with the belt tool:

```
laid: 34,26:E 35,26:E ... 43,26:E 44,26:S 44,27:S ... 44,32:S   (17 tiles, one undo step)
undoDepth: 1     spent: 1193 -> 1227
```

The preview during the drag shows the green (valid) ghost path and the label
`17 × Conveyor Belt (34¢)` — `screenshots/06-belt-drag-preview.png`.

### 3.2 Undo / redo (toolbar buttons and Ctrl+Z / Ctrl+Y)

```
#btnUndo -> belts 0, undo 0, redo 1, spent 1193
#btnRedo -> belts 11, undo 1, redo 0, spent 1227
Ctrl+Z   -> belts 0     Ctrl+Y -> belts 11
```

Credits are rolled back with the structures. **pass**

### 3.3 Splitter + storage + inserter + power pole, built with the mouse

Right-click quick-delete of a belt, then splitter, a 2-tile belt drag, a Storage Yard, a
Power Pole, an Inserter, and a 6-tile belt run — all placed by moving the mouse to the tile
and pressing/releasing the left button:

```
{sp:"splitter/E", b18:"belt/N", b17:"belt/N", store:"storage/E", pole:"pole/N",
 ins:"inserter/E", row16:["belt/E"×6], insNet:0}
```

After running: the splitter round-robins (thru 40, rr cycling), the inserter pulls from the
storage and loads the dead-end belt (19 items moved), and the belt backs up exactly:

```
deadEndBelt: [[], ["ironIngot@0.29"],
              ["ironIngot@1.00","@0.75","@0.50"],
              ["ironIngot@1.00","@0.75","@0.50","@0.25","@0.00"],  ...]
inserter: {status:"blocked"}   storage later: 597/600   constructor: still fed
```

Item spacing is exactly `1/itemDensity` and the front item stops at `p=1.00` — real queueing,
not a decorative animation. Backpressure then cascades up into the storage (597/600) and the
inserter reports `output blocked`.
**pass** — `screenshots/08-splitter-inserter-backpressure.png` (congestion overlay: saturated
belts magenta, free belts green), `screenshots/10-storage-closeup.png`.

### 3.4 Merger (three-way)

Verified on the *Balanced Factory* preset, which contains three mergers:

```
mergers: [ {xy:"18,9",  dir:E, slots:[…], thru:45, rate:1.26/s},
           {xy:"45,13", dir:E, slots:["ironPlate@0.29","ironPlate@1.00",null], thru:15},
           {xy:"18,23", dir:E, slots:[null,"copperIngot@1.00",null], thru:45} ]
```

Each merger holds one item per input face and emits forward round-robin. **pass**

### 3.5 Copy / paste / cut / area delete / eyedropper / upgrade tool

```
area select drag (11,18)-(15,21) -> areaSel {x0:11,y0:18,x1:15,y1:21}
captured: ["belt@0,1/1","smelter@1,1/1","belt@3,1/1","belt@4,1/1"]     (only fully-contained parts)
Copy -> tool "paste", clipboard 4 parts, ghost 5×4
paste at (13,25) -> ["belt@11,24","smelter@12,24","belt@14,24","belt@15,24"]
R (rotate blueprint) -> w/h swap 5×4 -> 4×5, all dirs 1(E) -> 2(S)
delete-tool drag (10,23)-(17,26) -> ents 58 -> 53, leftInRect 0
eyedropper on the smelter -> curType "smelter", curDir 1, lastRecipe {smelter:"smeltIron"}
upgrade tool click -> tier 1 -> 3 (two clicks), power draw 100 kW -> 290 kW
```

**pass** — `screenshots/13-area-select.png`, `14-paste-preview.png`, `15-area-delete-preview.png`.

### 3.6 Belt drag replaces belts (in-place tier upgrade) and undoes cleanly

```
drag T3 belts across (14,19)-(20,19):
  ["belt/T3","belt/T3","belt/T3","belt/T3","constructor/T1","constructor/T1","belt/T3"]
  (machines in the path are skipped, belts are replaced; entity ids changed)
undo -> ["belt/T1","belt/T1"]
```

**pass**

## 4. Deliberate bottleneck and metric response

Selected the belt at `(22,19)` with the Inspect tool and pressed the inspector's ↻ button twice
(East → West), breaking the constructor → hub link.

| | before | after 12 s | after repair |
|---|---|---|---|
| delivery rate | 1.74 /s | **0** | 1.74 /s |
| iron-plate production | 1.45 /s | **0** | — |
| constructor status | ok | **blocked** (out buffer 11) | ok |
| machines running / stalled | 4 / 0 | **3 / 1** | 4 / 0 |
| belt row 20..24 | flowing | `20:E[5] 21:E[5] 22:W[0] 23:E[0] 24:E[0]` | flowing |
| bottleneck panel | "belt congestion" | **"Constructor — output blocked", "Belt congestion — 14 saturated tiles"** | congestion only |

The reversed belt refuses the head-on hand-off (`22:W[0]`), the belts behind it fill to
capacity, and the machine blocks. Repairing it restores throughput exactly.
**pass** — `screenshots/11-bottleneck-reversed-belt.png` (inspector shows the belt's live
throughput sparkline dropping to zero).

## 4b. Invalid-connection feedback

Placed a West-facing belt at `(21,19)` head-on against the East-facing belt at `(20,19)`:

```
problems: ["belt@20,19: faces an oncoming belt", "belt@21,19: faces an oncoming belt"]
bottlenecks: ["Invalid connections — 2 outputs cannot hand off"]
```

A pulsing red **!** marker is drawn at the exact hand-off point (always, regardless of overlay
state), the tooltip and the inspector both name the problem, and the bottleneck panel counts
them. Undo restores the belt and the count returns to 0.
`linkProblem` also catches: feeding a splitter anywhere but its back, feeding a merger's output
face, aiming at an inserter / power pole / drill, and pointing off the map.
All six presets report **0** invalid connections.
**pass** — `screenshots/36-invalid-connection.png`

## 5. Machine states: starved / blocked / unpowered / misconfigured

Changed a smelter's recipe with the real `<select>` from *Iron Ingot* to *Stone Brick*:

```
recipeNow: "bakeBrick", status: "starved", in: {ironOre:3}   (wrong input stuck in the buffer)
bottlenecks: ["Smelter — starved (missing input)", …]
restore smeltIron -> status "ok"
```

Finite deposit exhaustion (isolated 60-unit patch, everything else cleared):

```
t=0s  patch 60   rich 1.00  status ok
t=24s patch 11   rich 1.00  status ok      mined 49
t=48s patch  0   rich 0.00  status "nodeposit"  mined 60   ("Mining Drill — no ore left")
```

Exact conservation: 60 units in the ground → 60 items mined. **pass**

## 6. Power system

### 6.1 Networks are real

Selecting a Power Pole inspects the whole network (`screenshots/34-network-inspect.png`):

```
Power net #0 · 100% sat | Poles 18 | Generators 3 (3 fuelled) | Consumers 21
Supply 2.36 MW | Demand 1.58 MW | Headroom 784 kW | Satisfaction 100%   + 60 s sparkline
```

### 6.2 Brownout changes machine speed

Dragged the *Power difficulty* slider in the Sim panel (real `fill` + focus/`End` key):

| power difficulty | demand | supply | satisfaction | iron plates / s | machine status |
|---|---|---|---|---|---|
| 1.00× | 803 kW | 1350 kW | 100 % | 1.778 | ok |
| 1.65× | 1479 kW | 1350 kW | 91.3 % | 1.575 | brownout |
| 3.00× | 2616 kW | 1350 kW | 51.6 % | 0.900 | brownout |

Production tracks satisfaction almost linearly — the power bar is wired to the simulation.
**pass** — `screenshots/18-brownout-power-overlay.png` (power overlay: per-network supply-area
tint + wires; analytics panel shows the demand step in the sparkline).

### 6.3 Fuel is consumed and limits supply

*Power Crisis* preset (two fuelled generators, coal supply removed, difficulty 1.4×):

```
t≈110 s : sup 0 kW, dem 1915 kW, sat 0, delivered 5 then frozen
bottlenecks: ["Power deficit — 1.92 MW short", "Smelter — no power", …]
```

Generators burn coal in proportion to actual load, then the factory goes dark. **pass**

### 6.4 Modules change real values

Constructor + smelter + drill, same factory:

| module | iron plates / s | constructor draw | total demand | satisfaction |
|---|---|---|---|---|
| none | 1.414 | 100 kW | ~820 kW | 100 % |
| Overclock | **1.990** | **200 kW** | 1490 kW | 91 % |
| Efficiency | **1.251** | **50 kW** | 489 kW | 100 % |

**pass**

## 7. Pause, single-step, and speed invariance

```
Pause  : tick frozen at 768 for 2 s; belt item positions unchanged
Step ×3: 768 -> 769 -> 771 ; item p 0.5700 -> 0.6650  (exactly 3 × beltSpeed/60 = 0.095)
Repeated single-step: 2565->2566->2567->2568->2569 (exactly one tick per press)
```

Production per **simulated** second at each speed (same factory, 8–64 s windows):

| speed | ticks / sim-second | iron ore | iron ingot | iron plate | delivered |
|---|---|---|---|---|---|
| 0.5× | 60.00 | 1.250 | 1.000 | 1.500 | 1.500 |
| 1× | 60.00 | 1.375 | 1.125 | 1.500 | 1.500 |
| 4× | 60.00 | 1.372 | 1.216 | 1.497 | 1.497 |
| 8× | 60.00 | 1.359 | 1.156 | 1.453 | 1.500 |

Fixed 1/60 s sub-steps: no timing drift and no duplicated items at any speed. **pass**
Screenshot: `screenshots/12-paused.png`.

## 8. Analytics and overlays

All figures are derived from live state and match theory:

```
prodRates {ironOre 1.45, ironIngot 1.21, ironPlate 1.45}   (smelter T3 = 0.5×2.4 = 1.20 exact)
consRates {ironIngot 0.97, ironPlate 1.45}                  (constructor needs 2 per 2 s = 1.0)
Balanced preset: ironOre 1.45, copperOre 1.45, coal 1.45, ironIngot 0.97, copperIngot 0.97,
                 ironPlate 1.45, copperWire 1.45, circuit 0.48   ← two lines combined
```

A **Storage & buffers** card reports live storage totals, the per-item mix, machine buffer
contents and generator fuel, e.g. `Storage yards 1 | Stored items 26/600 | Iron Plate 26 |
Machine buffers 28 items | Generator fuel 18/18 coal`. The **Delivery** card computes a live ETA
from the measured rate (`Rate 0.19 /s (11.6/min)`, `ETA 06:43`).

Overlays exercised: flow, connection graph, power network, utilisation heat-map, congestion,
blocked, per-structure status. All update live and remain usable while building.
Screenshots: `38-analytics-full.png`, `29-overlay-graph-util.png`, `30-overlay-blocked-congestion.png`,
`18-brownout-power-overlay.png`, `08-splitter-inserter-backpressure.png`.

Bottleneck detection is real (examples captured verbatim): *Constructor — starved (missing
input)*, *Inserter — output blocked*, *Mining Drill — no ore left*, *Power deficit — 1.92 MW
short*, *Belt congestion — 107 saturated tiles*.

Per-entity inspection with recent history is available for machines, belts, splitters, mergers,
inserters, storage, generators, the hub, and **power poles (whole network)**.

## 9. Persistence

### 9.1 Exact JSON round-trip

Paused the sim, hashed the full entity signature (positions, directions, tiers, modules,
recipes, every item's belt position to 3 decimals, every buffer, fuel), exported via the
**Export → text** button, `clearFactory()`, then imported via the **Import from text** button:

```
before : {ents:180, hash:3368071652, delivered:36, simTime:125.400, items:519}
after  : {ents:180, hash:3368071652, matchesOriginal:true, firstDiff:null,
          delivered:36, simTime:125.400, nets:1}
```

Byte-identical state, including items mid-belt. **pass**

### 9.2 Named slots, autosave, share code, downloads

```
save slot "testslot"  -> "testslot (180 parts · 02:05)" ; Load -> 180 structures restored
autosave              -> 12843 bytes in localStorage ; re-import -> 54 structures
Ctrl+S                -> slot "plates" created
share code            -> "FLX1:RkxYMTs3MDs1MjsxMzM3…" (3.8 KB) -> restores 180 structures,
                         grid size, contract, and the preset's deposit field
PNG export            -> fluxworks-factory.png, image/png, 314276 bytes, magic 137,80,78,71 (valid)
JSON download         -> fluxworks-units-….json, 69194 bytes, parses, app:"fluxworks"
```

Exported PNG saved to `screenshots/26-png-export.png` (full-grid render with a caption bar).

### 9.3 Import validation (hostile input)

| input | result |
|---|---|
| `not json at all` | rejected, toast, world untouched |
| `{}` | rejected |
| `{"app":"other",…}` | rejected |
| `W:-5, H:99999, ents:"nope"` | accepted, clamped to `W:10 H:400`, 0 entities |
| `type:"__proto__"`, `x:1e9`, `dir:77`, `tier:99`, `recipe:"evil"`, `items:[["nope",5]]` | `__proto__` and out-of-bounds rejected; only the 2 valid parts placed; dir→1, tier→3, bad recipe/item dropped |

`stillAlive: true`, no prototype pollution, no crash in any case. **pass**

## 10. Responsiveness and input

| viewport | canvas backing store | result |
|---|---|---|
| 1280×800 | 776×726 | desktop three-pane |
| 1600×1000 | 1096×926 | resizes live |
| 1024×700 | 520×626 | resizes live |
| 390×844 | **390×734** | mobile layout: drawer palette, bottom tool bar, compact HUD |

Production continued across all resizes (5 items delivered during the sweep, 0.305 /s, 60 FPS,
no errors). Screenshots: `22-narrow-fixed.png`, `23-narrow-palette.png`, `31-touch-narrow.png`.

Touch (see note): pinch-zoom **1.86×**, one-finger pan **3.59 tiles**, tap-to-build placed 1 pole
on the tapped tile, no console errors.

> **Note on touch fidelity.** `agent-browser` exposes mouse input, not OS touch. Touch paths were
> exercised by dispatching real `PointerEvent`s with `pointerType:'touch'` (two simultaneous
> pointer ids for the pinch) into the page, which drives exactly the same handlers as a finger.
> This is a *substitution*, not native touch hardware, and is recorded as such. Real multi-touch
> latency/gesture feel is **not-run**.

## 11. Audio

```
fresh page, before any gesture : AC === null
after a real pointer click     : AC.state "running", sampleRate 44100, masterGain 0.32
```

Signal energy measured with an `AnalyserNode` tapped off the master bus (RMS, ambient floor
0.00073):

```
click 0.0059 | build 0.0118 | delete 0.0064 | deny 0.0146
upgrade 0.0160 | deliver 0.0115 | complete 0.0204 | alarm 0.0294
```

**pass (measured)** — every interface sound is synthesised on the Web Audio graph after a user
gesture and produces real signal 8–40× above the ambient bed.

> **Honesty note:** this is an instrument reading, not a listening test. I did not hear the
> audio and make **no claim about its musical quality or timbre** — only that the graph runs and
> emits non-trivial signal for each event.

## 12. Performance

Per-preset frame times, measured with a `requestAnimationFrame` timing harness in-page
(100 consecutive frames, 4× sim speed, 1280×800):

| preset | structures | items | median | p95 | FPS |
|---|---|---|---|---|---|
| Starter Line | 54 | 41 | 16.6 ms | 17.3 ms | 60 |
| Balanced Factory | 180 | 243 | 16.7 ms | 17.8 ms | 60 |
| Congested Belts | 120 | 327 | 16.6 ms | 17.5 ms | 60 |
| Power Crisis | 178 | 111 | 16.7 ms | 17.8 ms | 60 |
| Multi-Product Bus | 221 | 291 | 16.7 ms | 17.7 ms | 60 |
| High-Throughput Stress | 246 | 314 | 16.7 ms | 17.9 ms | 60 |

| scenario | items | zoom | median frame | p95 | max | FPS |
|---|---|---|---|---|---|---|
| Stress preset, density 8, 8× speed | 827 | fit | 16.7 ms | 17.8 ms | 23.6 ms | 60 |
| 140×110 grid, 1536 belts, 12 closed loops | **9216** | 5.1 px/tile (whole world) | 16.7 ms | 17.8 ms | 18.3 ms | **60** |
| same, zoomed in to full detail | 9216 | 26 px/tile | 16.7 ms | 17.9 ms | — | 60 |

Screenshot: `screenshots/28-extreme-items.png` (9,216 items visible at once).

Robustness churn — 12 preset loads followed by 200 randomised build/delete/undo/redo/area-delete
operations:

```
{built:125, ents:299, orphanCells:0, mismatchedCells:0, uncoveredTiles:0, undo:87, redo:0}
fps 60, no errors
```

The cell↔entity invariant held exactly.

## 13. Bugs found by this validation, and their fixes

1. **Mining drill deadlock.** `updateMiner` returned before `pushOut` once the output buffer was
   full, so a drill that ever filled its buffer never emptied it and the whole line died.
   *Fix:* drain the output buffer at the top of the update, before the "wants to run" check.
   (Reproduced: chain fully stalled with `out {ironOre:12}` and empty belts downstream.)
2. **Rate metrics unusable.** Per-item rates were an EMA of bursty 0.5 s samples and swung
   0.67 → 3.9 for a steady 1.5 /s line. *Fix:* rates are now the mean of the last 8 samples (4 s);
   measured 1.5 /s now reads 1.45–1.50. Charts additionally use a centred moving average.
3. **Cold-start power deadlock.** A factory restored from a share code (layout only) had empty
   generators, so the coal drill had no power, so no coal was ever delivered — permanently dead.
   *Fix:* a Coal Generator ships with 2 coal; verified a share-code cold start now reaches
   48 delivered circuits from nothing.
4. **Share codes lost preset terrain.** `decodeShare` regenerated only the seeded deposits, so
   preset drills sat on bare ground (`no ore left`). *Fix:* deposit stamps are recorded and
   encoded in the share code. (A first fix was itself broken — decimal radii collided with the
   `.` field separator; radii are now integers ×10.)
5. **Narrow-viewport layout could not shrink.** The canvas got an explicit pixel width, which
   pinned the grid column open: at a 390 px viewport the canvas stayed 851 px and content was
   cut off. *Fix:* `min-width/min-height:0` on the grid children and `position:absolute; inset:0`
   sizing for the canvas. Verified 390×844 → canvas 390 px.
6. **Pointer capture could abort all input.** `setPointerCapture` threw for pointers the browser
   did not consider active, and the exception killed the rest of the `pointerdown` handler — no
   build, no pan, no pinch. *Fix:* wrapped in try/catch; touch paths then worked.
7. **Preset power networks were split.** *Multi-Product Bus* placed a linking pole inside a
   generator footprint (silently skipped) and *High-Throughput Stress* had a 10-tile pole gap,
   leaving the production half of both factories on a generator-less network. Also the bus belt
   runs started 5 tiles past where the machine chains actually ended, and `powerBlock` never
   stamped a coal field so its drill mined whatever happened to be underneath.
   *Fix:* moved/added poles, derived belt starts from the chain end, `powerBlock` stamps its own
   coal. Bus now delivers Automation Units (34 in 200 s); stress runs all 8 lines on one network.
8. **Zoomed-out rendering stalled.** 9,216 items cost 19.8 ms median / 154 ms worst frame.
   *Fix:* one batched stroked path per belt tier and colour-bucketed item rects below ~5 px →
   16.7 ms median / 18.3 ms max.
9. **Storage was flagged as having a broken output.** The new connection check treated a
   Storage Yard's facing as an active output port, so a yard aimed at its own unloading inserter
   reported "inserters cannot be loaded". Storage is passive (an inserter pulls from it), so it
   has no output link and no output arrow. *Fix:* excluded storage from the output-port rules.
10. **Presets ignored their contract**, so the Balanced preset made circuits while the hub counted
   iron plates and progress sat at 0 %. *Fix:* each preset declares its contract; the hub
   inspector now also lists everything it has received.

Smaller fixes made along the way: camera fit now avoids the HUD, palette compacted so every
building is reachable at 800 px height without scrolling, upgrade cost scaled to each building's
base cost (a 2¢ belt no longer costs 60¢ to upgrade), brownout reclassified as "running degraded"
rather than "stalled", storage/hub inspector rows, select-tool drag pans.

## 14. Remaining limitations and not-run items

- **Native touch hardware: not-run.** Touch was validated with synthesized `PointerEvent`s
  (§10). Gesture feel on a real device is unverified.
- **Audio timbre: not verified.** Only signal energy was measured (§11).
- **Screen-reader / keyboard-only accessibility: not-run.** The game is canvas-first; the side
  panels are real DOM controls and are reachable, but no ARIA pass was done and the canvas
  itself has no accessible alternative.
- Belts cannot cross (no underground belts or bridges); routing around obstacles is on the
  player. This is a design choice, not a defect, but it constrains dense layouts.
- The delivery hub accepts every item type; only the contract product counts toward progress.
  The hub inspector lists everything received so this is visible rather than silent.
- `localStorage` writes are wrapped in try/catch and degrade to a toast, but a browser with
  storage fully disabled was not explicitly exercised.
- The randomly seeded deposits can overlap a preset's hand-placed field, which looks busy near
  the starter line. Functionally correct (each drill reports the ore it actually sits on).
- The *High-Throughput Stress* preset intentionally has no Delivery Hub — it ends in storage
  yards — so its delivery counter stays at 0 by design. The preset description says so.
- The in-page `fps` counter can read low while the page is being hammered by rapid automation
  evals; every FPS figure in this document therefore comes from an in-page
  `requestAnimationFrame` timing harness, not from that counter.

## 15. Reproducing this run

```bash
# open the delivered artifact directly — no server
agent-browser --session fw open "file:///$PWD/index.html"
agent-browser --session fw set viewport 1280 800

# live state
agent-browser --session fw eval "JSON.stringify({ents:S.ents.size, items:S.itemCount, \
  delivered:S.delivered, sup:S.totalSupply, dem:S.totalDemand, sat:S.globalSat})"

# drive it
agent-browser --session fw click '#palette .pitem[data-build="belt"]'
agent-browser --session fw mouse move 433 316 && agent-browser --session fw mouse down
agent-browser --session fw mouse move 693 472 && agent-browser --session fw mouse up

agent-browser --session fw console      # expect empty
agent-browser --session fw errors       # expect empty
agent-browser --session fw network requests   # expect only the document
```
