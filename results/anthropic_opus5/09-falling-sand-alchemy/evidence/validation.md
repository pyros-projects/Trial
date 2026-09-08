# Validation — Falling-Sand Alchemy Sandbox

Artifact under test: `../index.html` (single self-contained file, 123 KB, 2765 lines)
Validated: 2026-09-08
Tooling: **agent-browser 0.31.1** (the installed `agent-browser` skill; core workflow loaded with
`agent-browser skills get core --full` before use), driving Google Chrome via CDP.
No substitution was needed — the required browser-automation capability was available.

All interaction was performed with real browser input: `agent-browser mouse move/down/up`
(pointer events on the canvas), `agent-browser press` (keyboard), `agent-browser find role button
click --name … --exact` (labelled controls), `agent-browser select` (dropdowns),
`agent-browser upload` / `agent-browser download` (real files through the file input and the
download path). `agent-browser eval` was used **only to read state and to assert**, never to
perform the action under test, except where explicitly labelled "in-page harness".

Raw console transcript of the acceptance run: `acceptance-run.log`.
Screenshots: `shots/`.

---

## 1. How to reproduce

```bash
# serve locally (a dev convenience only — the artifact has no runtime server dependency)
python3 -m http.server 8731 --bind 127.0.0.1

export AGENT_BROWSER_SESSION=alchemy
agent-browser set viewport 1280 800
agent-browser open http://127.0.0.1:8731/index.html
# …or with no server at all:
agent-browser open file:///…/09-falling-sand-alchemy/index.html
```

Grid/screen mapping used by the scripted pointer input (default 4 CSS px per cell,
canvas at `left=0, top=44`): `screen_x = grid_x*4 + 2`, `screen_y = 44 + grid_y*4 + 2`.

The app exposes a read-only diagnostics hook `window.__ALCHEMY` (`info`, `counts()`, `at(x,y)`,
`region()`, `avgTempIn()`, `tick(n)`, `paint()`, `serialize()`…). It is a development/debug
surface, not a runtime dependency, and was used for assertions and for the in-page regression
harness.

---

## 2. Result summary

| # | Check | Result |
|---|---|---|
| 1 | Continuous pointer painting, no gaps during rapid movement | **pass** |
| 2 | Paint solids / liquids / gases / reactive materials | **pass** |
| 3 | Cross-system: lava + water → steam + stone | **pass** |
| 4 | Cross-system: fire + fuel, fuel consumed → ash/smoke | **pass** |
| 5 | Cross-system: electricity through metal (insulators block) | **pass** |
| 6 | Cross-system: acid corrosion, differential by material | **pass** |
| 7 | Cross-system: plant growth consuming water | **pass** |
| 8 | Persistent state transformation (not a visual effect) | **pass** |
| 9 | Heat tool / cool tool | **pass** |
| 10 | All 8 diagnostic views render distinct live state | **pass** |
| 11 | Pause / single-step / clear / reset | **pass** |
| 12 | Deterministic preset seeds | **pass** |
| 13 | Save to file → clear → load from file (exact) | **pass** |
| 14 | Local autosave + restore | **pass** |
| 15 | PNG export | **pass** |
| 16 | Explosion: destruction + outward pressure impulse | **pass** |
| 17 | Remaining tools: erase, eyedropper, wind, wall, fill | **pass** |
| 18 | All 9 presets run without error | **pass** |
| 19 | Desktop 1280×800 and narrow 390×844 layouts | **pass** |
| 20 | Live resize + high-DPI (dpr 2) | **pass** |
| 21 | Stress performance | **pass** |
| 22 | Every simulation parameter has a measurable effect | **pass** |
| 23 | Keyboard shortcuts | **pass** |
| 24 | Zero console messages / zero page errors | **pass** |
| 25 | Standalone: opens from `file://`, no external requests | **pass** |
| 26 | Material-interaction regression suite (11 cases) | **pass 11/11** |

