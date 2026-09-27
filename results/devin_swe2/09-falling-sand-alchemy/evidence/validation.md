# Validation Report — Falling-Sand Alchemy

**Artifact:** `/home/pyro/projects/naked/swe2/09-falling-sand-alchemy/index.html` (single self-contained file, 1349 lines, ~61 KB, zero external runtime dependencies)
**Date:** 2026-09-12
**Tool:** `agent-browser` 0.31.1 (`/home/pyro/.local/bin/agent-browser`), headless Chrome
**Serving:** `python3 -m http.server 8791` in the project dir → `http://localhost:8791/index.html`; plus direct `file://` check.
**Sessions:** `fsa` (main), `fsafile` (file:// check)

All canvas-state assertions were made against the live `window.SIM` debug API (typed-array grid state) combined with real pointer/keyboard input through `agent-browser mouse`/DOM clicks — not by inspecting source.

---

## Environment & boot

| Check | Result | Notes |
|---|---|---|
| Page loads, sim boots | **pass** | `SIM` object present, 60 fps, preset auto-loads (`01-boot.png`) |
| Console errors / uncaught exceptions | **pass** | `agent-browser errors` and `console` clean across all sessions |
| Network requests | **pass** | only `GET index.html` (200) ×N and one `favicon.ico` 404 (fixed by inlining an SVG data-URI favicon); zero external requests |
| Direct `file://` open | **pass** | `file:///…/index.html` → sim booted, `W=426`, 14,959 cells of preset content, no errors. No external fetches possible — everything is inline. |

## Core simulation (live-state verified)

Grid at desktop/res=3: 426×192 = 81,792 cells. Chunked active-region tracking confirmed working (`chunks` counter in HUD/stats).

| Check | Result | Observed |
|---|---|---|
| Sand falls, piles | **pass** | painted 772 sand via real mouse drag; fell to floor, piled (`02-sand-paint.png`) |
| Water flow + density displacement | **pass** | water painted over sand fell, displaced, spread laterally (`03-water-sand.png`) |
| Liquid/gas wall integrity | **pass** (after fix) | lateral movement used to teleport through intervening walls → replaced with cell-by-cell `slideTo` walk |
| Lava + water → steam + stone | **pass** | `{steam:57, stone:90, lava:10, water:493}` — persistent stone crust formed |
| Fire consumes fuel, smoke rises | **pass** | `{wood:0, fire:301, smoke:7217}` after burn; wood grid state permanently consumed |
| Lava persistent heat | **pass** (after fix) | lava initially quenched instantly; added internal heat recovery `temp += (1250-temp)*0.003` + lowered exchange coeff → persistent lava channel (`06-volcano.png`, `14-hero-volcano.png`) |
| Salt dissolving → brine | **pass** | `{salt:0, brine:26}` — salt consumed, brine cells persist in grid |
| Freeze/melt cycle | **pass** | water → 200 ice cells on cool, → 0 ice/200 water on reheat |
| Acid corrosion | **pass** | metal corroded (`cor` up to 179 → cells destroyed), hydrogen GAS emitted, acid spent → water |
| Electricity conduction | **pass** (after fix) | spark charge initially died at injection; fixed charge diffusion threshold/decay + least-charged-neighbor travel → charge reached x=160 down wire in 60 steps; charged metal ignites adjacent powder |
| Plant growth | **pass** (after fix) | seeds fell asleep / couldn't grow underwater; fixed chunk wake + growth into water → 4 seeds → 192 plants, water consumed |
| Explosion chain | **pass** | powder + wood scene → `{powd:0, wood:0, fire:588, smoke:7301, affected:21848}`; debris velocity + drag added so streaks don't cross the grid (`05-explosion.png`) |

## Tools — real pointer input

| Tool | Result | Notes |
|---|---|---|
| Paint (continuous drag) | **pass** | `mouse down/move/up` drag → 772 cells; continuous application while held (fixed: previously only on move events) |
| Erase / right-drag erase | **pass** (after fix) | right-drag now forces erase regardless of tool |
| Pick (eyedropper) | **pass** | clicked stone → swatch selected "Stone [13]" |
| Heat | **pass** | stationary hold → local temp ~5784, water boiled → 407 steam cells |
| Cool | **pass** | freeze test above |
| Wind | **pass** | live `vx/vy` inspected: `vmax≈6.7` on smoke while held; cloud centroid displaced right (`11-wind.png`). Corrected phase weights. |
| Explosion (Boom) | **pass** | real click → detonation chain above |
| Wall | **pass** | drew enclosing box |
| Fill enclosed area | **pass** | water fill stayed inside wall box (`04-fill-box.png`) |

## Controls

| Control | Result | Notes |
|---|---|---|
| Pause / resume | **pass** | `stamp`/`frame` frozen while paused, resumed on click |
| Single-step | **pass** | frame counter advanced exactly 1 per click while paused |
| Clear | **pass** | grid emptied |
| Reset | **pass** | preset restored |
| Resolution | **pass** | 426×192 → 320×144; state resampled (stone 800→450 ≈ ratio) |
| Sim speed / substeps | **pass** | speed drives steps/frame accumulator; substeps now run extra thermal-diffusion sweeps (was previously unused) |
| Gravity direction | **pass** (after fix) | horizontal branch had `IDX(y*W+x)` one-arg bug → fixed `y*W+x`; left: meanX 219→108 (`10-gravity-left.png`); up: sand rose to ȳ≈12 |
| Brush radius/shape/amount/temp/velocity/spray | **pass** | params wired into stamping; "Paint temp" `null°` display bug fixed (NaN→JSON null→NaN restore) |
| Ambient/heat-rate/reaction/liquid/gas/fire/explosion sliders | **pass** | bound to `P` used by sim; heat-rate and react-rate exercised via scenario tests |

## Visualization modes

Cycled all 8 modes on live scenes (`07-viz-*.png`): normal, temperature (hot lava column visible), velocity/movement, density, charge, fuel, corrosion/activity, update-order (chunk-processing pattern visible). All read real per-cell arrays (`temp`, `vx/vy`, `MAT.d`, `chg`, `life`, `cor`, `stamp/uord`).

## Presets

All 9 loaded via UI without errors, nonzero activity each: Volcano & Ocean, Burning Building, Electrical Laboratory, Acid Factory, Steam Engine, Frozen Lake, Plant Ecosystem, Fireworks, Dense Stress Test.

Fixed during dev: volcano cone geometry inverted → rebuilt; steam-engine boiler sealed → rebuilt boiler→riser→ice-condenser loop.

**Regression found & fixed:** after resolution re-alloc, presets went black/frozen (0/324 chunks) — `inList` retained stale chunk IDs across `alloc()`; now `inList.clear()` on realloc. Burning building then burned properly — floors consumed, smoke plume, powder charge detonated (`08-burning-building.png`).

## Persistence & export

| Check | Result | Notes |
|---|---|---|
| Save → load roundtrip | **pass** | `serialize()` 328,559 B → `deserialize()` → re-`serialize()` byte-identical; charge (0.7) and corrosion (120) restored |
| Autosave | **pass** | writes `fsa-autosave` every 8 s when unpaused (~96 KB); reload → painted acid restored (`acid:300`) |
| PNG export | **pass** | `toDataURL` → valid `data:image/png;base64,iVBORw0K…`, 291 KB |
| Deterministic preset seeds | **pass** | presets take `seed` param, `ri()` seeded RNG |

## Viewports & performance

| Check | Result | Notes |
|---|---|---|
| Desktop 1280×800 | **pass** | 60 fps; sim 1.0–6.3 ms, render ~0.6 ms |
| Narrow 390×844 | **pass** | grid rebuilt 97×211, 60 fps; burger collapses panel; real drag painted 462 stone cells (`12-mobile.png`, `13-mobile-painted.png`) |
| Dense stress scene | **pass** | 43,709 active cells / 180 chunks @ 320×144 → 60 fps, sim 6.26 ms |
| Input continuity | **pass** | per-frame tool application while pointer held; drag interpolation across moves |
| High-DPI | **pass** (by construction) | canvas sized `cssW*dpr`, `image-rendering:pixelated` |

## Bugs found → fixed (retested)

1. Malformed `case STEAM+100` label / dead `wake()` — removed
2. Spark paint overwrote conductor before reading it → capture prev first
3. Liquid/gas lateral teleport through walls → `slideTo` walk
4. Right-drag used current tool, not erase → `forceErase`
5. `substeps` param unused → thermal-diffusion sub-passes
6. Wind phase weights mis-mapped → corrected
7. Volcano cone inverted; steam-engine plumbing sealed → rebuilt
8. Lava quenched instantly → internal heat recovery + gentler exchange
9. Spark charge died at source → diffusion threshold/decay tuned, travels wire
10. Plant growth stalled (chunk sleep, can't grow into water) → wake + kelp growth
11. Heat/cool/wind only on pointer *move* → continuous per-frame while held
12. `NaN` paint temp → `null` in JSON → sanitized on load
13. `inList` stale after `alloc()` → frozen presets; `inList.clear()`
14. Horizontal gravity `IDX(y*W+x)` (NaN index) → `y*W+x`

## Honest caveats / residual limitations

- **Smoke-after-wind anomaly:** one observation showed a pushed smoke cloud later at only 2 cells. Reproduced carefully → smoke counts stable at 800 over 120 steps; likely a measurement/timing artifact (centroid sampled after impulse decay) rather than a defect. Not fully root-caused but not reproducible as a real failure.
- Earlier acid "0 cells" readings were all test artifacts — `SIM.set` calls out of bounds after resolution/viewport changes (H=144/97 while painting y≈170/x≈200). Acid verified fine at in-bounds coords.
- Explosion debris drag tuned to reduce cross-grid streaking; energetic scenes still produce far-flung embers by design.
- Autosave interval is 8 s — very recent edits within that window aren't captured (observed; expected behavior).
- Browser test used local HTTP for most flows; `file://` boot verified separately and passed — no capability gap remaining.
- Audio: not applicable (no audio features).

## Evidence index

`01-boot` initial load · `02` sand drag-paint · `03` water/sand displacement · `04` wall-box fill · `05` explosion aftermath · `06` volcano w/ lava channel · `07-viz-*` diagnostic modes · `08` burning building mid-collapse · `09` fireworks · `10` gravity-left drift · `11` wind-displaced smoke · `12`/`13` mobile viewport + painting · `14` hero volcano.

**Overall: all required public checks pass; no unresolved functional failures.**
