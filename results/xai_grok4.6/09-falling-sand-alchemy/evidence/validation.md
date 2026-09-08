# Validation — Falling-Sand Alchemy Sandbox

Artifact: `/home/pyro/projects/naked/grok46/09-falling-sand-alchemy/index.html`  
Tooling: `agent-browser` (version-matched `skills get core --full` and dogfood overview loaded first).  
Local inspect server: `python3 -m http.server 9876 --bind 127.0.0.1` in the project directory (development only; not a runtime dependency).  
Sessions: `alchemy` (HTTP), `alchemy-file` (`file://`).

Statuses used: **pass**, **fail**, **blocked**, **not-run**.

## Environment

- Desktop viewport: 1280×800
- Narrow viewport: 390×844
- External network: `https://*` aborted after first HTTP load; `file://` session requested only the local HTML file
- Console: no application errors observed (`agent-browser console` empty on HTTP and `file://`)

## Checks

### 1. Standalone delivery / no external runtime deps — pass

- `index.html` is a single file: HTML, CSS, JS, UI, simulation, and icon are embedded.
- Grep found no `http://` / `https://` resource loads. The favicon is a `data:image/svg+xml` URI (SVG namespace is not a network fetch).
- `file://` session network log: only `GET file:///.../index.html` (200).
- HTTP session network log: document loads of `http://127.0.0.1:9876/index.html`. An earlier `favicon.ico` 404 occurred before the inline icon was added; after that fix, no app-owned remote assets.

### 2. Direct-file open — pass

Commands:

```bash
agent-browser --session alchemy-file open file:///home/pyro/projects/naked/grok46/09-falling-sand-alchemy/index.html
agent-browser --session alchemy-file wait --fn "typeof window.Athanor === 'object'"
```

Observed: `location.protocol === "file:"`, title `Falling-Sand Alchemy Sandbox`, volcano preset running, FPS 60, lava/water/stone present. After ~1.2s: steam 119, Rxn/s ≈ 17.  
Screenshots: `screenshots/22-file-protocol.png`, `screenshots/23-file-protocol-running.png`.

### 3. Default scene produces motion and interactions — pass

HTTP load at 1280×800, preset **Volcano and ocean**, seed 46.

After ~1.5s live diagnostics (`window.Athanor.counts()`):

- Lava 3897, water 3585, steam 166, stone 4077
- Steam cell sampled at `(3,1)` with temp ≈ 138°C (gas rose and persisted)
- HUD: FPS 60, grid 256×144, active ≈ 13k

Screenshot: `screenshots/02-volcano-running.png` (lava spilling into ocean, steam at the contact line).

Early bug (now fixed): heat transfer was so aggressive that lava froze to stone in a few frames. Heat exchange was damped, lava keeps an internal heat cap, and the volcano has a spillway. Retest showed persistent lava + steam.

### 4. Continuous pointer painting (solids, liquids, gases, reactives) — pass

Commands (HTTP, canvas pointer drag):

- Select Sand / Water / Oil / Wood / Fire / Salt / Metal / Electricity / Acid
- `mouse down` + move + `up` across the sky and ocean

Observed counts after strokes:

- Sand 1381 (was ~676)
- Oil 467
- Water 4104
- Later: fire 182, smoke 295, acid 341, electricity 6, ash 22, molten metal 14

Screenshot: `screenshots/03-painted-interactions.png`.

### 5. Cross-system interactions (persistent grid changes) — pass

Inspected live cell fields (`type`, `temp`, `aux`, `life`), not only pixels.

| Interaction | Evidence | Persist? |
|---|---|---|
| Lava + water → steam (+ cooled stone) | Steam 166 then 90+ remaining; steam cells with T>100 | yes |
| Fire + fuel → smoke/ash, wood consumed | Wood dropped to 6; fire 182; smoke 295; ash 22 | yes |
| Salt dissolves in water | 175 water cells with `aux>0` | yes |
| Electricity on metal | 1745 charged metal cells in Electrical lab; 137 sparks; Rxn/s 1091 | yes |
| Acid vs metal/stone | Acid factory: acid 1164, metal 1747, Rxn/s 544 | yes |
| Plant growth near water | Plant ecosystem: Plant 613 → 615 after 2.5s | yes (slow) |
| Fireworks chain | After TNT row fuse: explosives gone; smoke 8917, ash 253 | yes |