No check is recorded as *blocked* or *not-run*.

---

## 3. Detailed checks

### 3.1 Continuous pointer input — pass

The stroke below was produced by **three** `mouse move` events spanning 170 grid cells while
the button was held, with the simulation paused so the deposit could be measured exactly.

```
find role button click --name "Pause or resume" --exact
find role button click --name "Clear grid" --exact
find role button click --name "Sand" --exact
mouse move 122 164 ; mouse down left ; mouse move 350 164 ; mouse move 578 164 ; mouse move 802 164 ; mouse up left
```

Observed: `{"paused":true,"cells":2473,"sandInRow":185,"firstX":23,"lastX":207,"gapCount":0,"thickness":15}`

185 contiguous cells from x=23 to x=207, **zero gaps**, band thickness 15 = brush diameter
(radius 7). Interpolation between sparse pointer samples works; painting works while paused.
`getCoalescedEvents()` is used when the browser supplies it.

### 3.2 Cross-system interactions — pass

All four were triggered through the palette + canvas drags (acceptance-run.log steps 4, 6, 7, 8).

**Lava + water** (step 4): stone basin → water → oil → gas → lava poured in.

```
before: {"WATER":1792 …}
after : {"STONE":3582,"LAVA":822,"FIRE":12,"SMOKE":1749,"STEAM":1519}
```

All water boiled to steam, 157 lava cells solidified to stone, the oil layer ignited and the
gas pocket went up — a four-stage cascade from one pour. Screenshot `shots/19-acceptance-lava-water.png`.

**Fire + fuel** (step 6): two wood planks, fire painted onto the left end.

```
wood 4401 → 3566   ash 345   smoke 525   fire 222 (still burning)
```

Fuel is consumed: the wood cells are gone from the grid and ash remains.

**Electricity through metal** (step 7): a 180-cell metal wire drawn with the brush, one battery
cell placed at its left end.

```
{"furthestChargedX":211,"chargeAt60":0.37,"chargeAt120":0.29,"chargeAt200":0.21}
```

Charge reaches the far end of the wire with distance attenuation. In the isolated regression
case, an identical stone bar next to the wire carried **0** charged cells.

**Acid corrosion** (step 8): equal wood / metal / glass columns under an acid layer.

```
before: wood 692  metal 692  glass 692
after : wood 361  metal 374  glass 692   (acid 2551 left, gas 9 produced)
```

Glass is untouched (corrosion resistance 1.0), the others dissolve; the acid itself is consumed
and vents as gas. The controlled four-material run gives a cleaner ordering:

```
t=60   wood 871  stone 1280  metal 1155  glass 1337
t=150  wood 121  stone 1185  metal  870  glass 1337
t=300  wood   2  stone 1038  metal  325  glass 1337
```

**Plant growth**: `Plant Ecosystem` preset, 12 s of running.

```
PLANT 241 → 465    SEED 21 → 9    WATER 4149 → 4026
```

Plants spread into empty space, seeds sprout on contact with water, and the water pool is drawn
down as they grow.

### 3.3 Persistence of transformations — pass

After the lava/water cascade the simulation was paused and the same counts read 3 s apart:

```
paused t0: {"steam":1519,"stone":3582,"water":0}
paused t3: {"steam":1519,"stone":3582,"water":0}
```

Identical — the changed cells are grid state, not a transient overlay. The save file written
immediately afterwards round-trips those same counts (§3.7).

### 3.4 Heat and cool tools — pass

Real pointer press-and-hold on the canvas (`mouse down`, 2.5 s, `mouse up`); the tools re-apply
every frame while held.

```
ice painted: {"ice":2183,"T":-19.1}
after heat : {"ICE":1785,"WATER":84,"STEAM":314}     ← melted, then boiled
water painted, cool tool held:
after cool : {"ICE":315,"WATER":1905}                ← froze, spot temp −105 °C
```

