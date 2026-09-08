# Validation — Storm Glass (3D Weather and Storm Laboratory)

Artifact: `/home/pyro/projects/naked/grok46/18-weather-storm-lab/index.html`  
Tooling: installed `agent-browser` skill (core workflow loaded via `agent-browser skills get core --full`) plus a temporary `python3 -m http.server 8918 --bind 127.0.0.1`.  
Date: 2026-09-08

This file is agent-authored evidence. It is not an evaluator score report.

Live field numbers were read from `window.StormLab.getDiagnostics()`, `means()`, `sample()`, and `column()` after real UI and pointer actions. Sequences are not hard-coded inside the page.

## How the app was exercised

1. Opened `http://127.0.0.1:8918/` and `file:///home/pyro/projects/naked/grok46/18-weather-storm-lab/index.html`
2. Viewports `1280×800`, `390×844`, and `1280×800` at device pixel ratio 2
3. Labeled controls: Pause/Resume, Step, Reset, Lightning, preset/viz/camera/quality/grid/layers selects, Heat / Inject moisture tools, pointer mode, seed
4. Pointer: orbit drag on the WebGL canvas, wheel zoom, map click to place a probe, map drag to paint
5. Keyboard: Space toggles pause
6. HTTP session with `network route "https://*" --abort`; later `set offline on`
7. Inspected `errors --json`, `console --json`, and `performance.getEntriesByType('resource')`

Screenshots live in `evidence/screenshots/`. Logs live in `evidence/logs/`.

## Required public checks

| Check | Result | Evidence |
| --- | --- | --- |
| Storm preset; wind, moisture, temperature, cloud water, precipitation evolve | **pass** | Default **Mountain rain**. t0 steps=9: `T=0.792`, `qv=0.185`, `qc=0.0166`, `qr=0.00188`, cloud 11.8%, precip Σ 10.87. After ~2.5s wall time, steps=64: `T=0.763`, `qv=0.150`, `qc=0.0165`, `qr=0.00018`, cloud 15.6%, precip Σ 18.99. Not a fixed texture. Screenshots `01-desktop-mountain.png`, `02-evolved-fields.png`. |
| Inject heat and moisture; alter wind; delayed cloud/rain response | **pass** | Paused, `applyBrush` heat+moist+seed at (16,12): `T 1.075→1.427`, `qv 0.327→0.711`, `qc 0→0.264`. Real map drag with **Inject moisture**. Wind impulse: `u 0.54→3.17`, `v -0.08→0.88`. After resume, precip Σ `8498→8856` while steps `737→764`; cloud cover stayed elevated (~52%). Screenshot `06-lightning-brush.png`. |
| At least four diagnostic modes and a vertical/point probe | **pass** | Probe placed via API `(12,10)` and via map click `(11,18)` with column readout (T, qv, qc, qr, wind, p/buoy). Viz screenshots: temp, humid, cloud, precip, pressure, hwind, vert, vort, terrain, surface (`05-viz-*.png`). Map and column/slice canvases track the same fields. |
| Trigger or observe lightning | **pass** | Manual `#btn-lightning`: `bolts=1`, `flash=0.86`, jagged bolt visible in `06-lightning-brush.png`. Automatic path on squall after ~12s sim: `flash=0.104` while `bolts=0` (bolt mesh already expired; flash still decaying). Cover 76%, updraft 1.64. Screenshot `22-auto-lightning.png`. Thunder is synthesized with Web Audio after that click; **sound quality was not heard**. |
| Orbit and zoom the camera | **pass** | Left-drag orbit (`07-orbit.png`) and wheel zoom (`08-zoom.png`). Camera preset **Storm chase** changed eye height/angle (`09-camera-chase.png`). |
| Pause and single-step | **pass** | Pause froze `steps=126` across 0.4s; button **Resume**, HUD paused. Step advanced `126→127` while still paused. Resume set `paused=false`, button **Pause**. Space also toggled pause. Screenshot `03-paused.png`. |
| Change quality or resolution while running | **pass** | Running 24×24×12 → Quality **Draft** 16×16×8, `paused=false`, steps still increasing (`10-quality-draft.png`). Then grid **32²** while running → 32×32×8 (`11-res-32.png`). |
| Reset the same seed | **pass** | Seed 1847, paused, Reset twice. Field hashes identical (`T`, `qc`, `h`, `u`, `qv`) at `steps=0`, `time=0`. Screenshot `12-reset-seed.png`. |
| Narrow viewport 390×844 | **pass** | `innerWidth/Height=390×844`. Panel docked to bottom (`maxHeight≈354px`); map/slice lifted to `bottom≈362px` so they stay visible. Heat brush still applied. Screenshots `16-narrow-390x844.png`, `17-narrow-brush.png`. |
| Offline / no external assets | **pass** | `index.html` has no `fetch(`, `import`, or `https://` (SVG xmlns only in the data-URI favicon). HTTP with `https://*` aborted: `performance` resource list `[]`, app ran (`19-http-offline-https-abort.png`). `set offline on` still advanced steps (129). Direct `file://` ran WebGL2, `StormLab` present, resources `[]` (`20-file-protocol.png`). |
| Desktop 1280×800 | **pass** | Canvas buffer `1088×680` at render scale 0.85. Terrain, orographic cloud, HUD, and panel readable (`01-desktop-mountain.png`, `15-desktop-regression.png`). |
| High-DPI | **pass** | `set viewport 1280 800 2` → `dpr=2` (`18-hidpi-dpr2.png`). |
| Console / uncaught errors | **pass** | Fresh HTTP and `file://` sessions: `errors: []`, `console.messages: []`. Logs in `evidence/logs/`. |
| Save/load and invalid import | **pass** | `exportState`/`importState` roundtrip succeeded. `{nope:true}` → `Unrecognized state file`; missing fields → `Fields missing or non-finite`. App stayed alive. PNG export: `canvas.toDataURL` prefix `data:image/png;base64,` length 866690. |
| Audio | **pass** (trigger only) | Lightning click is a user gesture and starts a delayed Web Audio noise burst. Quality was **not** heard; not claimed. |

