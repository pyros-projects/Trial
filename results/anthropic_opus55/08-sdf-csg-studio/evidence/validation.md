# Validation — SDF · CSG Studio (`index.html`)

Agent-authored record of what was actually exercised against the delivered `index.html`. Pass means it was observed in a real browser. Blocked or not-run items are listed as such.

Detailed per-step output (commands, JSON state dumps, pick results) is in [`raw-log.md`](raw-log.md). Screenshots are in `screenshots/`, downloaded artifacts are in `downloads/`, and helper scripts are in `scripts/`.

## Environment and tool availability

| Item | Value |
|---|---|
| Browser automation | `agent-browser` 0.31.1 (installed skill read: `.agents/skills/agent-browser/SKILL.md`; `agent-browser skills get core --full` and `skills get dogfood` read before use) |
| Browser | agent-browser's headless Chromium |
| WebGL | **SwiftShader (CPU) WebGL2**: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))`. The host's RTX 4090 is not reachable from headless Chrome under WSL2. `--use-angle=vulkan` gave llvmpipe (also CPU), and the `gl` / `gl-egl` / d3d12 variants fell back to SwiftShader or no WebGL. All rendering in this report is therefore software-rasterized. |
| Load mode | **Direct file**: `agent-browser open file:///…/index.html`. No HTTP server was used. |
| Supplementary input | `agent-browser mouse wheel` always dispatches at (0,0), and `keyboard down Shift` does not set `shiftKey` on its mouse events. For wheel zoom, Shift+drag and touch pinch I sent real `Input.dispatchMouseEvent` / `Input.dispatchTouchEvent` over the same browser's CDP endpoint (`agent-browser get cdp-url`), using `scripts/cdp-wheel.mjs`, `cdp-drag.mjs` and `cdp-pinch.mjs`. |
| Native colour picker | `agent-browser fill` on `<input type=color>` yields `#000000`. The colour was set via `value` plus a dispatched `input` event, the same event the native picker fires. The native picker dialog itself was not driven. |
| State inspection | `window.studio` exposes read-mostly diagnostics (`state()`, `pick(x,y)`, `project(p)`, `canonical()`). `pick()` runs the same GPU single-ray pick that viewport clicks use, and was used to verify rendered geometry numerically. |

## Summary of results

| # | Check | Result |
|---|---|---|
| T1 | Direct `file://` load: compile, no console/page errors, no network access | **pass** |
| T2 | Add two primitives (buttons), numeric transform (typed fields), gizmo drag (real mouse) | **pass** |
| T3 | Change composition op to **subtract** and **intersect**, geometry changes coherently | **pass** |
| T3b | Smooth union / smooth intersect / smooth subtract / morph blend | **pass** |
| T4 | Viewport picking by real click, including cut face selecting the **cutter**, and deselect on miss | **pass** |
| T5 | Reorder (▲ button, Alt+↓, HTML5 drag-and-drop) with a visible, logical effect | **pass** |
| T6 | Material change (preset chip, colour, roughness) and Material-ID view | **pass** (native colour dialog not driven) |
| T7 | Visualization modes: final, normals, depth, object ID, material ID, ray steps, shadow, AO, SDF slice, march outcome | **pass** |
| T8 | Resize 1280×800 → 390×844 → 1280×800, no horizontal overflow, tabbed narrow layout | **pass after fix** |
| T9 | Quality settings (max steps, ε, resolution, shadows, AO, bounces) change measured march data | **pass** |
| T10 | Export JSON (download), import JSON (upload), invalid-file error states | **pass** |
| T11 | Copy deterministic representation; repeatable; export → import round trip identical | **pass** (clipboard contents not read back by an external app) |
| T12 | PNG export (download is a valid PNG at internal resolution) | **pass** |
| T13 | Rename (double-click) and localStorage persistence across reload | **pass after fix** |
| T14 | Shader compilation error panel, last good shader kept, recovery | **pass after fix** (error injected with the test-only hook) |
| T15 | Unsupported WebGL2 handling (browser launched without any WebGL) | **pass** |
| T16 | Orbit, pan (right-drag and Shift-drag), wheel zoom, focus-selected (F), camera reset (R / button) | **pass** |
| T17 | Keyboard: Ctrl+D, Delete, H, `[` `]`, Space, digits, Escape, Alt+↑/↓. Structural edits: type change, repetition, hide | **pass** |
| T18 | Animation time control changes the render; paused clock holds | **pass** |
| T19 | WebGL context loss → message → restore → recompiles and renders | **pass** |
| T20 | High-DPI (DPR 3 emulation): internal buffer DPR-capped at 2, overlay at native DPR, High-DPI toggle | **pass** |
| T21 | Touch: two-finger pinch zoom (CDP touch events, iPhone 14 emulation) | **pass** |
| T22 | All 7 presets load and render; console silent through a preset + mode tour | **pass** |
| — | Performance on real GPU hardware | **blocked**: no hardware GPU reachable from headless Chrome in this WSL2 environment. Only software numbers are available (below). |
| — | Direct file vs local HTTP | direct file **pass**; local-HTTP check **not-run** (not needed, since the file loaded directly with zero network requests) |
| — | Audio | n/a (the app has no audio) |

