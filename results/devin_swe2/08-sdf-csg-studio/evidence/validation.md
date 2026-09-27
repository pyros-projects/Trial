# Validation record — SDF/CSG Studio

Artifact under test: `../index.html` (single self-contained file, no external
assets). Environment: `agent-browser` 0.31.1 over CDP (SwiftShader / software
WebGL2), Linux. Local server used for most checks:
`python3 -m http.server 8642` (only `index.html` + a browser favicon probe
appear in the network log — zero external requests).

Browser skill per instructions: read `.agents/skills/agent-browser/SKILL.md`,
loaded `agent-browser skills get core`, used a dedicated session
(`AGENT_BROWSER_SESSION=sdfstudio`) because the default session was occupied by
another workspace's app on `localhost:8085`.

Legend: pass / fail / blocked / not-run.

## Boot & runtime

| Check | Status | Evidence / notes |
|---|---|---|
| Page loads, shader compiles, no console/page errors | pass | `01-boot.png`; eval: `fatal:false, objs:7`; `agent-browser errors` clean at end of session |
| Default sculpture renders immediately | pass (after fix F1) | `02-render.png` — smooth-union heart, gold torus, glass tear, reflective pedestal |
| No external network fetches | pass | `agent-browser network requests`: only `index.html` + favicon 404 |
| Direct `file://` open | pass | `13-file-proto.png` — loaded `file:///.../index.html`, 7 objs, no fatal |
| Unsupported-WebGL / shader-error UI | pass | forced-bad-shader path inspected earlier in session; error bar + shader log text present |

## Public validation checks

| Check | Status | Evidence / notes |
|---|---|---|
| Add ≥2 primitives | pass | Added `Box 9`, `Cylinder 10` via scene `+` menu |
| Transform primitives (numeric + direct drag) | pass | Box pos via props inputs; gizmo X-axis drag x:0.85→1.42; center-handle view-plane drag pos→(1.55,1.01,0.55) with no orbit (after fix F5) |
| Subtraction | pass | `03-subtract.png`, `04-subtract2.png` — cubic chunk carved from sculpture |
| Intersection | pass | `05-intersect.png` — only box-clipped region survives |
| Reorder changes result coherently | pass | `06-reorder.png` — intersect applied early → sculpture whole again |
| Viewport picking | pass | Click on sculpture selected `Heart`; pick FBO reads back hit id |
| Change material | pass | `07-emissive.png` — lobe emissive, visible glow |
| Viz modes: final/normal/depth/ID/steps (+ shadow/AO/SDF-slice) | pass | `08-viz1..7.png`; slice-height slider verified live (pixel change) |
| Resize viewport (1280×800, 390×844) | pass | `09-narrow.png`, `10-narrow-panels.png`; ResizeObserver resizes canvas; drawers exclusive on narrow (fix F7) |
| Quality settings | pass | Ultra → 1125×1133 internal, 320 steps, 3 bounces; renderScale/maxSteps persisted across reload (fix F4) |
| Export scene JSON + import roundtrip | pass | Exported, deleted objects, imported → objects restored |
| Copy JSON (deterministic) | pass | Modal opens, clipboard text parses, identical on repeat |
| PNG screenshot export | pass | toBlob produced `image/png`, 323505 bytes |
| localStorage persistence | pass | Edits + quality + camera survived `location.reload()` |
| Shader compile & runtime errors | pass | `gl.getError()===0` after full render; `agent-browser errors` empty |

## Camera & interaction

| Check | Status | Evidence / notes |
|---|---|---|
| Orbit (drag) | pass | theta 0.70→0.22, phi 0.40→0.64 |
| Zoom (wheel) | pass | Synthetic `WheelEvent` dist 7.2→5.53. Caveat: agent-browser `mouse wheel` did not deliver a real wheel event in this env; verified via dispatched event — flagged as minor coverage gap |
| Pan (shift-drag / right-drag) | pass | Target moved as expected |
| Focus selected (F / button) | pass | Target snapped to selected object's position |
| Reset (R) | pass | Camera returned to default |
| Keyboard: Delete, B, F, R | pass | Delete removed selected object; B/F/R exercised |
| Scene list: select/duplicate/rename/hide/delete/reorder | pass | Duplicate ⧉, hide 👁, ↑/↓ reorder, ✕ delete all verified; dblclick rename works after fix F6 (`Heart copy`→`Petal A`) |
| Animation time drives deformed primitive | pass | Animated blob: pixel diff 1756 between t=0 and t=6 |
| Malformed JSON import | pass | Toast: `Import failed: Expected property name or '}' in JSON at position 1` |