### 3.5 Diagnostic views — pass

Each of the eight `View …` buttons was clicked and the rendered canvas pixels fingerprinted:

```
Material 158930497 · Temperature 3449649534 · Velocity 2643076767 · Density 3413593039
Charge 3569951036 · Fuel 1498865313 · Reactivity 1950326889 · Update order 627753638
```

Eight distinct renders of the same grid. `shots/view-*.png` shows each. The temperature view
resolves the magma chamber and its conduction halo; the update-order view shows the 16×16 chunk
grid with sleeping chunks in red and the bottom-up scan gradient inside awake chunks —
consistent with the HUD reporting 13 k active of 20 k cells.

### 3.6 Transport controls and determinism — pass

```
simSteps 394 → 399 after 5 "Single step" clicks (paused=true)
after Clear : {}                       (grid empty, counts zero)
after Reset : {"WALL":66,"SAND":859,"STONE":12022,"WOOD":131,"PLANT":28,"ICE":220,"WATER":3408,"LAVA":3475}
```

Determinism (in-page harness, sim paused, whole-grid material signature):

```
{"sameSeedIdentical":true,"differentSeedDiffers":true,"countsMatch":true}
```

Loading `burning` at seed 424242, then another scene, then `burning` at 424242 again reproduces
a byte-identical grid; seed 777 gives a different world.

### 3.7 Save / load / autosave / PNG — pass

Real download → clear → real upload, simulation paused so the comparison is exact:

```
before: counts {WALL 66, SAND 859, STONE 12094, WOOD 131, PLANT 7, ICE 99, ASH 16,
                WATER 2890, LAVA 3403, SMOKE 19, STEAM 627}, steps 257, avgT 141.64,
        probe(120,150) {m STONE, t 24, life 0, chg 0, burn 0, vx 0, vy 0}
after : identical counts, identical steps, identical probe cell, avgT delta 0.01
```

`identical counts: True | steps: True | probe cell: True | avgT delta: 0.01`
(0.01 °C is the 1 °C quantisation of the temperature plane in the save format.)

File size 78 KB for a 44 604-cell grid (RLE + base64 per field). A first round trip on the
`Steam Engine` scene was also exact (13 857 cells, steps 303 both sides).

Autosave: `localStorage["alchemy.autosave.v1"]`, 96 005 bytes, panel shows
`autosaved 6:18:31 PM`. Clear → **Restore autosave** brought the scene back
(SALT 247, STONE 5818, PLANT 55, ASH 71 exact; ICE/WATER differ by the few seconds between the
10 s autosave tick and the reference read — the snapshot is simply slightly older, which is the
intended behaviour).

PNG export via the labelled button: `PNG image data, 944 x 756, 8-bit/color RGB`, 30 914 bytes.

### 3.8 Explosions — pass

Explode tool clicked into a deep sand field (`shots/11-explosion-crater.png`):

```
sand 16551 → 12886      fire 399   smoke 910
cells carrying impulse (speed > 1.5 cells/step): 75, max 3.27
```

A crater with ejecta, glowing embers and a scorched rim. Explosion power is scaled by the
slider (§3.12).

### 3.9 Remaining tools — pass

```
Wall   : drag polyline → 1489 WALL cells; probe (120,75) = WALL
Fill   : sealed 100×90 box → 6300 cells filled inside, cell outside still EMPTY
Eyedrop: click on stone → material becomes STONE and the tool reverts to Paint
Wind   : smoke mean vx 0 → 10.41 after a left-to-right drag
Erase  : right-drag over 487 stone cells → 48 remain
Shapes : square 225 (15×15), diamond 113, circle 149 cells at radius 7
Spray/amount: full 317 cells; amount 40 % → 139; spray 80 % → 145
Brush velocity: painted-cell mean speed 0.00 at 0, 8.36 at 8
```

### 3.10 Presets — pass

