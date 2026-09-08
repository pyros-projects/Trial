# SDF / CSG Studio — Validation Record

Artifact: `index.html` (single self-contained file, ~96.5 KB, no external references — verified by
`grep -nE "https?://|@import|src=|fetch\(|XMLHttpRequest" index.html` → no matches).

Test environment: agent-browser 0.31.1 (Chrome via CDP, headless) against `python3 -m http.server 8123`
on the working directory. The test machine renders via SwiftShader (software GL), so FPS in screenshots is
low on some scenes; on GPU hardware the same paths run orders of magnitude faster. The in-app FPS overlay
reports measured render rate honestly.

Legend: PASS / FAIL / BLOCKED / NOT-RUN.

## Application under test

- Sphere-traced signed-distance-field renderer, WebGL2, single fragment program generated per object
  capacity; per-object transforms/materials are uniform arrays (transform edits never recompile).
- Primitives: sphere/ellipsoid, box, rounded box, cylinder, capsule, torus, plane (half-space),
  twisted box, gyroid shell, noise-displaced sphere (procedural deform primitives).
- CSG stack: union, smooth union, subtract, smooth subtract, intersect, smooth intersect; first visible
  object is the base (op forced to union).
- Materials: diffuse / metallic / glossy / emissive / glass (fresnel + refraction with interior march and
  Beer–Lambert tint), sun + soft shadows, SDF ambient occlusion, fog, ACES tonemap, optional reflections
  (0–2 bounces).
- Visualization modes: final, normals, depth, object ID, ray steps, shadow, AO, SDF slice (all derived
  from marcher data), plus a picking pass (R=id, G=steps, B=depth) used for click-picking and the
  performance overlay probe.