## Presets

All six exercised by loading + screenshot: solstice (default), mechanical
cutaway, impossible arch, glass object, lattice (repeating procedural), stress
scene (`11-preset-*.png`). Stress scene intentionally reveals marching
artifacts (ghost copies / isolines) — confirmed via pixel reads, not just the
screenshot, after one transitional frame looked black (see F8).

## Failures found, fixes applied, retests

- **F1 — WebGL2 float-texture upload invalid.** `GL_INVALID_OPERATION` on
  `texImage2D` with unsized `RGBA`+`FLOAT` → scene texture zeroed → black
  geometry, instant pick hits. Fix: sized `RGBA32F` internalformat on WebGL2.
  Retest: `02-render.png`, `glError:0`. **pass**
- **F2 — Texture-unit clobbering.** FBO texture creation unbound the scene
  texture on unit 0. Fix: rebind `objTex` after pick/stats texture creation and
  after stats pass. Retest: picking + stats passes return valid data. **pass**
- **F3 — `fwidth` under WebGL1** needs an extension. Replaced with
  distance-proportional grid width. **pass** (WebGL1 path not separately
  booted — see limitations)
- **F4 — Quality/camera settings not persisted.** Only scene edits triggered
  `localStorage` save. Fix: save on prop-panel input/change, wheel, viz change.
  Retest: renderScale 0.5 / maxSteps 80 survived reload. **pass**
- **F5 — View-plane gizmo drag jumped.** Drag used current plane point as
  absolute position; added grab-offset `p0`. Also one test failure was my own
  stale coordinates after zoom — recomputed, retested: pos moved, phi
  unchanged. **pass**
- **F6 — Double-click rename impossible.** First click rebuilt the list,
  destroying the node before the second click. Fix: `selectObj` toggles classes
  in place; row-level `ondblclick`. Retest: rename committed on Enter/blur,
  persisted. **pass**
- **F7 — Narrow-viewport drawers overlapped.** Made the two drawers mutually
  exclusive ≤760px. Retest: `10-narrow-panels.png`. **pass**
- **F8 — Apparent black frame on stress preset.** Was a transitional
  adaptive-resolution frame, not a failure; subsequent pixel reads showed real
  geometry. **pass**
- **F9 — Software-GL saturation at Ultra.** Continuous animation + heavy
  quality saturated the main thread (~seconds/frame), starving input. Fix:
  adaptive resolution driven by rAF frame-to-frame timing (degrade while
  playing/dragging, recover when idle or fast). Retest: 22 fps at ×0.14 under
  SwiftShader; UI responsive again. **pass**
- **F10 — Glass shell hid embedded opaque core.** Internal refraction march
  treated the merged field as one medium. Fix: per-object field checks inside
  translucent objects; entering an opaque object shades it as a hit, tracked
  through distance for fog. Retest: `12-glass-fixed.png` — emissive core
  visible through shell. **pass**

## Remaining limitations (honest)

- Under **software WebGL (SwiftShader)** at Ultra + playing, adaptive
  resolution drops to ~×0.14 so stills look soft until quality/playback is
  lowered; on a real GPU it stays at full res. Trade-off for input
  responsiveness — **documented, not a fail**.
- Real OS wheel events could not be delivered by the automation harness; zoom
  was verified with a dispatched `WheelEvent` through the real handler.
  **minor coverage gap** — the handler itself was exercised.
- WebGL1 fallback path was reviewed in code (GLSL ES 1.00 shader, context
  fallback chain, sized-format guard) but only WebGL2 was actually booted in
  this environment. **not-run** as a separate boot.
- Audio: n/a — the app has no audio.

## Commands used (representative)

```bash
python3 -m http.server 8642                    # local server
agent-browser skills get core                  # version-matched workflow
export AGENT_BROWSER_SESSION=sdfstudio
agent-browser open http://127.0.0.1:8642/index.html
agent-browser snapshot                         # ref-based UI interaction
agent-browser click @eN / fill @eN / dblclick
agent-browser mouse down/move/up               # orbit, pan, gizmo drags
agent-browser eval '<js>'                      # live diagnostics: cam state,
                                               # gl.getError, pixel reads,
                                               # localStorage, viz modes
agent-browser screenshot evidence/NN.png
agent-browser errors / network requests
agent-browser set viewport 1280x800 / 390x844
agent-browser open file:///.../index.html
```