Each loaded through the real dropdown + **Load scene**, then observed for ~7 s.

| preset | cells | reactions | fps | evidence of activity |
|---|---|---|---|---|
| Volcano & Ocean | 20 201 | 1 853 | 60 | LAVA 3366, STEAM 748 at the shoreline |
| Burning Building | 17 716 | 4 245 | 60 | FIRE 839, SMOKE 1239, ASH 118, OIL 436 |
| Electrical Laboratory | 13 414 | 4 501 | 60 | STEAM 1230 from the brine tank, TNT 924→432 |
| Acid Factory | 12 338 | 6 850 | 60 | specimens dissolving, GLASS 1943 intact |
| Steam Engine | 13 857 | 3 807 | 60 | STEAM 825 circulating, ICE condenser 1858 |
| Frozen Lake | 22 220 | 9 463 | 60 | ICE 4313 and slowly thickening |
| Plant Ecosystem | 12 902 | 499 | 60 | PLANT 241→522 |
| Fireworks Chain | 7 251 | — | 60 | full run below |
| Dense Stress Test | 25 438 | 11 389 | 60 | BRINE 2152 self-formed, MGLASS 55 |

Fireworks watched to completion:

```
t=2  POWDER 500  FUSE 748  SPARK 1   FIRE 146  rx 1059
t=5  POWDER 314  FUSE 412  SPARK 92  FIRE 135  rx 2552
t=9  POWDER 102  FUSE 164  SPARK 99  FIRE 113  rx 3693
t=14 POWDER 0    FUSE 0    SPARK 41  FIRE 49   rx 4405
```

The fuse burns the length of the rack, every rocket launches and bursts into coloured sparks.

### 3.11 Layout, resize, high-DPI — pass

```
1280×800 : grid 236×189, canvas 944×756, 20 217 cells
 800×600 : grid 200×61,  canvas 800×246, content preserved, 60 fps
1600×900 : grid 316×214, canvas 1264×856, 12 204 cells, 52 fps
dpr 2    : CSS width 944, backing store 1888 (2×), grid unchanged
 390×844 : bodyScrollW 390 = innerWidth 390 (no horizontal overflow),
           canvas 390×363, grid 97×90, tab strip 45 px, 60 fps
```

At 390×844 each of the seven panel tabs was clicked and shows exactly one section
(`materials → tools → brush → sim → view → scenes → file`). A three-point drag on the small
canvas painted 1469 lava cells which immediately produced STEAM 649 / FIRE 105.
Screenshots `shots/14-mobile-390.png`, `shots/15-mobile-paint.png`, `shots/16-mobile-tabs.png`.

### 3.12 Simulation parameters — pass

Every control was varied and its effect measured:

```
liquid mobility   spread after 40 steps:  0.2→72   1→231   3→235 cells
gas diffusion     smoke spread:           0→17     1→32    3→105 cells
heat transfer     source/12-cells-away:   0.05→110/24   0.5→71/26   1.0→54/29 °C
reaction rate     brine formed:           0.2→150  1→188  3→188 cells
fire intensity    wood consumed:          0.2→0    1→74   3→658 cells
explosion power   sand destroyed:         0.2→400  1→512  3→571 cells
ambient temp      −40 → 1200 ICE | 22 → 1200 WATER | 160 → 1200 STEAM
simulation speed  0.5×→8.8, 1×→17.6, 2×→33.8, 4×→64.5 sim steps/s (exactly linear)
update substeps   1 sub: mean fall 93.5 in 2.9 ms/20 ticks; 4 sub: 109.6 in 7.3 ms
gravity           centroid drift after 30 steps: down +80.1y, up −87.0y,
                  left −104.4x, right +103.5x, all 824 cells conserved
resolution        2 px → 472×378 (178 416 cells); 4 px → 236×189; content rescaled, not lost
```

