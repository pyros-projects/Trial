# Validation — Black Hole and Gravitational Lensing Explorer

Artifact: `/home/pyro/projects/naked/grok46/05-black-hole-lensing/index.html`  
Tooling: `agent-browser` (version-matched `skills get core` + dogfood workflow), local `python3 -m http.server 8766 --bind 127.0.0.1`.  
Session names: `bh-lensing` (HTTP), `bh-file` (direct `file://`).

Statuses used below: **pass**, **fail**, **blocked**, **not-run**.

## Environment

- Browser automation: agent-browser against Chromium via CDP.
- Local HTTP: `http://127.0.0.1:8766/index.html` (no CDN, no module loader).
- Viewports: `1280×800` and `390×844` via `agent-browser set viewport`.
- `window.BH.getState()` used only as a live diagnostic of the running app, after pointer/keyboard/control interactions.

## Fixes found during validation (not hidden)

1. **Geodesics never reached the hole (fail → pass).** First CPU probes after load had `minR ≈ 13.6` and `fate = max-steps` for every sightline, including impact parameter `b ≈ 0.15`. Affine step size scaled too small at large radius, so 128 steps only traveled ~10M from a camera at 22.5M. The first “ring” screenshot was mostly the photon-sphere *overlay*, not captured geodesics.  
   **Fix:** `dt = uStep * clamp(0.22 * r, 0.28, 4.2)` in both GLSL and the JS picker. Retest: center ray `fate = horizon`, `minR ≈ 1.95`, deflection up to ~135°.
2. **Inner-disk flux killed (fail → pass).** Shakura–Sunyaev `(1 - sqrt(r_in/r))` zeroed the inner cusp; the disk was a faint gray band. Removed that factor, added an inner cusp, and made surface hits less step-size dependent after brightness exploded when `dt` grew.
3. **`<input type="range">` fill is imprecise.** `agent-browser fill "#maxSteps" "48"` produced `140`, not `48`. Retest used `input`/`change` events on the labeled sliders, which did set `maxSteps=48`, `stepSize=0.18`, `resolution=0.45` (internal render `576×360`).
4. **Adaptive resolution over-dropped under CDP screenshot load** (floor 0.32 → 410×256). Floor raised to 0.42 and the downscale hysteresis was slowed. Still drops under automation load; idle HTTP reload later measured ~45 FPS at 870×544.

## Check results

### 1. Camera orbit / pan / zoom update lensing continuously — **pass**

Commands:

```bash
agent-browser --session bh-lensing mouse move 420 430
agent-browser --session bh-lensing mouse down left
agent-browser --session bh-lensing mouse move 560 380
agent-browser --session bh-lensing mouse up left
agent-browser --session bh-lensing mouse wheel -240
# pan
agent-browser --session bh-lensing mouse down right
agent-browser --session bh-lensing mouse move 470 360
```

Observed:

| Action | Before | After |
| --- | --- | --- |
| Orbit drag | yaw 0.232, pitch 0.22 | yaw 0.932, pitch 0.47 |
| Wheel zoom | dist 22.5 M | dist 20.7 M |
| Right-drag pan | eye ≈ (−5.25, −4.76, −21.32) | eye ≈ (−3.40, −6.08, −21.52) |

Screenshots `05-after-orbit-drag.png` and `06-after-zoom.png` show a different silhouette, photon-ring orientation, and Doppler side relative to `04-cinematic-paused.png`. This is not a rotating bitmap: the shadow, disk wrap, and diagnostic geodesics recompute with the camera.

### 2. Lensing, redshift, Doppler, ray-step diagnostics — **pass**

Pixel samples from the paused cinematic frame (`04-cinematic-paused.png`), via `BH.sampleCanvas` on the preserved drawing buffer:

- Near shadow: `[1, 1, 1]`
- Left disk: `[154, 115, 116]` (dimmer, redder)
- Right disk: `[255, 255, 255]` (approaching / Doppler-boosted)
- Sky: `[16, 5, 25]`

Visualization modes clicked with `[data-mode='n']` (accessible names are title case; CSS uppercases the labels):

| Mode | Screenshot | Observed |
| --- | --- | --- |
| Cinematic | `04`, `23` | Interstellar-like wrap, Doppler left/right split |
| Steps | `09-mode-1.png` | Heatmap of integrator effort; brighter near the hole |
| Deflection | `09-mode-2.png` | High-deflection ring / Einstein-curve; dark capture region |
| Redshift | `09-mode-3.png` | Receding side red, approaching side blue on disk hits |
| Disk UV | `09-mode-4.png` | Coordinate coloring only where the disk is intersected |
| Distance | `09-mode-5.png` | Closest-approach heatmap |
| Fate | `09-mode-6.png` | Black capture disk vs magenta max-steps / other fates |

CPU probe after the step-size fix (center / offset sightlines): capture at `b ≲ 5`, disk hits on some sightlines, `farR` near `b ≈ 5.10` winding (`fate` max-steps, `minR ≈ 5.0`) — photon-sphere behavior, not a flat disc.

### 3. Select a screen ray and inspect trajectory — **pass**

```bash
agent-browser --session bh-lensing mouse move 390 410
agent-browser --session bh-lensing mouse down left
agent-browser --session bh-lensing mouse up left
```

Inspector opened with live integration values (`07-ray-pick.png`):

```
pixel      0.305, 0.488
impact b   5.774  (5.77 M)
steps      123 / 128
min r      1.996  (2.00 M)
fate       horizon
deflect    97.07 deg
disk hits  1  r=4.60  φ=-1.49
g-factor   1.108
final dir  -0.493 0.121 0.862
```

