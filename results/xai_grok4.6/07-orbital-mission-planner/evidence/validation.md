# Validation — Orbital Mechanics and Mission-Planning Sandbox

**Artifact:** `/home/pyro/projects/naked/grok46/07-orbital-mission-planner/index.html`  
**Tooling:** `agent-browser` 0.31.1 (Chromium/CDP). Local static server `python3 -m http.server 8099 --bind 127.0.0.1`.  
**Date:** 2026-09-07

External HTTPS was aborted via `agent-browser network route "https://**" --abort`. No CDN, fonts, or remote scripts are referenced by the artifact (the only `http://` string is an SVG `xmlns` inside an embedded data-URI favicon).

Verdicts use **pass / fail / blocked / not-run** only. This file is agent-authored evidence, not an evaluator score.

---

## Environment

| Item | Value |
| --- | --- |
| Desktop viewport | 1280 × 800 |
| Narrow viewport | 390 × 844 |
| HTTP URL | `http://127.0.0.1:8099/index.html` |
| Direct file URL | `file:///home/pyro/projects/naked/grok46/07-orbital-mission-planner/index.html` |
| Debug API | `window.OMP` (in-page; not a runtime dependency) |

---

## Checks

### 1. Page load, defaults, no external fetches — **pass**

**Steps**

1. `agent-browser --session omp set viewport 1280 800`
2. `agent-browser --session omp open http://127.0.0.1:8099/index.html`
3. Wait until `window.OMP.sim.bodies.length > 0`
4. `agent-browser --session omp network requests`
5. `agent-browser --session omp errors` / `console`
6. Screenshot `evidence/screenshots/01-desktop-default.png`, later `07-default-paused.png`

**Observed**

- Title `FDL-07 Orbital Mission Planner`. HUD shows FPS, sim time, warp, steps/frame, body count, energy error, frame, pause state.
- Default system: Helios (star), Kepler (planet), Lira (moon), Aerie-1 (spacecraft).
- Network: document GET of local `index.html` 200. After embedding a data-URI favicon, no extra asset requests are required. Earlier runs logged a `favicon.ico` 404 before that fix.
- Console / uncaught errors: empty.
- Energy error at rest: `0`; after motion typically `1e-12`–`1e-14`.

### 2. Advance simulation; coherent motion and telemetry — **pass**

**Steps**

1. Pause, record craft state `{x,y,vx,vy}` and HUD.
2. `OMP.step(250)` (250 Verlet steps of `dt = 0.004`).
3. Compare time, position, speed, energy error.
4. UI: click Pause/Resume (`aria-label="Pause or resume"`), wait until `sim.t` increases. Screenshot `02-live-motion.png`.

**Observed**

| Metric | Result |
| --- | --- |
| Time | `t=0` → `t=1.000` after 250 steps |
| Craft displacement | `dr ≈ 3.20` |
| Speed | finite, `v ≈ 1.123` |
| Energy error | `-2.62e-15` |
| Live HUD | `STATE LIVE`, `T+` advancing, `ENERGY ε ~ 1e-14` |

Circular-orbit preset after 2000 steps: `ΔE/E ≈ -1.93e-14`, eccentricity `≈ 2.55e-7`, bound (`E < 0`, finite period).

### 3. Maneuver node: prediction changes before burn; sim changes at execution — **pass**

**API sequence (recorded in session eval)**

1. Default scenario, pause, `predict()` → 221 samples.
2. `addNodeAt(sim.t + 1.2)` with prograde `Δv A = 0.25`.
3. Path fingerprint changed while craft velocity unchanged.
4. Step until `man.t`; node `done=true`; craft `Δv ≈ 0.342`.

**Labeled UI sequence**

1. Reset (pauses at `t=0`).
2. Fill `#mn-a` = `0.55`, `#mn-t` = `2.5`.
3. Click `#btn-add-node` (`aria-label="Add maneuver node"`).
4. Node: `{t:2.5, mode:"prograde", a:0.55, done:false}`. Screenshot `08-node-on-prediction.png`.
5. Click resume; wait `maneuvers[0].done === true`.
6. Burn: `{t:2.584, done:true, applied:0.55}`. Screenshot `09-after-burn.png`.