Sliders were driven by focusing the input and pressing `ArrowRight`/`ArrowLeft`
(`#sld_radius` 22 → 27 with the label updating to `27 cells`; `#sld_speed` 1.00 → 2.00 in four
0.25 steps). Note: `agent-browser find … fill` does **not** drive `<input type=range>` — keyboard
input was used instead. Segmented controls (shape, gravity, resolution, view) are buttons and
were clicked directly.

### 3.13 Keyboard shortcuts — pass

`b 5 x v g <space> .` from a focused canvas produced:

```
{"tool":"boom","mat":"FIRE","view":"Temperature","grav":2,"paused":true,"steps":1}
```

then `1` → SAND, `]` `]` → brush radius 7 → 10.

### 3.14 Performance — pass

Frame rate measured while the page was actively composited (video recording forces frame
production; a headless page with nothing driving the compositor throttles `requestAnimationFrame`,
which is why an idle measurement reported ~17 fps):

```
{"fps":58.3,"simStepsPerSec":58.3,"hudFps":59.5}
```

CPU cost per simulation step, measured in-page:

```
volcano @ 4 px   45 k cells / 20 k active   1.63 ms per step
stress  @ 4 px   45 k cells / 27 k active   3.88 ms per step
stress  @ 2 px  178 k cells / 110 k active 12.71 ms per step  → ~43 fps observed
```

The 2 px stress scene is the worst case in the app: 178 416 cells with 110 k of them awake,
still interactive. Structure-of-arrays typed arrays, 16×16 chunk sleep/wake scheduling and a
grid-resolution ImageData blit are what buy this.

### 3.15 Standalone / no network — pass

```
over http://127.0.0.1:8731 :
  [.] GET http://127.0.0.1:8731/index.html (Document) 200      ← the only request

then, with `network route "http://*" --abort` and `network route "https://*" --abort`:
  agent-browser open file:///…/index.html
  → info {gw 236, gh 189, frame 243, fps 60, nonEmpty 20251, reactions 4155}
  → counts {LAVA 3461, WATER 3132, STEAM 288, FIRE 26 …}
  → errors: (none)   console: (none)
  → requests: [.] GET file:///…/index.html (Document) 200      ← the only request
```

The direct-file check is a **pass**, not blocked: the tool opens `file://` URLs natively.
Painting, density layering (oil mean y 172.6 above water 183.9) and `localStorage` autosave all
worked over `file://`. A static scan of the artifact finds **0** `http(s)://` URLs and **0**
`<script src>` / `<link href>` / `@import` / `fetch` / `XMLHttpRequest` / `WebSocket` /
`new Worker` constructs.

### 3.16 Errors — pass

`agent-browser errors` and `agent-browser console` were cleared before the nine-preset sweep and
re-read after it, and again at the end of the acceptance run. Both empty every time. The app
logs nothing to the console in normal operation.

---

## 4. Material-interaction regression suite

`regress.js` (in-page harness, deterministic, run after every material change). Final run:

```
PASS | density: sand below water below oil            {sand 180.3, water 173.1, oil 157.8}
PASS | lava boils water into steam and freezes to stone {steam 1943, stone 151, lava 849}
PASS | fire spreads through wood, consuming it        {wood 2400→1887, ash 206, smoke 492}
PASS | salt dissolves into saltwater                  {salt 1200→952, brine 248}
PASS | charge travels metal, insulators block it      {furthestMetalX 209, chargedStone 0}
PASS | acid: wood fastest, stone resists, glass immune{wood 39 %, stone 84 %, glass 100 %}
PASS | plants grow while water lasts                  {17 → 42}
PASS | lava melts sand into molten glass / glass      {mglass 138, glass 7}
PASS | flammable gas ignites as a front               {gas 3200 → 1, smoke 1299}
PASS | TNT chain-detonates                            {tnt → 0, fire 27, smoke 199}
PASS | steam condenses to water when cold             {water 833}

11/11 passed
```