A 2D orbital-plane diagram (horizon disk, dashed photon sphere, disk radii, polyline) and a projected path overlay on the WebGL view were visible. Close control (`#close-inspector`) later set `open:false`, `picked:null`.

### 4. Quality and integration settings — **pass**

- `#quality` → `high`: `BH.getState().quality === "high"`, internal `870×544` (`13-quality-high.png`).
- Labeled sliders via `input` events: `maxSteps=48`, `stepSize=0.18`, `resolution=0.45` → internal `576×360` (`16-low-integration.png`).
- Restored `maxSteps=128`, `quality=medium`.
- Space key (canvas focused) toggled pause: `{paused:false, checkbox:false, clock:"running"}`.

Camera presets clicked (`[data-preset]`): Einstein ring set `yaw=0, pitch=0.02, dist=28, incl=78` (`10-preset-einstein-ring.png`); polar dive `dist=16` (`11-preset-polar.png`). Overlay checkboxes `#ovHorizon`, `#ovPhoton`, `#ovDisk` all true (`12-overlays-on.png`).

### 5. Viewport resize — **pass**

| Viewport | Canvas CSS buffer | Internal render | Notes |
| --- | --- | --- | --- |
| 1280×800 | 1280×800 (dpr 1 in this session) | 870×544 at scale 0.68 | HUD listed the internal size |
| 390×844 | 390×844 | 242×523 then 265×574 | Panel collapse via `#toggle-panel`; modes remain usable (`17`, `22`) |

### 6. Shader compilation, console, runtime errors — **pass**

```bash
agent-browser --session bh-lensing wait --fn "document.body.dataset.ready === '1'"
agent-browser --session bh-lensing errors
agent-browser --session bh-lensing console
```

- `document.body.dataset.ready === "1"`, `dataset.gl === "webgl2"`.
- `BH.getState().compileLog === "ok webgl2"`.
- `errors` and `console` were empty on HTTP and `file://` sessions after the working shader landed.
- Missing-WebGL2 UI (`#fatal`) is implemented; **not-run** in this browser because WebGL2 initialized.

### 7. Direct `file://` open — **pass**

```bash
agent-browser --session bh-file open file:///home/pyro/projects/naked/grok46/05-black-hole-lensing/index.html
```

Observed: `href` is the file URL, `ready=1`, `compile=ok webgl2`, ~41 FPS, cinematic image in `20-file-protocol.png`. No module/import/fetch of app assets (grep of `index.html` found no `http(s)://`, `fetch(`, or `import`).

### 8. Local HTTP with external network blocked — **pass**

```bash
agent-browser --session bh-lensing network route "https://*" --abort
agent-browser --session bh-lensing open http://127.0.0.1:8766/index.html
agent-browser --session bh-lensing network requests
```

Reload succeeded (`ready=1`, ~44 FPS, `19-reload-external-blocked.png`). Request log contained only `GET http://127.0.0.1:8766/index.html` (200) and an earlier browser `favicon.ico` 404. An inline SVG data-URI icon was added later so the app does not depend on that probe.

### 9. Pause / reset — **pass**

- `#paused` checkbox and Space both change `BH.getState().paused` and the HUD clock line.
- `#reset-cam` / presets restore yaw/pitch/distance; `#reset-all` restores default labeled controls.

Import/export and audio: **not-run** (not in the product requirements). Persistence beyond the live session: **not-run** (not required).

## Screenshot index

| File | What it shows |
| --- | --- |
| `screenshots/01-desktop-default.png` | Early fail: overlay ring, weak real disk |
| `screenshots/02-brighter-disk.png` | Still pre-step-size fix |
| `screenshots/03-geodesics-reach.png` | After step fix; capture + disk (overbright) |
| `screenshots/04-cinematic-paused.png` | Tuned cinematic, Doppler split, HUD |
| `screenshots/05-after-orbit-drag.png` | Lensing after pointer orbit |
| `screenshots/06-after-zoom.png` | After wheel zoom |
| `screenshots/07-ray-pick.png` | Selected geodesic + diagram |
| `screenshots/09-mode-1.png` … `09-mode-6.png` | Diagnostic vis modes |
| `screenshots/10-preset-einstein-ring.png` | Face-on ring preset |
| `screenshots/11-preset-polar.png` | Polar dive |
| `screenshots/12-overlays-on.png` | Horizon / photon / disk overlays |
| `screenshots/13-quality-high.png` | Quality = high |
| `screenshots/16-low-integration.png` | 48 steps / coarser dt / 0.45 scale |
| `screenshots/17-mobile-390x844.png` | Narrow viewport (inspector open from prior pick) |
| `screenshots/19-reload-external-blocked.png` | HTTP reload with `https://*` aborted |
| `screenshots/20-file-protocol.png` | Direct file open |
| `screenshots/21-regression-desktop.png` | Post pan/pick/close |
| `screenshots/22-mobile-compact.png` | Narrow layout after inspector CSS |
| `screenshots/23-final-smoke.png` | Idle HTTP reload ~46 FPS |

## Remaining limitations

- Spin is a Lense–Thirring / azimuthal-drag approximation on Schwarzschild null geodesics, not a full Kerr integrator.
- Rays that skim the photon sphere can still exhaust `maxSteps` (`fate = max-steps`); raising the slider recovers more winding at a cost.
- Adaptive scale falls under heavy CDP screenshot load; a quiet reload was ~45 FPS at 870×544 on this machine.
- WebGL1 fallback compiles a converted shader but was **not-run** visually (WebGL2 was present).
- JS disk picking counts plane crossings; the GPU also samples a thick volumetric slab, so hit counts can differ slightly.
- No audio; nothing to hear-check.
