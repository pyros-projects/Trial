# Validation — Real-Time 2D Fluid Simulation (Cistern)

Artifact: `/home/pyro/projects/naked/grok46/01-fluid-simulation/index.html`  
Tooling: `agent-browser` (Chromium/CDP) plus a temporary `python3 -m http.server 8877` for HTTP inspection.  
Date: 2026-09-07

This file is agent-authored evidence. It is not an evaluator score report.

## How the app was exercised

1. Opened the delivered file directly: `file:///home/pyro/projects/naked/grok46/01-fluid-simulation/index.html`
2. Set viewports `1280x800`, `390x844`, and `1280x800` at device pixel ratio 2
3. Used labeled controls (`#btn-pause`, `#btn-reset`, `#btn-clear`, `#viz-mode`, sliders) plus trusted mouse drags on the canvas
4. Used keyboard shortcuts Space / C / R / 1 / 2
5. Read live diagnostics from `window.__FLUID__.getStatus()` and `window.__FLUID__.stats()` (GPU downsample of dye luminance and velocity magnitude)
6. Repeated the main flow over HTTP at `http://127.0.0.1:8877/` with `https://*` aborted
7. Inspected `errors --json`, `console --json`, and `performance.getEntriesByType('resource')`

Screenshots live in `evidence/screenshots/`.

## Required public checks

| Check | Result | Evidence |
| --- | --- | --- |
| Slow pointer drag injects dye and momentum; flow persists and follows drag | **pass** | Before drag `dyeMean=0.026`, `velMean=0.010`. After slow drag `dyeMean=0.072`, `velMean=0.081`. Screenshot `04-slow-drag.png` shows a bright cyan injection plume and cursor ring. |
| Rapid / continuous drag responds to speed and direction, with mixing | **pass** | Zigzag drag raised `dyeMean` to `0.256` and `velMean` to `0.245`, coverage `0.937`. Screenshot `05-rapid-drag.png`. |
| Visualization modes switch while the sim keeps running | **pass** | Sequential `#viz-mode` changes dye → velocity → speed → pressure → divergence → vorticity → dye. `paused=false` throughout; `simSteps`/frames kept increasing (`3015` → `3106`). Screenshots `06-mode-*.png`. HUD mode label tracked each switch. |
| Viscosity change produces observable behavior difference | **pass** | Same seeded start, ~1.6s evolution. Viscosity `0`: `velMean` `0.283 → 0.347` (+23%), coverage `0.53 → 0.70`. Viscosity `1`: `velMean` `0.277 → 0.290` (+5%), coverage `0.53 → 0.66`. High viscosity also ran fewer steps in wall time because of extra diffusion iterations (`47` vs `63`). Screenshots `12-viscosity-low.png`, `13-viscosity-high.png`. |
| Vorticity change produces observable behavior difference | **pass** | Vorticity `0`: `velMean` `0.271 → 0.310` (+14%). Vorticity `40`: `velMean` `0.271 → 0.344` (+27%) over a similar step count (`53` vs `52`). Screenshots `14-vorticity-zero.png`, `15-vorticity-high.png`. |
| Clear dye removes dye and does **not** reset velocity | **pass** | Paused, then Clear dye: `dyeMean` `0.106 → 0`, `dyeCoverage` `0.821 → 0`, `velMean` unchanged at `0.09405977668845317`. Dye view went empty (`09-after-clear.png`); velocity view still showed a colored plume (`10-clear-dye-velocity-remains.png`). Keyboard `C` later reproduced dye wipe with velocity retained (`velMean=0.311`). |
| Pause / resume | **pass** | Pause froze `simSteps` at `731` across 0.45s; HUD `Paused`, button `Resume`, paused badge visible (`07-paused.png`). Resume advanced `simSteps` to `743` and restored button `Pause`. Space key also toggled pause. |
| Reset restores a valid initial state | **pass** | After reset: `simSteps=9`, `dyeCoverage=0.533`, `velMean=0.287`, seeded multi-color swirl visible (`11-reset.png`). Keyboard `R` reproduced the seeded dye/velocity state. |
| Desktop viewport 1280×800 | **pass** | `viewW/H=1280×800`, canvas full-bleed, controls readable, fluid visible (`03-desktop-seed-fresh.png`). |
| Narrow viewport 390×844 | **pass** | `view=[390,844]`, panel moved to the bottom (`panelBottom=8px`). Drag still injected dye (`coverage 0.54 → 0.72`). Hide collapsed the panel to a compact bar (`18-narrow-390x844.png`, `19-narrow-drag.png`, `20-narrow-collapsed.png`). |
| High-DPI | **pass** | `set viewport 1280 800 2` produced `viewW=2560`, `viewH=1600`, `dpr=2` (`21-retina-dpr2.png`). |
| Direct `file://` open, no external assets | **pass** | `file://.../index.html` ran the solver (`__FLUID__` present, dye coverage ~82% on a fresh seed). `index.html` contains no `http(s)`, `fetch(`, `import`, or CDN URLs. |
| Local HTTP with external internet blocked | **pass** | `http://127.0.0.1:8877/` with `network route "https://*" --abort`. App ran, `performance` resource list was `[]`, errors/console empty, drag still increased dye/flow (`22-http-local.png`, `23-http-drag.png`). |
| Console / uncaught errors on a clean session | **pass** | Fresh HTTP session: `errors: []`, `console.messages: []`. An earlier `file://` session had stale errors from mid-development (`frame is not defined`, synthetic `setPointerCapture`); those were fixed and did not reproduce on the clean session. |
| Audio | **not-run** | No audio in the application. |