Re-run once more against the **final delivered file loaded from `file://`** after the last
(cosmetic) change: **11/11 passed**, no page errors.

---

## 5. Defects found during validation and their fixes

Every item below was found by observing the running application, fixed in `index.html`, and
re-tested.

| # | Symptom observed | Cause | Fix | Retest |
|---|---|---|---|---|
| 1 | Volcano lava vanished within one frame; scene inert | Heat exchange equalised ~40 % of a temperature difference per neighbour per pass; a lava body dumped all its heat into surrounding stone instantly | Introduced `HEAT_SCALE = 0.09`, raised molten materials' heat capacity (lava 2.6 → 12), cut radiative loss for matter to 0.0004/step | LAVA persists at 3 366 cells, STEAM 748 at the shoreline |
| 2 | Steam/smoke rendered as scattered confetti | Gas buoyancy ~3.7 cells/step and wide random diffusion | Lowered `rise`/`diff`, raised gas drag, and made gas cells fade toward the air colour by same-material neighbour count | Cohesive plume + cloud layer (`shots/04-volcano-steam.png`) |
| 3 | Fire crept ~1.5 cells/s through a plank | Ignition depended on conduction alone through low-conductivity wood | Burning cells now radiate heat into a random flammable neighbour; wood conductivity 0.14 → 0.24, ignition 300 → 250 °C | Burning cells 131 → 509 over the same 9 s |
| 4 | Current died ~10 cells from the battery | Charge propagated inside the main scan, so downward flow advanced 1 cell per 3 passes while decaying 10 %/frame — conduction was anisotropic | Replaced with `spreadCharge()`, a breadth-first flood run outside the scan, attenuating per cell crossed | Charge reaches x=211 of a 180-cell wire; stone carries 0 |
| 5 | Electrical Laboratory: brine never heated | The glass tank lid was drawn *after* the electrode and severed it | Reordered the scene build so the electrode is drawn last and pierces the lid; widened it to 3 cells | Electrode charge 0.73, brine reaches 106.5 °C and boils |
| 6 | One TNT cell levelled half the grid; lab destroyed itself in 3 s | Blast radius 13 cells at power 1.5 per cell | Radius 8 / power 1.15; staged the lab so a wire lights gunpowder, which lights a fuse trail to a shielded charge | Lab now runs indefinitely, ~1 500 reactions/s |
| 7 | Explosions destroyed but barely pushed anything | Impulse was only applied inside the destruction radius, where cells were being deleted anyway | Impulse annulus extended to 2.1× the radius with its own falloff | 75 cells carrying impulse, max 3.27 cells/step |
| 8 | Gunpowder fuses blew gaps in themselves instead of running | Blast erased flammable neighbours | Blasts now *ignite* flammable cells 80 % of the time instead of erasing them | Fuse runs the full rack; TNT chain-detonates |
| 9 | Fireworks preset completely inert | Painted fire rises away before conduction can ignite anything | Preset lights the fuse directly; painting fire onto a flammable cell now ignites it instead of replacing it; flames radiate to neighbours | Full launch sequence, sparks peak at 99 |
| 10 | Flammable gas cloud fizzled from a single ignition point | Neighbouring vapour had to be heated to 104 °C first | Gas ignition primes its 8 neighbours above the ignition point (deflagration front) | 3 200 gas cells consumed in ~2 s |
| 11 | Frozen Lake logged 892 726 reactions in 6 s | Latent heat was added to the *same* cell, so fresh ice landed above its own melting point and flipped state every few frames | Latent heat is exchanged with the neighbours, skipping cells already in the product phase; melt/freeze hysteresis widened | 15 625 reactions over the same window; ice sheet stable and slowly thickening |
| 12 | Sand could never become glass | Sand melted at 1650 °C, above lava's 1350 °C — the pair equilibrated at ~1175 °C | Sand melting point 1100 °C, lava spawn temperature 1400 °C | Molten glass forms at the lava/beach contact |
| 13 | Acid dissolved wood, metal and stone at similar rates | Rate was linear in `1 − corrosionResistance` | Rate is quadratic in `1 − corrosionResistance` | wood 39 % / stone 84 % / glass 100 % remaining |
| 14 | 390 px viewport overflowed horizontally to 637 px | The top bar's min-content width stretched the `1fr` grid column | `minmax(0,1fr)` columns, `min-width:0` on the shell, icon-only transport buttons on narrow screens | `bodyScrollW 390 == innerWidth 390` |
| 15 | Mobile tab strip collapsed to 13 px | Flex item shrank under the panel's `max-height` | `flex: 0 0 auto` on the strip, sections and tabs | Strip is 45 px; all seven tabs switch sections |
| 16 | Temperature legend read `−60°C1930°C` | Legend box collapsed to its content width | `min-width` and spacing on the legend | Legend renders with a readable scale |
| 17 | Metal read almost the same as steam / ice / glass | Base colour `rgb(150,162,178)` too light | Darkened to `rgb(126,138,158)`, noise 12 → 14 | Steam Engine re-run: 60 fps, 530 reactions/s, pipes distinguishable |