## Key observations

**T1, direct file.** After `localStorage.clear()` and a reload, `agent-browser network requests` lists exactly one request: `GET file:///…/index.html (Document) 200`. `errors` and `console` are empty, and `compileState` is `ready`. Static check: `grep -E "https?://|src=|<link|@import|import\(|fetch\(|XMLHttpRequest|url\("` finds only two source comments. The only `href` is a `blob:` URL used for downloads. The file is 128 KB with no external assets.

**T3, CSG coherence.** Torus 3 was placed on the Box's top face and its operation switched through the Operation `<select>`. GPU picks at three fixed world points:

| op | torus-tube point | Core point | Box side point |
|---|---|---|---|
| union | Torus 3, t = 6.606 | Core, t = 6.785 | Box, t = 5.476 |
| subtract | Floor, t = 11.454 (torus volume removed) | Core (unchanged) | Box |
| intersect | Floor | Floor, t = 25.651 (everything above in the stack clipped) | Floor |

Screenshots `03a/03b/03c` show the groove carved into the box, and the box ∩ torus remnant. For a sphere with an overlapping box on a new scene (`20-ops-sheet.png`):
- smooth union pulls the overlap surface closer (4.141 → 4.092, the fillet bulge),
- smooth intersect keeps only the overlap,
- smooth subtract carves the overlap (t 5.545, face owned by the cutter),
- morph blend at 0.3 stays sphere-like and at 0.8 becomes box-like.

**T4, picking.** A real click inside the notch that the torus cuts through the box wall selected **Torus 3** (the subtractor), and the list row, inspector and overlay all agreed. Clicking the box face selected Box. Clicking the carved cavity of the sculpture selected **Carve**. Clicking the sky deselected. One early click at a scan-derived pixel hit Floor; a pick map showed that pixel sat on a 1-px sliver at the notch edge, so it wasn't a mis-pick.

**T5, ordering.** At a fixed notch pixel, the hit was Torus 3 at t 6.042. After ▲ moved the cutter above the Box, the same pixel hit Box at t 5.435 (no longer carved). Alt+↓ restored it to Torus 3 at 6.042. `agent-browser drag` on list rows also reordered correctly.

**T9, quality settings drive march data** (stats from a 64×36 float readback of the actual march):

| setting | avg steps | hit % | out-of-steps % |
|---|---|---|---|
| baseline: 160 steps, ε 1e-3 | 22.37 | 67.8 | 0 |
| max steps 12 | 11.55 | 22.0 | 77.2 |
| ε 0.03 | 12.02 | 73.6 | 0 |

Resolution 0.4 halved the internal buffer from 171×182 to 85×91. Shadow, AO and bounce changes are visible in `09-quality-sheet.png`.