## Fixes applied after the first failed observations

1. **Black canvas / dyeCoverage 0 after load.** Float textures were created with `LINEAR` filtering that did not actually stick, leaving the default mipmap min-filter and incomplete sampling. Textures now always get a valid `NEAREST` or confirmed `LINEAR` filter, and advection uses `texelFetch` bilinear sampling.
2. **Seed dye vanished after ~10s.** Dye dissipation `0.006` per step (~70% remaining per second) was too aggressive. Defaults are now velocity `0.004` / dye `0.001`.
3. **`getStatus()` threw `frame is not defined`.** A later edit replaced `let frame` instead of adding `simSteps`. Both counters exist again.
4. **Synthetic pointer tests threw `setPointerCapture`.** Capture is wrapped in `try/catch` so untrusted events still splat. Trusted mouse drags were already working.
5. **Invalid color-input parse could zero the dye color.** `hexToRgb` now keeps the previous color on a bad parse. Setting `#ff3355` via `input`/`change` produced `[1, 0.2, 0.333]` and a visible pink/red stroke (`16-red-dye.png`).

## Commands used (representative)

```bash
python3 -m http.server 8877 --bind 127.0.0.1
agent-browser --session fluid open "file:///home/pyro/projects/naked/grok46/01-fluid-simulation/index.html"
agent-browser --session fluid set viewport 1280 800
agent-browser --session fluid mouse move 340 430
agent-browser --session fluid mouse down left
# ... interpolated moves ...
agent-browser --session fluid mouse up left
agent-browser --session fluid click "#btn-pause"
agent-browser --session fluid click "#btn-clear"
agent-browser --session fluid click "#btn-reset"
agent-browser --session fluid select "#viz-mode" "velocity"
agent-browser --session fluid set viewport 390 844
agent-browser --session fluidhttp network route "https://*" --abort
agent-browser --session fluidhttp open "http://127.0.0.1:8877/"
```

Live field stats were read with `window.__FLUID__.stats()` after real interactions, not from hardcoded sequences inside the page.

## Remaining limitations

- Headless Chromium without a strong GPU reported about **21–46 FPS** while simulating at 256² velocity / 512² dye with 20 pressure iterations. Pause-only rendering reached ~60 FPS. This is a software-GL measurement, not a functional failure.
- Native `input type=color` is not exposed as an interactive snapshot ref; it is labeled in the DOM and works when its value is set and `input`/`change` fire. `agent-browser fill` once wrote an unusable value; the parser no longer collapses that to black dye.
- Aborting all `http://*` also blocked the local server (`net::ERR_FAILED`). The HTTP check was repeated with only `https://*` aborted, which is the intended “block external, keep local” setup.
- Velocity/speed diagnostic views are intentionally dark when flow energy is very low; they light up after interaction (see `10-clear-dye-velocity-remains.png`).

## Screenshot index

| File | What it shows |
| --- | --- |
| `01-file-desktop-load.png` | First load before filtering fix (canvas looked empty) |
| `02-file-desktop-seed.png` | After texelFetch fix, faded dye still present |
| `03-desktop-seed-fresh.png` | Fresh seed, rich mixing, 82% dye coverage |
| `04-slow-drag.png` | Slow pointer injection |
| `05-rapid-drag.png` | Rapid zigzag injection |
| `06-mode-*.png` | Dye / velocity / speed / pressure / divergence / vorticity |
| `07-paused.png` | Pause badge, Resume control |
| `08-before-clear.png` / `09-after-clear.png` | Dye present vs removed |
| `10-clear-dye-velocity-remains.png` | Velocity visualization after dye clear |
| `11-reset.png` | Seeded initial swirl restored |
| `12-viscosity-low.png` / `13-viscosity-high.png` | Viscosity comparison |
| `14-vorticity-zero.png` / `15-vorticity-high.png` | Vorticity comparison |
| `16-red-dye.png` | Custom dye color after pointer stroke |
| `17-res-128.png` | Resolution change to 128 |
| `18-narrow-390x844.png` / `19-narrow-drag.png` / `20-narrow-collapsed.png` | Mobile layout and hide |
| `21-retina-dpr2.png` | High-DPI backing store |
| `22-http-local.png` / `23-http-drag.png` | HTTP session with HTTPS blocked |