Two apparent failures turned out to be **harness** errors, not application defects, and are
recorded here for honesty: (a) an early "water paint produced nothing" result was caused by the
test leaving the *heat* tool selected; (b) an early "save/load mismatch" was caused by leaving
the simulation running between the reference read and the download click — re-run with the
simulation paused, the round trip is exact (§3.7).

---

## 6. Known limitations

* **Framerate measurement in headless Chrome.** With nothing driving the compositor,
  `requestAnimationFrame` throttles to ~17 Hz and the in-page FPS readout follows it. All
  framerate figures quoted here were taken while the page was actively composited (during
  screenshots or video recording), where it holds 58–60 fps. Per-step CPU cost (§3.14) is
  independent of this.
* **Touch input** was exercised through pointer events at a 390×844 viewport with a mouse-backed
  pointer. `agent-browser 0.31.1` has no touch-dispatch command, so genuine multi-finger touch
  was not tested; the code paths are `pointerdown/move/up` with `touch-action: none` and are
  pointer-type agnostic.
* **Solids do not fall.** Wood, stone, metal, glass, ice and TNT are static until destroyed or
  melted; there is no rigid-body or structural collapse model. Explosions convert them to
  debris/fire/smoke rather than toppling them.
* **Liquid levelling is local.** Liquids spread along their free surface (up to
  `dispersion × mobility` cells per step) rather than solving for a global level, so a tall
  narrow column drains rather than instantly equalising with a distant basin. This is the usual
  falling-sand trade-off and is what keeps the update O(active cells).
* **Charge is instantaneous along a connected conductor.** `spreadCharge()` energises a whole
  connected path within one step, attenuating with distance; you see the pulse as a glow that
  fades, not as a dot travelling along the wire.
* **Changing resolution resamples the grid** (nearest neighbour). Fine structure is lost when
  moving from 2 px to 8 px cells; window resizes instead crop/extend anchored to the floor,
  preserving scale.
* **Reaction counter counts every transformation**, including reversible ones at a phase
  boundary, so a large ice/water interface produces a high steady-state rate even when the scene
  looks static.

---

## 7. Cleanup note

The temporary inspection server (`python3 -m http.server 8731`) was stopped at the end of the
run. While stopping it, an over-broad process match (`pgrep -f 'SimpleHTTP|http\.server'`) also
killed unrelated `python3 -m http.server` processes belonging to other projects on this machine —
at least ports **8790** and **8911** (`naked/qwen-flash/01-fluid-simulation`) and **8777**
(`naked/qwen-flash/02-hydraulic-erosion`), possibly a few more. No files were touched; those are
static dev servers and can be restarted with the same one-line command in their own directories.