Electrical screenshot: `screenshots/10-electrical-lab.png`.  
Fireworks after fix: `screenshots/14-fireworks-chain2.png`.

First fireworks layout failed to chain (TNT piles farther apart than blast radius). Layout was changed to a continuous TNT strip with a primed fuse. Retest: explosives absent, heavy smoke — **pass after fix**.

### 6. Heat and cool tools — pass

- Heat tool dragged over the scene; many cells with T>200 (7940).
- Cool tool on ocean produced ice (2 cells) and lowered local temperature.
- First cool pass stacked to T≈−1085°C (unbounded subtract). **Fixed** by clamping cell temperature to [−90, 2500]. Not re-run as a long cool-drag after the clamp; ice formation and heat/cool HUD tool switch were observed before the clamp.

### 7. Visualization / diagnostics — pass

Switched View select through Normal, Temperature, Velocity, Density, Electrical charge, Remaining fuel, Corrosion/activity, Update order.

- Temperature: hot volcano (white/yellow) vs cooler ocean (blue). `screenshots/04-viz-temperature.png`
- Charge: dark field with conductive/charge encoding (sparse after sparks decay — matches `aux`/`Electricity` counts). `screenshots/06-viz-charge.png`
- Update order: rainbow of processed cells. `screenshots/07-viz-update-order.png`

Hover inspector reports real per-cell `T`, `life`, `aux`, `v`, `d`.

### 8. Pause, single-step, clear, reset — pass

- Pause button → HUD `PAUSED`, button text `Resume`, `window.Athanor.paused === true`
- Counts identical after 400ms while paused (`same: true`)
- Step button → counts changed while still paused
- Space on focused canvas → resumed (`pausedAfterSpace: false`, button `Pause`)
- Clear → `{Empty: 36864}` on 256×144 (full grid empty)
- Reset → volcano restored (lava/water/stone/walls)

Screenshot: `screenshots/08-paused-or-live.png`.

### 9. Save / load / autosave — pass

- `exportState()` / `importJSON()` round-trip: restored counts **identical** to pre-save snapshot
- Compact JSON written to `evidence/test-save.json` (v, w, h, preset, seed, cfg, base64 cells)
- Clear then `upload #fileIn evidence/test-save.json`: world restored (walls/wood/oil/stone/explosive/ash on 320×180)
- `localStorage` autosave + **Load autosave** restored a non-empty volcano/building snapshot
- **Save JSON** button clicked (browser download). Harness did not capture a downloaded filename on disk.

PNG: **Export PNG** uses `canvas.toDataURL('image/png')`. Eval on `file://` returned `data:image/png;base64,` (~38 KB). Button click was issued; downloaded file path not found in `/tmp` by a bounded search (a full-home `find` was aborted). Treat file-picker download as **pass** for generation, with on-disk download location **not independently confirmed**.

### 10. Stress test and performance — pass

Preset **Dense stress-test**: ~30,943 active cells, Rxn/s 1290, HUD FPS 60.  
Screenshot: `screenshots/13-stress-test.png`.  
Resolution 320×180 also held FPS 60 on the burning-building preset.

### 11. Other presets — pass

| Preset | Observed |
|---|---|
| Acid factory | acid, metal, water, salt, stone; Rxn/s 544 |
| Steam engine | water, fire, smoke, lava, metal boiler; Rxn/s 194 |
| Frozen lake | ice 762, water 19049, fire camp, plants |
| Burning building | wood 2425, fire 121, smoke 366, oil, TNT |
| Electrical laboratory | metal grid + traveling electricity |
| Plant ecosystem | wet sand/water + growing plants |
| Fireworks chain reaction | after fix, full detonation to smoke/ash |

Screenshot example: `screenshots/17-burning-building.png`.

### 12. Eyedropper, fill, explosion, wind, gravity — pass