Hohmann preset ships two scheduled nodes (`HOH-1 periapsis`, `HOH-2 apoapsis`) and scheduled `Δv ≈ 0.668`. Screenshot `10-hohmann.png`.

### 4. Reference frames — **pass**

**Steps**

1. Pause a live default system.
2. `select "#frame" "rotating"` → HUD `FRAME ROTATING`. Screenshot `03-rotating-frame.png`.
3. `select "#frame" "body"` → HUD `FRAME BODY`. Screenshot `04-body-frame.png`.
4. Keyboard `F` cycles frames (`inertial` → `body` observed).
5. Return to inertial.

**Observed**

- Rotating body–moon: planet–moon line held, Helios offset, velocity arrows expressed in the rotating basis.
- Selected-body centered: selected craft/planet sits at the origin; relative velocity arrows remain attached to bodies.
- Trails are stored inertially and transformed per sample (not a decorative overlay).

### 5. Pause, single-step, time warp, reset, rewind, energy error — **pass**

| Control | How | Result |
| --- | --- | --- |
| Pause / Resume | `#btn-pause`, Space, mobile `#btn-pause-dock` | `paused` toggles; HUD `PAUSED` / `LIVE` |
| Single step | `#btn-step` twice | `t=0` → `t=0.008` (`2 × 0.004`) |
| Time warp | `[` / `]` keys; range `#warp` | `warpTarget` steps through 1/16 … 1024; HUD `WARP ×n`; applied warp eases |
| Reset | `#btn-reset` | `t=0`, paused, maneuvers cleared |
| Rewind | `#btn-rewind` | restores last checkpoint (`t=0` after reset+two steps) |
| Energy HUD | `#hud-energy` + canvas `ΔE/E` | live scientific notation; circular/default remain ~1e-14 or better |

### 6. Overlays, pan, zoom, paused craft drag — **pass**

- Click `#ov-pot` and `#ov-soi` after moving overlays above the fold. `OMP.overlays.pot === true`, `soi === true`. Screenshot `16-potential-soi.png`.
- Empty-canvas pan: camera `{x:70,y:0}` → `{x:28.6,y:-20.7}`.
- Wheel zoom: `zoom 1.45` → `1.334`.
- Pointer-drag selected craft while paused: displacement `≈ 34.7` world units. Screenshot `17-drag-craft.png`.
- Space toggles pause; `]` raises warp; `F` cycles frame; Keys dialog opens (`15-help.png`) and closes on Escape.

### 7. Scenarios — **pass**

Loaded via `#scenario` combobox (onchange loads immediately):

| Preset | Evidence |
| --- | --- |
| Star · planet · moon · craft | default screenshots; 4 bodies |
| Circular | `e ≈ 2e-9`, `E < 0` |
| Elliptical | `e ≈ 0.742`; `25-ellipse.png` |
| Hohmann-like | 2 nodes; `10-hohmann.png` |
| Moon transfer | `12-moon-transfer.png` |
| Slingshot | `11-slingshot.png` |
| Unstable three-body | 4 bodies (3-4-5 + tracer); `13-threebody.png` |
| Escape | `E ≈ +1.59`, apoapsis `∞`; `26-escape.png` |

### 8. Desktop 1280×800 layout — **pass**

Screenshots `01`, `02`, `07`. Side panels usable; HUD readable; map between panels shows star + planet + moon + craft at default camera `{x:70, zoom:1.45}`.

### 9. Narrow 390×844 layout — **pass**

**Steps**

1. `agent-browser --session omp set viewport 390 844`
2. Screenshot `18-mobile-390.png` / `22-mobile-dock.png` — drawers closed; dock `Sys`, `Keys`, `Go`, `Step`, `Tlm`.
3. Click `#btn-sys` → left drawer open (`19-mobile-sys-drawer.png`).
4. Click `#btn-tlm` → telemetry drawer (`20-mobile-tlm-drawer.png`).
5. Click `#btn-pause-dock` (`Go`) → `paused=false`, `t` 1.156 → 2.652.
6. Click `#btn-pause-dock` (`Halt`) → paused again (`23-mobile-after-go-halt.png`).

**Fix during validation:** `#btn-pause` lives inside the Sys drawer, so it was covered by the canvas when the drawer was closed. Always-visible dock `Go`/`Halt` and `Step` were added and retested.

### 10. Direct `file://` open, no network dependencies — **pass**