**T10–T12, files.**
- Export: `downloads/exported-scene.json` (11,188 B, 11 objects, settings and camera).
- Import restored the scene exactly: the canonical text before and after re-import is identical (`fnv1a=85e1ceec`).
- Malformed JSON gave the toast "Import failed: bad-syntax.json is not valid JSON (Unexpected end of JSON input)". An unknown type gave "Import failed: objects[0] has unknown type "hypercube"". In both cases the scene was unchanged.
- PNG: `downloads/screenshot-export.png`, "PNG image data, 570 x 606".

**Software-renderer performance (SwiftShader, CPU).**
- Adaptive resolution settles around 0.24–0.3 scale: about 4–6 fps at 171×182 in the default scene, and 35 fps with shadows, AO and reflections off.
- Time to first frame went from 7.4–8.0 s to 3.5–3.9 s after the shader restructure described below.
- These numbers say nothing about hardware-GPU frame rates, which could not be measured here.

## Failures found and fixed (each retested)

1. **Planes defaulted to y = 0.8.** `makeObject` gave every primitive y = 0.8, so six presets had their floor 0.8 up, burying the scene bottoms. The Object-ID view exposed it (`bug-floor-at-0.8-before.png`). Fix: planes default to y = 0. Retest: `presets-sheet-a/b.png`.
2. **Selection overlay banding.** The selected object's own visible surface was drawn as concentric amber rings. The ghost march stopped exactly at the scene hit distance, with a tighter threshold than the main march. Fix: small overshoot plus a matching threshold. Before/after: `bug-selection-banding-before.png` / `-after.png`.
3. **Faint outline** on light objects. The falloff was changed to a smoothstep (solid within about 1 px). Retest crop in `raw-log.md` (T12 notes).
4. **Glass cast fully opaque shadows**, leaving a black pool under the glass ring. Fix: shadow rays use a field that skips transmissive union-type objects; glass cutters still count.
5. **Narrow layout.** The stats overlay covered the phone viewport and the Stats button wrapped behind it. Fix: compact 3-line overlay below 560 px and a non-wrapping toolbar. Retest: `08d-narrow-390-after-fix.png`.
6. **Rename via double-click failed on unselected rows**, because the list was rebuilt on the first click. Fix: selection updates rows in place, and dblclick is delegated to the list. Retest: pass, including persistence.
7. **Shader-error recovery stuck in "error".** The identical source short-circuited without clearing the error state, and the ANGLE log contained a NUL character. Fix: the reuse path resets state; NUL stripped. Retest: `ready`, panel hidden.
8. **Compile time.** The scene SDF was inlined at about 14 call sites. The shader was restructured into one shared bounce loop, giving single call sites for march, normal, material, lighting, shadow and AO, with glass interiors as loop iterations. First frame dropped from about 7.7 s to 3.7 s on SwiftShader. Regression renders of presets and modes: `regression-after-shader-refactor.png`.
9. **Polish.**
   - The no-WebGL overlay text now reads "WebGL2 unavailable — rendering disabled".
   - PNG export omits the editor selection highlight.
   - The canonical copy excludes the running animation clock, so it's deterministic while animating.

## Remaining limitations (honest list)

- **No hardware-GPU validation.** All frames were software-rendered. Frame rate and compile time on real desktop GPUs, especially ANGLE/D3D11 on Windows, where large ray-march shaders compile slowly, were not measured. Adaptive resolution plus on-demand rendering (idle when nothing changes) are the mitigations.
- **Glass is an approximation.** Reflection is environment-only when refraction is traced. Total internal reflection passes straight through. Shadows ignore glass rather than tinting them. Interiors of overlapping unions merge.
- **Conservative non-uniform scale.** It is handled with a min-scale Lipschitz bound, which is correct but slower to converge. Finite domain repetition assumes the shape fits its cell; overlapping cells produce an inexact field, visible in T17.
- **The composition model is a flat ordered stack**, not a hierarchy. Expressions like (A−B) ∪ (C∩D) need careful ordering.
- **No undo/redo.**
- **Clipboard and colour picker.** The clipboard write reported success in headless Chrome, but pasting into another app was not verified. The native colour-picker dialog was not driven (value + `input` event instead).
- `studio.debug.injectShaderError()` is a test-only hook used for T14. No user workflow produces invalid GLSL.