- Eyedropper on lava cell (screen 410,315): selected material **Lava**, tool returned to **Paint**. `screenshots/15-eyedropper-fill.png`
- Walls box + Fill/Water: wall 796→2006, water 3574→4166 (enclosed fill wrote cells)
- Explosion tool on lava: fire/smoke appeared
- Wind tool stroke applied
- Gravity **Up**: lava/sand counted in the upper half (`high: 136`); restored to Down

### 13. Keyboard — pass

`]` increased brush radius (HUD/tools showed radius 8 after repeats). Space toggled pause on desktop and mobile. N/step covered via the Step button (N bound in page code; Step button exercised).

### 14. Desktop 1280×800 layout — pass

`screenshots/01-desktop-load.png`, `02-volcano-running.png`. Side palettes + canvas + HUD readable. No horizontal overflow noted.

### 15. Narrow 390×844 layout — pass (after fix)

First mobile pass: canvas height ≈ 94px (`screenshots/18-mobile-390x844.png`). Painting at y=350 missed the canvas. **Fail then.**

CSS changed: stage `min-height: 38vh`, smaller palette/dock. Relayout canvas ≈ 390×321 at y=279–600.  
Painted sand 676→1814. Space paused.  
Screenshots: `screenshots/20-mobile-relayout.png`, `21-mobile-painted.png`.

### 16. Console / failed requests — pass with note

- No JS exceptions in `agent-browser console` / `errors`
- HTTP: document 200s; pre-fix favicon.ico 404 (fixed with inline icon)
- `file://`: single document request, empty console

## Fixes applied during validation

1. Heat diffusion too strong → lava instantly became stone. Reduced transfer, lava heat cap, slower freeze.
2. Volcano had no spillway / floating plants. Reworked geometry so lava reaches water; plants on beach.
3. Reaction HUD showed 0 most frames. Overlay now reports Rxn/s.
4. Fill tool had a leftover broken BFS loop. Replaced.
5. `SNOW` identifier in frozen-lake preset would throw. Removed.
6. Eyedropper/fill/bomb were repeating on pointer-move. Limited to pointerdown.
7. Fireworks piles too far apart to chain. Continuous TNT strip + primed fuse.
8. Cool tool unbounded. Clamp temperatures.
9. Mobile canvas crushed by sidebars. Give stage a minimum height.
10. Missing favicon 404. Inline data-URI icon.

## Remaining limitations

- Plant growth is real but slow (single-digit new cells over a few seconds).
- Electrical-charge view is dim once sparks decay; that matches cell `aux`, not a render fake.
- PNG **button** generates a PNG data URL; the downloaded filename was not captured by this harness.
- Autosave interval is ~10s; explicit **Load autosave** was what we verified end-to-end.
- Default grid is 256×144 (60 FPS with ~13k active). 320×180 / 480×270 are selectable; the densest stress scene was run at 256×144.

## Screenshot index

All under `evidence/screenshots/`.

| File | What it shows |
|---|---|
| 01-desktop-load.png | First desktop load |
| 02-volcano-running.png | Lava/ocean/steam |
| 03-painted-interactions.png | Painted acid/fire/oil |
| 04-viz-temperature.png | Temperature diagnostic |
| 05-viz-velocity.png | Velocity diagnostic |
| 06-viz-charge.png | Charge diagnostic |
| 07-viz-update-order.png | Update-order diagnostic |
| 08-paused-or-live.png | Transport controls |
| 09-plant-ecosystem.png | Plant preset |
| 10-electrical-lab.png | Electricity on metal |
| 11-fireworks.png | First fireworks (weak chain) |
| 12-fireworks-chain.png | Intermediate fireworks |
| 13-stress-test.png | Dense stress scene |
| 14-fireworks-chain2.png | Successful TNT chain |
| 15-eyedropper-fill.png | Eyedropper lava + fill |
| 16-explosion-wind-gravity.png | Explosion/wind/gravity |
| 17-burning-building.png | Burning building |
| 18-mobile-390x844.png | Mobile before layout fix |
| 19-mobile-painted.png | Mobile paint miss (pre-fix) |
| 20-mobile-relayout.png | Mobile after layout fix |
| 21-mobile-painted.png | Mobile paint success |
| 22-file-protocol.png | file:// load |
| 23-file-protocol-running.png | file:// with steam |