## Commands used (representative)

```bash
python3 -m http.server 8918 --bind 127.0.0.1
agent-browser skills get core --full
agent-browser --session storm2 open "http://127.0.0.1:8918/"
agent-browser --session storm2 set viewport 1280 800
agent-browser --session storm2 wait --fn "window.StormLab && window.StormLab.getDiagnostics().steps>2"
agent-browser --session storm2 screenshot evidence/screenshots/01-desktop-mountain.png
agent-browser --session storm2 click "#btn-pause"
agent-browser --session storm2 click "#btn-step"
agent-browser --session storm2 select "#sel-viz" "temp"
agent-browser --session storm2 select "#sel-preset" "squall"
agent-browser --session storm2 click "#btn-lightning"
agent-browser --session storm2 mouse move 420 360; mouse down left; mouse move 600 300; mouse up left
agent-browser --session storm2 select "#sel-quality" "draft"
agent-browser --session storm2 select "#sel-res" "32"
agent-browser --session storm2 set viewport 390 844
agent-browser --session stormfile open "file:///home/pyro/projects/naked/grok46/18-weather-storm-lab/index.html"
agent-browser --session stormhttp network route "https://*" --abort
agent-browser --session stormhttp open "http://127.0.0.1:8918/"
```

Eval diagnostics:

```js
window.StormLab.getDiagnostics()
window.StormLab.means()
window.StormLab.sample(i,j,k)
window.StormLab.applyBrush(x,y,tool,r,s)
window.StormLab.placeProbe(i,j)
window.StormLab.exportState() / importState(obj)
```

## Fixes applied after failed observations

1. **Shader compile failure (`sampler3D` precision).** Cloud shader now declares `precision highp sampler3D` / `sampler2D`. Fatal overlay no longer shows on Chromium WebGL2.
2. **Wind direction 0 treated as missing.** `params._wdir \|\| 270` sent westerly mountain flow to 270° in the UI. Uses nullish checks now; mountain preset shows 0°.
3. **3D cloud texture layout.** Volume is uploaded as `(i,j,k)` so the raymarcher samples `texture(uVol, vec3(u,w,v))`.
4. **Volume format.** Switched `RG8` packing to `RGBA8` for broader WebGL2 support.
5. **`setPointerCapture` on synthetic events.** Wrapped in `try/catch` so untrusted tests still paint.
6. **Precip Σ exploded** after summing every raining cell. Accumulator is now domain-mean rainfall.
7. **Narrow viewport hid the map** under the bottom sheet. Insets sit above `42vh` on small screens.
8. **Invalid JSON used `alert()`.** Import failures write a sticky HUD warning instead.
9. **Automatic lightning almost never fired.** Rate now scales with cloud cover, updraft, and condensate; a squall run left a decaying `flash` after a spontaneous bolt.

## Remaining limitations

- Headless / software GL typically reports **~20–28 FPS** at Balanced 24×24×12 with 40 raymarch steps. Draft and Adaptive drop render scale. This is a performance measurement, not a functional failure.
- Automatic lightning bolts last a fraction of a second; the auto-lightning screenshot caught residual flash rather than the polyline. Manual trigger was photographed with a visible bolt.
- Thunder delay/amplitude were scheduled in Web Audio after a click; **no claim that thunder was heard**.
- Terrain is a modest heightfield mesh; clouds are stylized volumes driven by `qc`, not a NWP-grade scheme.
- `localStorage` remembers last quality/render scale, so a prior Draft session can load with a lower buffer than the HTML defaults. A clean profile still starts Balanced mountain rain.
- Probe CSV and JSON downloads were verified through the in-page exporters / `exportState`; the browser did not write those downloads into `evidence/` besides `bad-state.json`.

## Screenshot index

| File | What it shows |
| --- | --- |
| `01-desktop-mountain.png` | Default mountain rain, orographic cloud, HUD, 1280×800 |
| `02-evolved-fields.png` | Same preset after fields evolved |
| `03-paused.png` | Paused HUD and Resume button |
| `04-probe.png` | Probe (12,10) with column readout |
| `05-viz-*.png` | Diagnostic visualization modes |
| `06-lightning-brush.png` | Manual lightning bolt + rain after moisture brush |
| `07-orbit.png` / `08-zoom.png` | Camera orbit and zoom |
| `09-camera-chase.png` | Storm-chase cinematic camera |
| `10-quality-draft.png` / `11-res-32.png` | Quality and grid changed while running |
| `12-reset-seed.png` | Reset to seed 1847 |
| `13-squall.png` / `14-cyclone.png` | Presets configure fields (line convection / eye) |
| `15-desktop-regression.png` | Post-fix mountain default |
| `16-narrow-390x844.png` / `17-narrow-brush.png` | Narrow layout and brush |
| `18-hidpi-dpr2.png` | High-DPI buffer |
| `19-http-offline-https-abort.png` | Local HTTP, external HTTPS aborted |
| `20-file-protocol.png` | Direct `file://` open |
| `21-arrows-squall.png` | Wind arrows / squall |
| `22-auto-lightning.png` | Squall after spontaneous lightning flash |
