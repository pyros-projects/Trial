# Validation — Black Hole & Gravitational Lensing Explorer

Artifact: `../index.html` (single self-contained file, zero external references —
verified by source scan for `http(s)://|src=|href=|fetch(|import(|url(` → no matches,
and by network capture showing only the document request + one favicon 404,
since replaced by an inline data-URI icon).

Environment: agent-browser 0.31.1 (headless Chromium), WSL2.
**GPU: ANGLE SwiftShader (software rasterizer)** — fps numbers below are
software-rendered and not representative of real GPUs. The app detects
SwiftShader/llvmpipe and auto-selects the Low preset + adaptive resolution.

Server for HTTP checks: `uv run --no-project python -m http.server 8123`
(temporary dev tool only; the artifact itself needs no server).

## Results

| Check | Result | Evidence |
|---|---|---|
| Page loads, shaders compile, no console/page errors | pass | `errors`/`console` clean on index.html; `shots/19-final-default.png` |
| Real geodesic integration (not a flat sprite) | pass | Shadow, Einstein-ring-like photon ring, disk arcing over/under shadow; `01`, `02`, `19` |
| Camera orbit updates lensing continuously | pass | left-drag (400,400→620,500) visibly changed view; `03-orbited.png` |
| Wheel zoom | pass | d=9.0 → 5.6 in HUD |
| Pan (right/shift-drag) | pass | hole moved off-center; `15-panned.png` |
| Camera presets | pass | Edge-On / Polar buttons produce distinct compositions; `09`, `10` |
| Auto-orbit + Reset view | pass | auto-orbit on by default; button toggles |
| Pause/resume (Space + button) | pass | HUD `t=` froze at 14.7s while `⏸`, resumed to 15.5s |
| Click selects ray, shows integration values | pass | `__lastRay` = 161 steps, minR 0.99 rs, defl 59.0°, fate=captured, 1 disk crossing, g=0.78; path + orbital-plane diagram drawn; `04-ray-selected.png` |
| Viz mode: step count | pass | disk band = few steps (absorbed), ring structure at photon sphere; `05` |
| Viz mode: deflection | pass | `06-viz-defl.png` |
| Viz mode: redshift/Doppler g | pass | blue→white→red map, approaching side visibly g>1; `07` |
| Viz mode: disk hit coords | pass | hue=φ, value=r encoding incl. lensed upper arc; `17` |
| Viz mode: min distance | pass | `18-viz-mindist.png` |
| Viz mode: ray fate | pass | black=captured, blue=escaped, amber=disk-escape, red=max-steps ring at photon sphere; `08` |
| Overlays: horizon / photon sphere / disk plane / ray path | pass | orange solid, blue dashed, amber disk rings, green ray; `04`, `14` |
| Quality presets + custom marking | pass | `low` auto-selected on SwiftShader; render-param sliders → `custom` |
| Adaptive resolution (slow device) | pass | fps<22 → scale dropped 0.5→0.25, HUD `auto`, internal 333×208 |
| Resize + high-DPI (2×) | pass | 390×844 narrow + 1280×800@2x both re-rendered, internal dims tracked; `12`, `13` |
| Narrow viewport UX | pass | ☰ button toggles panel; auto-hidden at <700px on load |
| Mass slider changes lensing | pass | mass 1.6 → visibly larger shadow/structure; `14` |
| Direct `file://` open | pass | `file:///…/index.html` rendered, HUD live, no errors |
| No external network requests | pass | network capture: document only |
| WebGL2-missing graceful message | pass | stubbed copy → "WebGL2 not available" modal with explanation; `16-nogl.png` |
| Shader-compile-failure message | pass (mechanism) | same `fatal()` modal path; real compile failure not reachable on this driver |
| Perf HUD contents | pass | fps, internal WxH, avg/selected step count, quality, viz mode, cam distance, sim time, pause state |

## Fixes made during validation

- Disk emission was over-accumulating on grazing rays → retuned slab alpha +
  crisp plane-crossing weights (`02-retuned.png`).
- Far-field rays ran to step cap → added outward-moving early escape at
  r>25·rs and larger far-field adaptive steps (avg steps ~407→~172).
- Click selection silently failed when down→up exceeded a 600 ms limit →
  dropped the time check, kept the <6px movement threshold.
- `setPointerCapture` wrapped in try/catch (synthetic pointers).
- TDZ crash risk (`let syncing` declared after `applyQuality` call) →
  declaration moved above UI build.
- `qualityName='custom'` no longer triggered by non-rendering sliders.
- Software-renderer detection → conservative default quality; adaptive
  resolution controller added (drop <22 fps, recover >55 fps up to user scale).

## Known limitations

- Spin uses a first-order frame-dragging approximation (rotate p about the
  disk/spin axis at ω≈a·rs²/r³), not full Kerr geodesics.
- Far-field early escape (r>25·rs, outbound) approximates residual bending;
  the deflection viz slightly underestimates for wide rays.
- Overlay horizon/photon-sphere rings show geometric (unlensed) radii — the
  lensed shadow is larger by design.
- On SwiftShader, High/Ultra presets are not interactive; the app
  auto-degrades to Low + adaptive scale. Real GPU hardware is expected to run
  High at interactive rates (not measurable in this environment).
- Disk slab shows mild banding at very low render scales.
