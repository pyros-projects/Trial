# SDF / CSG Studio — agent validation

Artifact: `/home/pyro/projects/naked/grok46/08-sdf-csg-studio/index.html`  
Date: 2026-09-07  
Tooling: `agent-browser` session `sdfstudio` (HTTP) and `sdffile` (file protocol).  
Local server: `python3 -m http.server 18765 --bind 127.0.0.1` in the project directory.  
Port 8765 was already occupied by another app, so this studio was served on **18765**.

External HTTPS/WSS were aborted with `agent-browser network route "https://**" --abort` (and `wss://**`). The local server remained reachable. No CDN, fonts, textures, or module imports exist in `index.html`.

Browser GPU: SwiftShader (`ANGLE ... SwiftShader Device (Subzero)`). The app detects software GL and caps default resolution / steps / shadows / AO so the editor stays interactive. HUD shows `SW GL` in that case. This is slower and softer than a real desktop GPU; quality sliders still raise those settings.

## Commands used

```bash
python3 -m http.server 18765 --bind 127.0.0.1
agent-browser --session sdfstudio open
agent-browser --session sdfstudio network route "https://**" --abort
agent-browser --session sdfstudio set viewport 1280 800
agent-browser --session sdfstudio open http://127.0.0.1:18765/index.html
agent-browser --session sdfstudio snapshot -i
agent-browser --session sdfstudio screenshot evidence/screenshots/....png
agent-browser --session sdfstudio eval "JSON.stringify(window.__SDF_STUDIO__.getPerf())"
agent-browser --session sdffile open file:///home/pyro/projects/naked/grok46/08-sdf-csg-studio/index.html
```

Interactions used labeled controls (Add, CSG operation, visualization mode, numeric transforms, import file input, drawers). Pointer clicks and drags were used on the WebGL canvas. Live state was read from the on-screen HUD and `window.__SDF_STUDIO__` (perf, selected object, canonical scene JSON, shaderError).

## Public checks

| Check | Result | Evidence |
| --- | --- | --- |
| Default striking sculpture, WebGL2, no shader compile error | **pass** | `03-softgl-defaults.png`; `shaderError: null`; fatal overlay hidden; 10 objects, Final shading |
| Add and transform ≥2 primitives | **pass** | Added Box and Cylinder via Primitive type + Add. Cylinder pos `[0.15,0.55,0.2]`, scale `[1.2,1.4,1]`. `05-union-after-transform.png` |
| CSG subtraction | **pass** | Cylinder operation → Subtraction. Scene object list and inspector show SUB. Viewport lost the unioned cylinder volume (`06-cylinder-subtraction.png` vs `05`) |
| CSG intersection | **pass** | Box operation → Intersection. Accumulated field clipped to a boxy solid (`07-box-intersection.png`). Live state: `Box:inter`, `Cylinder:sub` |
| Viewport picking of SDF surface | **pass** | Selected Ground in the list (`beforePick: Ground`), clicked the rendered solid. Selection became `Cylinder` (the subtracted cutter that owns that surface) |
| Reorder stack | **pass** | Move up swapped Cylinder before Box: `... Spark, Cylinder:sub, Box:inter` |
| Change material | **pass** | Cylinder/Cutter material type → Metallic. Inspector + `getSelected().mat === "metallic"` |
| Final shading | **pass** | `03-softgl-defaults.png`, `05-union-after-transform.png` |
| Surface normals | **pass** | `09-viz-normals.png` — RGB normal coloring, HUD `view Normals` |
| Depth | **pass** | `10-viz-depth.png` — distance heatmap, HUD `view Depth` |
| Object ID | **pass** | `11-viz-object-id.png` — distinct hash colors per object, HUD `view Object ID` |
| Ray-march steps | **pass** | `12-viz-steps.png` — step heatmap, HUD `view Steps` |
| Extra viz: SDF slice, material ID | **pass** | `15-viz-sdf-slice.png` (zero isosurface + interior/exterior coloring); `16-viz-material-id.png` |
| Shadow / AO visualization as dedicated captures | **not-run** | Modes exist in the View control. Session ran mostly with `sh 0` / `ao 0` on SwiftShader, so a dedicated shadow/AO screenshot was not a fair lighting diagnostic. Shadow quality **was** changed to `2` in the quality check. |
| Resize 1280×800 | **pass** | Default session viewport; FBO tracked canvas size (`510×526` then `233×241` after quality cap) |
| Resize 390×844 | **pass** | `17-mobile-390x844.png`; Scene / Inspect drawers; `18-mobile-scene-drawer.png`, `19-mobile-inspector-drawer.png`. Top bar wraps; drawers remain the usable chrome. |
| Quality settings | **pass** | Max steps 28→40, shadow quality 0→2 via inspector. `getPerf().quality` matched. Internal render size follows Resolution. |
| Camera orbit / reset / gizmo translate | **pass** | Drag on empty sky changed `camera.yaw/pitch`. Drag on gizmo changed Cylinder `pos.x` 0.15→0.56 (viewport translation). Reset camera button clicked. |
| Copy scene | **pass** | Copy scene → toast `Copied canonical scene` |
| Export JSON | **pass** | Export JSON → toast `Exported scene JSON` |
| Import JSON | **pass** | Uploaded `evidence/import-roundtrip.json` with Body renamed. After import: names include `Imported Body`; toast `Imported scene`. `14-after-import.png` |
| Export PNG | **pass** | `canvas.toDataURL('image/png')` returned `data:image/png;base64,iVBORw0K...`. Button toast `Exported PNG`. Binary download was not saved into `evidence/` (browser download), but pixels were a real PNG payload. |
| localStorage persistence | **pass** | Reload restored `Imported Body`, `Cutter`, `Cutter copy`, `Box` |
| Hide / rename / duplicate | **pass** | Hide set `visible: false`; rename Cylinder→Cutter; Dup created `Cutter copy` |
| Shader compile / runtime errors | **pass** | `shaderError: null`, `lastError: null` after load and after later shader edits. `agent-browser errors` / `console` showed no page JS exceptions. |
| No external runtime fetches | **pass** | Request log: `GET http://127.0.0.1:18765/index.html` 200 only (plus `/favicon.ico` 404). No CDN. Source has no `http(s)`, `fetch(`, or `import`. |
| Direct `file://` open | **pass** | `sdffile` opened `file:///.../index.html`. Title `SDF / CSG Studio`, `webgl2: true`, `shaderError: null`, default Liminal Bloom rendered. `23-file-protocol.png` |
| Presets | **pass** | Mechanical Cutaway (`21-mechanical-final.png`), Crystal Reliquary, Impossible Arch, Marching Faults, Infinite Cloister (`20`, `22`, `24`, `25`, `26`) loaded distinct object stacks and visible geometry. |
| Pause / play | **pass** | Play animation unchecked; time slider stayed put during CSG edits. |