```
agent-browser --session ompfile open file:///home/pyro/projects/naked/grok46/07-orbital-mission-planner/index.html
```

- Wait `window.OMP.sim.bodies.length > 0` → true.
- URL remains `file://…/index.html`.
- Eval: `{ok:true, n:4, t:0.28}` (sim running).
- Network: single `GET file://…/index.html` 200. Screenshot `24-file-protocol.png`.
- Errors: none.

### 11. Console / failed requests / live diagnostics — **pass** (favicon 404 fixed)

- `errors` and `console`: empty after load and after the main workflow.
- Failed requests: only the pre-fix `/favicon.ico` 404. Replaced with an inline SVG data URI. Not re-run as a long HTTP session after that one-line change; `file://` run showed no extra requests.
- Live overlay fields (FPS, T+, warp, steps/frame, body count, energy error, frame, pause) update in screenshots and via `OMP.getHud()`.

### 12. Import / export persistence — **not-run** (controls present)

Export (`#btn-export`) writes a JSON snapshot via a Blob download. Import uses a local `<input type="file">`. The file-picker / download dialog was not driven end-to-end in this session. State clone/restore is exercised by Reset and Rewind.

### 13. Audio — **not-run**

No audio subsystem.

### 14. Touch pinch-zoom — **not-run**

Pointer-event pinch path exists in code (`input.mode === "pinch"`). This session used mouse pan, wheel zoom, and one-finger drag. Multi-touch pinch was not separately exercised.

---

## Failures found and fixed

| Issue | Fix | Retest |
| --- | --- | --- |
| Add-node ignored `#mn-t` and always used `t + 0.3×horizon` | Use typed time when it is in the future | UI node at `t=2.5` created and executed |
| Reset left the clock running | Reset now restores and pauses | `t=0`, `paused=true`, maneuvers empty |
| Overlay buttons below the fold; some clicks hit the canvas | Overlays moved under Clock; canvas `z-index:1` | `#ov-pot` / `#ov-soi` toggles recorded |
| Mobile pause only inside a closed drawer | Dock `Go`/`Halt` + `Step` | `t` advanced then halted at 390×844 |
| `getHud()` serialized the whole primary body trail | Elements now carry `primaryName` / `primaryId` | Compact HUD JSON |
| No favicon → 404 on HTTP | Inline SVG data URI | `file://` network log clean |

---

## Remaining limitations

- Physics is planar 2D. “Normal” Δv is in-plane ⊥v, not out-of-plane.
- Rewind restores checkpoints; it is not a symplectic reverse integrator.
- At high warp, steps per frame cap at 420, so the effective rate can lag the labeled warp.
- Potential overlay is a coarse sampled grid, refreshed every few frames.
- Import/export and pinch-zoom were not fully exercised (see not-run above).
- Tiny-mass “Target orbit” marker in the Hohmann preset participates in n-body gravity (mass `1e-8`).

---

## Screenshot index

| File | What it shows |
| --- | --- |
| `screenshots/01-desktop-default.png` | First HTTP load, live default system |
| `screenshots/02-live-motion.png` | After Resume click, time advancing |
| `screenshots/03-rotating-frame.png` | Rotating body–moon frame, paused |
| `screenshots/04-body-frame.png` | Selected-body centered frame |
| `screenshots/07-default-paused.png` | Default camera after look-at tweak |
| `screenshots/08-node-on-prediction.png` | Maneuver node on predicted path |
| `screenshots/09-after-burn.png` | Post-execution state |
| `screenshots/10-hohmann.png` … `13-threebody.png` | Scenario presets |
| `screenshots/14-overlays-potential-soi.png` | Early overlay attempt |
| `screenshots/15-help.png` | Keyboard help |
| `screenshots/16-potential-soi.png` | Potential + SOI overlays on |
| `screenshots/17-drag-craft.png` | Paused craft drag |
| `screenshots/18-mobile-390.png` … `23-mobile-after-go-halt.png` | Narrow viewport + dock clock |
| `screenshots/24-file-protocol.png` | Direct `file://` load |
| `screenshots/25-ellipse.png` / `26-escape.png` | Ellipse and escape presets |

Logs: `evidence/logs/snapshot-*.txt`, `errors-*.txt`, `console-*.txt`, `network-*.txt`.