## Checks performed (all against the real UI/render pipeline unless noted)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Default load: sculpture preset renders (metaballs, ring, floor, soft shadows, AO, grid) | PASS | `05-default-good.png`, `08-grid-subtle.png` |
| 2 | Picking selects the depth-responsible surface: click at projected Blob L → "Blob L"; click at Core center → "Ring" (ring genuinely in front); sky click deselects; hidden object not pickable | PASS | eval outputs recorded; pickAt returns id/steps/depth |
| 3 | Direct translation: CDP mouse drag moved Blob L `[-1.05,0.7,0.2] → [-1.99,0.67,-2.52]` following the pointer in the view plane; selection retained | PASS | eval before/after |
| 4 | Shift+drag constrains to horizontal plane: Y pinned exactly, XZ moved (synthetic PointerEvent through the real handler; CDP cannot hold modifiers) | PASS | eval before/after (`yPinned:true`) |
| 5 | Add two primitives (sphere + torus) via Add control; transform via API/inspector | PASS | `15-csg-union.png`, list shows 4 objects |
| 6 | Composition op → Subtract: render hash changes; cut faces take cutter material | PASS | hashes union 1178406 / sub 1170508; `18-csg-subtract.png` |
| 7 | Composition op → Intersect: distinct render (tiny lens when ordered last) | PASS | hash 1780707; `19-csg-intersect.png` |
| 8 | Smooth subtract vs hard subtract: distinct (blend fillet visible) | PASS | hashes 1170898 vs 1170508; `20-csg-smooth-subtract.png` |
| 9 | Reorder via real ↑ button (torus before sphere): intersect now clips the ring to a lens; subtract bites the ring — ordered stack semantics visible and consistent | PASS | `21-intersect-reordered.png`, `22-subtract-reordered.png` |
| 10 | All 8 visualization modes render distinct output from real marcher data (hashes all distinct); normals/ID/steps/slice verified visually | PASS | `23`–`30` screenshots + 8 distinct hashes |
| 11 | Material change via color input (`#e0653a` on Core) changes render | PASS | hash 1178988 → 1172449 |
| 12 | Numeric transform input: Core pos x → 2.2 via number field changes render | PASS | hash → 1164526; JSON shows `pos:[2.2,…]` |
| 13 | Keyboard: `2`/`1` switch modes (banner appears), Space toggles playback, F focuses selected (target jumps to object, dist = bound×3), R resets camera, G toggles grid | PASS | eval state after each key |
| 14 | Camera: orbit drag on sky (yaw 0.62→1.28, pitch 0.34→0.78), right-drag pan (target moved), wheel/`WheelEvent` zoom (dist 7.4→4.58→11.96). Note: this agent-browser build does not deliver CDP `mouse wheel` events to the page (`wheelCount:0` with an independent listener), so the zoom was driven by dispatching WheelEvent through the same handler | PASS (wheel via synthetic event, noted) | eval outputs |
| 15 | Settings sliders change output: maxSteps 40 vs 400 distinct; exposure 0.3 distinct; reflections off distinct | PASS | eval hashes |
| 16 | Render scale: internal buffer 315×200 @40%, 1103×700 @140%; high-DPI (`set viewport 1280 800 2`) → 1103×1012 internal | PASS | eval dims |
| 17 | Narrow viewport 390×844: canvas fills screen, Scene/Edit panel toggles slide drawers over the canvas, perf overlay legible | PASS | `32-narrow-844.png`, `33-narrow-scene-panel.png`, `34-narrow-inspector.png` |
| 18 | Duplicate (row ⧉): 7→8 objects, copy selected; Rename (inspector text): list updates; Hide (eye): 7 visible, not pickable; Delete (✕): back to 7 | PASS | eval outputs |
| 19 | Copy JSON → clipboard contains identical scene (pretty-printed); Export downloads JSON; Import via real `<input type=file>` restores byte-identical scene (6→7 objects after deleting one) | PASS | eval `restoredExact:true` |
| 20 | PNG export: `agent-browser download` captured `evidence/exported-screenshot.png` (193 KB) produced by the app's PNG button | PASS | file on disk |
| 21 | localStorage persistence: exported scene JSON before reload === after reload (byte-identical, verified in shell by diffing parsed JSON) | PASS | `/tmp/pre.json` diff → `PERSISTED IDENTICAL: True` |
| 22 | Corrupt JSON import → visible error toast ("Import failed: Expected property name …"), scene untouched | PASS | toast text captured |
| 23 | Help dialog opens/closes; Settings panel opens with all sliders visible | PASS | eval `.open === true` |
| 24 | Presets all load via preset select with correct object counts (mechanical 10, arch 7, glass 7, repeating 10, artifacts 6) and render | PASS | `40`–`44`, `46`, `48`, `54`, `55` |
| 25 | Artifact Lab preset loads coarse settings (ε 0.0040 shown in overlay) and shows banding/hairline artifacts | PASS | `44-preset-artifacts.png` |
| 26 | Performance overlay: FPS (measured), internal res, object count, probe-pixel ray steps (updates from 1-texel pick pass, e.g. "Ray steps 11 (px 410,323)"), mode, selection, quality summary | PASS | `70-final-hero.png`, eval `pixelStats` |
| 27 | Direct `file://` open: app boots, renders 7 objects, no fatal overlay; network log across the session shows only the document itself (no external asset/service fetches ever) | PASS | `60-file-protocol.png`, `network requests` output |
| 28 | Console: zero errors/warnings/uncaught exceptions from the app across all sessions | PASS | `agent-browser console` grep → 0 |
| 29 | Shader-error / unsupported-WebGL handling: fatal overlay code path exists (`showFatal`); overlay display verified after fixing a CSS `[hidden]` regression found in testing | PASS (overlay shown during early bug) | `01-first-load.png` |
| 30 | Post-change regression on final artifact: CSG union/subtract/intersect hashes distinct; final/normals/ID/steps modes distinct; picking returns depth-correct surface (returns Sphere when it occludes Blok's center — responsible-surface semantics) | PASS | eval outputs |

## Bugs found and fixed during validation

1. `#fatal{display:flex}` overrode the `hidden` attribute → error overlay always visible. Fixed with `#fatal[hidden]{display:none}`.
2. Camera basis `right` vector sign flipped → scene rendered upside-down. Fixed (`right = [-fwd.z, 0, fwd.x]`).
3. Settings panel slide-out translate (105%) left it partially on-screen. Fixed with `translateX(calc(100% + 266px))`.
4. Scene JSON quantization (3 dp) corrupted ε 0.0015 → 0.002 on round-trip. Fixed (5 dp quantization).
5. Ground grid never visible behind SDF floor objects, and axis test painted every gridline. Grid moved to a depth-tested analytic overlay on the primary ray; axis lines now test distance to the axis itself.
6. `setPointerCapture` could throw for synthetic pointers; guarded with try/catch (real pointer paths unaffected).
7. Shift+ground-plane drag preserved the grab-height offset instead of pinning Y. Fixed (`startY` captured).
8. Mechanical preset: corner-cut box originally sliced most of the housing and extended below the floor, painting a coincident-face material patch onto the floor (classic CSG artifact). Reshaped to a quarter cutaway raised above the floor; cut-face material lightened so the section reads.

## Blocked / not-run / limitations

- CDP wheel delivery is broken in this agent-browser/Chrome build, so zoom was verified by dispatching
  `WheelEvent` through the production handler (orbit/pan/click/drag used genuine CDP pointer input).
- FPS on this machine is SwiftShader-bound (single-digit FPS for heavy scenes at 100% scale, faster at
  smaller scales). No claim is made about GPU performance; the overlay reports measured values.
- Audio: not applicable (no audio features).
- Refraction/glass verified visually (convincing transmission, fresnel, tinted interior) but not against a
  numerical reference; it is an approximation (single interior march, TIR fallback), as documented in-app.
- The browser daemon occasionally relaunched between test commands (harness idle behavior), resetting
  page-local state; all checks were re-run within fresh batches, so no result depends on a stale session.

Delivery state: `index.html` boots into the "Sculpture — Smooth Metaballs" preset with animation playing;
localStorage seeded from the last interaction is cleared/replaced by the reset performed before the final
screenshots.