## Observed failures and fixes during development

1. **Wrong HTTP port.** First bind to 8765 failed (`Address already in use`); that port served a different app. Switched to 18765. Not an application defect.
2. **~0.6–1.4 fps on SwiftShader** at the original desktop quality (0.7 res, 72 steps, shadows, AO, bounces). **Fix:** skip lighting in diagnostic viz modes; avoid a double `map()` on hit; detect software GL and cap defaults; keep full quality on real GPUs.
3. **Glass with 0 bounces used IOR as metalness**, so glass looked metallic. **Fix:** glass uses metalness 0 and a Fresnel fallback when bounces are 0; real refraction still runs when bounces > 0.
4. **Object list click missed Box/Cylinder** until the row was scrolled into view. **Fix:** selected row `scrollIntoView({block:'nearest'})`.
5. **Preset dropdown did not restore** from saved JSON (`presetHint`). **Fix:** `applyScene` writes the preset control.

## Network / console

- Document: `200` from local server or `file:`.
- `GET /favicon.ico` **404** (no favicon in the self-contained file). Not a runtime dependency of the studio.
- No uncaught JS errors recorded.
- Shader compile log empty; unsupported-WebGL path is the `#fatal` overlay (not triggered here).

## Remaining limitations

- **SwiftShader performance:** about 6–12 fps at capped quality (`q ~0.32`, 28–32 steps, shadows/AO often 0). A discrete GPU should run higher Resolution, Max steps, Shadows, AO, and Bounces. The HUD reports `SW GL` when capped.
- **16-object cap.**
- **Non-uniform scale** uses the usual `sd(p/s)*min(s)` approximation; it is not a Lipschitz-true SDF.
- **True glass refraction / metallic reflections** need Bounces ≥ 1 (expensive). Default is 0; a cheaper Fresnel stand-in is used otherwise.
- **Picking** reads the object-ID attachment at the clicked pixel; thin features and the current low internal resolution can pick a neighbor object.
- **Narrow chrome:** at 390×844 the top bar wraps; Scene / Inspect drawers are required to reach the stack and inspector.
- PNG file was verified as a PNG data URL and a successful toast; the downloaded blob was not copied into `evidence/`.
- Shadow-visibility and AO visualization modes were not given dedicated “lights on” screenshot passes in this software-GL session.

## Screenshot index

| File | What it shows |
| --- | --- |
| `01-default-desktop.png` | First load at higher quality (very low fps) |
| `02-default-after-perf.png` | After cheaper shader defaults |
| `03-softgl-defaults.png` | Software-GL caps, default sculpture |
| `04-two-primitives-added.png` | Intermediate (add locators initially failed) |
| `05-union-after-transform.png` | Box + Cylinder unioned and transformed |
| `06-cylinder-subtraction.png` | Cylinder as subtraction |
| `07-box-intersection.png` | Box as intersection |
| `08-reorder-metallic.png` | Reorder + metallic |
| `09-viz-normals.png` | Normal visualization |
| `10-viz-depth.png` | Depth visualization |
| `11-viz-object-id.png` | Object ID visualization |
| `12-viz-steps.png` | Ray-step visualization |
| `13-orbit-after-quality.png` | After quality + camera/gizmo drag |
| `14-after-import.png` | Imported renamed Body |
| `15-viz-sdf-slice.png` | SDF slice |
| `16-viz-material-id.png` | Material ID |
| `17-mobile-390x844.png` | Narrow viewport |
| `18-mobile-scene-drawer.png` | Scene drawer |
| `19-mobile-inspector-drawer.png` | Inspector drawer |
| `20-preset-mechanical.png` | Mechanical preset (material ID leftover) |
| `21-mechanical-final.png` | Mechanical preset, final shading |
| `22-glass-preset.png` | Crystal Reliquary |
| `23-file-protocol.png` | Direct `file://` load |
| `24-arch-preset.png` | Impossible Arch |
| `25-faults-preset.png` | Marching Faults |
| `26-cloister-preset.png` | Infinite Cloister |
