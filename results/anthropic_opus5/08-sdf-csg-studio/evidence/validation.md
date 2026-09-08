# Isosurface — SDF / CSG Studio · validation record

Artifact under test: `../index.html` (single self-contained file, 159 KB, one inline `<script>`, no
external assets, no build step, no network use).
Author of this record: the implementing agent. Statuses are **pass / fail / blocked / not-run**;
a check that could not be exercised is never recorded as a pass.

---

## 1. Environment and tooling

| Item | Value |
|---|---|
| Browser automation | `agent-browser` **0.31.1** (the installed `agent-browser` skill; core workflow loaded with `agent-browser skills get core`) |
| Browser | Google Chrome **143.0.7499.40**, driven over CDP |
| GPU | **none available** — WSL2 with no `/dev/dri`. Chrome falls back to `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)` — i.e. **software rasterisation** |
| GLSL | `WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)`; `MAX_FRAGMENT_UNIFORM_VECTORS` = 4096 → runtime object cap 24 |
| Host page | served from `python3 -m http.server 8808` for part of the run, and opened directly as `file://…/index.html` for the delivery check |
| OS | Linux 6.6.87.2-microsoft-standard-WSL2 |

Three browser sessions were used:

* `sdf` — headless Chrome launched by agent-browser. Usable, but headless Chrome throttles
  `requestAnimationFrame` to a fixed **2 Hz (500.0 ms)** when it is not presenting frames, so FPS
  numbers from that session are meaningless. Retired early.
* `sdfh` — `agent-browser --headed` on the existing `DISPLAY=:0`. This build could not create a
  WebGL context at all — which turned out to be a useful accident: it exercised the
  unsupported-WebGL fallback for real (§6.11).
* `sdfg` — **the session all results below come from.** A Chrome launched manually with
  `--remote-debugging-port=9333 --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`
  on the real X display, then attached with `agent-browser --session sdfg connect 9333`.
  This gives a real compositor (rAF runs at the display rate) **and** a working WebGL 2 context.

```bash
google-chrome --remote-debugging-port=9333 --user-data-dir=<tmp> \
  --enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader \
  --window-size=1300,860 --no-first-run "http://127.0.0.1:8808/index.html"
agent-browser --session sdfg connect 9333
agent-browser --session sdfg set viewport 1280 800
```

**Performance caveat, stated up front:** every frame-rate number in this document is
software-rasterised by SwiftShader on a CPU. They are *lower bounds*, not representative of the
hardware the application targets. What they do establish is that the render loop, the resolution
control, the quality controls and the statistics readback all behave correctly and respond to
settings in the expected direction.

---

## 2. Summary

* 24-check scripted regression harness (`evidence/regression.js`): **24 / 24 pass**
  (`evidence/logs/regression-output.txt`).
* Every public validation check in the task brief was exercised against the running application.
* **Seven real defects were found by this validation and fixed**, then retested (§5).
* One check is recorded as **blocked** (§7): GPU-hardware performance.

---

## 3. How to reproduce

```bash
# 1. serve (optional — the file also runs from file://)
python3 -m http.server 8808          # from the directory containing index.html

# 2. attach a browser with a working WebGL2 context (see §1) and run the harness
agent-browser --session sdfg eval --stdin < evidence/regression.js
```

The harness is self-contained: it loads the default preset, adds a primitive, cycles CSG
operations, reorders the stack, picks the surface, sweeps all ten visualisation modes,
round-trips the scene through JSON, checks localStorage and layout geometry, and asserts that
no frame contains a NaN pixel and that no page error was raised.

---

## 4. Public validation checks

### 4.1 Add and transform at least two primitives — **pass**

Driven entirely through the real UI (list row click → add button → numeric inspector fields):

```bash
agent-browser --session sdfg batch \
  "click #objList>.orow:nth-child(8)" "click #add-box" \
  "fill #obj-pos-x 0.85" "fill #obj-pos-y 1.35" "fill #obj-pos-z 0.35" \
  "fill #obj-param-0 0.62" "fill #obj-param-1 0.62" "fill #obj-param-2 0.62"
```
Observed state afterwards:
`"8:Box:sunion:0.85,1.35,0.35:0.62,0.62,0.62"` — inserted after the selected row, defaulted to
smooth union, transform and shape params applied.

A second primitive (cylinder) added and transformed the same way, including rotation and a
material change:
`{"n":"Cylinder","op":"sunion","mat":5,"pos":[-1.55,1.05,-0.15],"rot":[0,0,62],"p":[0.26,0.95,0,0]}`

Screenshot: `screenshots/05-two-primitives-material.png`.

### 4.2 Change composition operations to subtraction and intersection — **pass**

`select #obj-op 1` (Subtraction) and `select #obj-op 2` (Intersection) on the added box.

* Smooth union → `screenshots/03a-csg-smooth-union.png`
* Subtraction → `screenshots/03b-csg-subtraction.png` — a box-shaped bite is removed from the
  sculpture, exposing the interior; the stack row badge changes to `SUB`.
* Intersection → `screenshots/03c-csg-intersection.png` — only the part of the whole accumulated
  field inside the box survives, including a slice of the ground plane. The HUD's
  *Steps avg* drops from **21.7 (max 98)** to **10.6 (max 39)** because far less geometry is hit:
  the diagnostics track the change, they are not decorative.

The regression harness re-checks this numerically — union / subtract / intersect / smooth-subtract
each produce a different full-frame hash.

### 4.3 Viewport picking — **pass**

Picking renders the *same shader* into a 1×1 framebuffer with `uPickMode = 1` and the pointer's
NDC as a uniform, then reads back `(objectId, t, steps)` encoded in RGBA8. It is therefore the
real ray-marched surface, not a proxy.

Real mouse input (CDP `Input.dispatchMouseEvent` via `agent-browser mouse move/down/up`) produced
identical results to direct calls, confirming the pointer path:

| point | result |
|---|---|
| sculpture body | `Ground` at t=5.81 — correct; that pixel is floor *beside* the silhouette |
| crater interior | `Cutaway` — the **subtracting** sphere, i.e. the operation responsible for that surface |
| metal arm | `Arm` at t=5.35 |
| checker floor | `Ground` at t=5.07 |
| empty sky | miss (`owner:-1`, t = maxDist) |

The harness adds a stronger assertion: pick the centre pixel, record the owner, **hide that
object**, re-pick the same pixel — the owner must change. Observed `Glow core → Cutaway`.

### 4.4 Reorder objects — **pass**

The preset is built so ordering is unambiguous: `Glow core` is unioned *after* `Cutaway`, so the
emissive sphere fills the scooped crater. Selecting it and pressing **↑ Up** moves it above the
cutaway, which then carves it away:

* `screenshots/04a-reorder-core-above-cut.png` — no glow, bare copper crater wall
* `screenshots/04b-reorder-core-below-cut.png` — glow restored

Harness: `reordering changes the field` (hash `2607913445 → 2809764508`) and
`reordering is reversible` (hash restored exactly, with the selection rim normalised out).
Drag-and-drop reordering of list rows is also wired up (HTML5 DnD) in addition to the buttons.

### 4.5 Change a material — **pass**

Two distinct paths tested.

*Assignment*: object inspector → `select #obj-mat 1` changed `Body` from Enamel to Steel; the
sculpture becomes metallic in `screenshots/05-two-primitives-material.png`.

*Property editing*: Materials tab → material chip `Material 2 Enamel` → `Metallic 0 → 1`,
`Roughness 0.5 → 0.1235`, `Pattern None → Stripes`. Resulting state
`{"metallic":1,"roughness":0.1235,"pattern":2}`; the sampled frame checksum moved
`2309867 → 2228370` and `screenshots/12-material-edit.png` shows a striped, mirror-finish body
reflecting the checker floor.

### 4.6 Final, normal, depth, ID and ray-step modes — **pass**

All ten modes were selected through the top-bar `View` control and captured
(`screenshots/view-*.png`): final, normal, depth, objid, matid, steps, shadow, ao, slice, grad.
The harness asserts that all ten produce **distinct** frame hashes and that none contains a NaN
pixel. Notable:

* `view-steps.png` — blue on direct hits, green/yellow along the horizon and silhouettes where
  rays crawl. Derived from the actual loop counter returned by `march()`.
* `view-slice.png` — `map(p)` sampled on the plane the camera ray crosses; red inside, blue
  outside, a yellow zero contour and thin iso-distance bands.
* `view-grad.png` — `|∇d| − 1` at the hit point. Blue on the plain sphere and the ground plane
  (true distance fields), red across the smooth-union blends, which is exactly where `smin`
  stops preserving unit gradient.

### 4.7 Resize the viewport — **pass**

Checked at **1280 × 800** (all screenshots above) and **390 × 844**
(`screenshots/07a-narrow-object.png`, `07b-narrow-scene.png`), plus a high-DPI phone emulation
(`agent-browser set device "iPhone 16 Pro"`, 402 × 874 at **dpr 3**,
`screenshots/07c-narrow-hidpi.png`).

At 390 px the layout switches to viewport-on-top plus a tabbed bottom sheet
(Scene / Object / Render / Materials / Diagnostics / collapse). High-DPI handling verified
numerically: CSS 402 × 367 → ray-march buffer 442 × 404 (= css × min(dpr,2) × renderScale 0.55)
and 2D gizmo overlay 804 × 734 (= css × 2). The harness re-derives this relation as an assertion.

**Two layout defects were found here and fixed** — see §5.3 and §5.4.

### 4.8 Change quality settings — **pass**

Render tab: `Max steps 168→320`, `Hit epsilon 0.0011→0.0004`, `Step scale 0.92→0.75`,
`Shadow quality → High (84 steps)`, `AO quality → High (9 taps)`, `Reflection bounces → 2`,
`Render scale 1→0.7`, `Exposure → 1.25`, `Field of view → 38`.

Observed effect (`screenshots/06-quality-high.png`): HUD quality line reads
`st320 e4.0e-4 sh3 ao3 rb2`, internal buffer drops to 479 × 528, and **Steps avg rises
21.7 → 32.3 (max 160)** — the tighter epsilon and smaller step scale genuinely cost more
iterations. Every control is bound to a live uniform; nothing required a shader rebuild.

### 4.9 Export and import a scene — **pass**

*Export*: `agent-browser download "#btnExport" evidence/exports/scene-export.json` →
8 399 bytes of readable JSON (`exports/scene-export.json`).
*PNG export*: `agent-browser download "#btnScreenshot" evidence/exports/viewport.png` →
684 × 754 PNG of the viewport with no UI chrome (`exports/viewport.png`). Capture uses
`gl.readPixels` inside the same rAF as the draw, so it does not depend on
`preserveDrawingBuffer`.

*Import*: the Import dialog's paste box was filled with a hand-written 4-object scene and
**Load pasted JSON** clicked. Result: `["Floor","Imported torus","Imported gem","Imported cut"]`
with ops `["union","union","sunion","subtract"]`, camera `yaw −25 / pitch 22 / dist 5.5`,
background switched to Dusk, preset selector switched to *Custom / imported*
(`screenshots/08-imported-scene.png`).

*Malformed input*: pasting `{ this is not json ` leaves the scene untouched (still 4 objects),
keeps the dialog open, and raises
`Import failed: Expected property name or '}' in JSON at position 2`.

*Round trip identity*: harness check `export/import round trip is identity-preserving` —
`serializeScene()` → load a different preset → `applySceneData()` → the canonical digest is
byte-identical (`5cb76535`).

*Deterministic representation* (**Copy scene**): canonical JSON with sorted keys, numbers fixed
to 4 dp, animation phase excluded, prefixed with an FNV-1a digest. Verified:

| property | observed |
|---|---|
| animation time advanced by 7.3 s | digest unchanged (`fe76d83d`) |
| camera yaw +15° | digest changes (`50966219`) |
| yaw restored | digest returns to `fe76d83d` |
| object moved 0.25 units | digest changes; restoring returns the original digest |

*Persistence*: after editing the scene to 10 objects (added box + cylinder, material change,
reorder) and reloading the page, all 10 objects came back from `localStorage`
(`["Ground","Body","Ring","Arm","Bud","Wave shell","Cutaway","Glow core","Box","Cylinder"]`).

### 4.10 Inspect shader compilation and runtime errors — **pass**

*Normal path*: console on load reads
`[isosurface] ready · ANGLE (…SwiftShader driver) · object cap 24 · shader built in 2.1 ms`.
`agent-browser errors` is empty across the whole session, and `ISO.stats().errors` (a counter fed
by `window.onerror` / `unhandledrejection`) is **0**.

*Failure path*: Diagnostics tab → **Test error handling** injects an undefined symbol into the
fragment shader. Result (`screenshots/10-shader-error.png`): a modal reporting
`Shader fragment compile failed`, the verbatim driver log
(`ERROR: 0:526: 'this_symbol_does_not_exist' : undeclared identifier`), and a numbered source
excerpt with line 526 highlighted — the line number is parsed out of the driver log.
**Rebuild shader** recovers (`{"ready":true,"status":"OK","ms":31.2}`).

*Unsupported WebGL*: reproduced for real in the `sdfh` session, which could not create any WebGL
context. The application shows a styled explanation of what it needs and why, states what the
browser actually reported, and offers **Continue without rendering** so the editor, import and
export still work (`screenshots/09-no-webgl2-fallback.png`).

*Context loss*: `webglcontextlost` / `webglcontextrestored` handlers are wired (the former shows
a dismissible panel and stops the loop, the latter rebuilds the program). **not-run** — no
reliable way to force a context loss in this environment without the debug extension.

---

## 5. Defects found by this validation, and their fixes

### 5.1 NaN scanline at the horizon (rendering correctness) — fixed, retested

A 1–2 pixel pure-black row appeared across the sky in *final* mode only. Bisected in the browser
by toggling one input at a time and reading the drawing buffer back with `gl.readPixels`:

* present with the grid off, with the ground plane hidden, and with **all objects hidden** → the
  sky path, not geometry;
* present for ACES / Hejl / Linear tone mapping, absent for Reinhard → the value reaching the
  tone mapper was not a number.

Cause: `gridLayer()` computed the plane-hit distance `t = -ro.y / rd.y`. For rays pointing
slightly *above* the horizon `t` is a large **negative** number, so `exp(-t * 0.05)` overflowed to
`+inf`; multiplying by the `ok = 0` mask gave `inf * 0 = NaN`, and `mix(col, grid, NaN)` poisoned
the pixel. Turning the grid off did not help, because the multiply by zero does not sanitise a
NaN.

Fix: clamp the distance before both the position and the fade (`tc = clamp(t, 0, 400)`), and add a
final guard that paints any non-finite pixel **magenta** so a future NaN is loud rather than
silent.

Retest: full-frame sweep at 274 × 302 → `nanPixels: 0, pureBlackPixels: 0`; the regression
harness now asserts zero magenta pixels in every one of the ten view modes.

### 5.2 Reflection rays self-intersecting at grazing angles — fixed, retested

Silhouettes of metallic objects showed a dotted, noisy fringe. Isolated by setting
*Reflection bounces* to 0, which removed it entirely. Secondary rays started only
`max(uEps*14, 0.005)` above the surface, so at grazing angles they re-hit the surface they had
just left. Fix: `march()` now takes an explicit `tmin`; reflection rays start at
`max(0.012, t*0.006)` and their origin offset grows with view distance
(`max(uEps*20, 0.0025 + t*0.004)`); the glass exit ray got the same treatment.
Retest: before/after screenshots at identical camera and settings — fringe gone, reflections
intact (visible in `screenshots/02-bloom-default.png` and every later capture).

### 5.3 Narrow layout collapsed the viewport to 0 px — fixed, retested

At 390 × 844 the viewport measured `width: 0`, the canvas fell back to its 24 px minimum, and the
computed grid was `0px 0px 390px` over six rows. Cause: CSS specificity. The base rules
`aside.panel.left{grid-area:left}` / `aside.panel.right{grid-area:right}` (0,2,1) outrank the
narrow-layout rule `aside.panel{grid-area:sheet}` (0,1,1), so the panels kept asking for grid
areas that do not exist in the single-column template, and the browser auto-placed them into
implicit tracks. Fix: give the narrow rule matching specificity
(`aside.panel.left, aside.panel.right`). Retest: computed columns `390px`, viewport
`390 × 351.9`, 60 FPS.

### 5.4 Narrow layout: clipped top bar, oversized HUD — fixed, retested

At 390 px the PNG / Export / Import / Copy / Help buttons were pushed outside the top bar with no
way to reach them, and the performance overlay covered a third of the small viewport. Fix: the
top bar scrolls horizontally below 980 px, its selects shrink, and the overlay drops to a 9 px
compact form with a larger collapse target. All ten overlay fields remain present.
(The same four actions are additionally duplicated in *Scene → Scene data*, so they are reachable
without scrolling.)

### 5.5 Materials pane had no padding — fixed, retested

`.sect .sbody { padding }` is a *descendant* selector; the Materials pane builds its body outside
any `<details class="sect">`, so its content ran to the panel edge. Fix: make the rule global
(`.sbody{…}`). Retest: `panePad "8px 10px 11px"`, chips right edge 1270 vs panel 1280 — no
overflow.

### 5.6 Preset composition-order bugs — fixed, retested

Because the stack is evaluated top to bottom, a subtraction or intersection placed early also
carves everything above it. Three presets had the ground plane as object 0 and therefore
destroyed their own floor, and one had an unbounded primitive:

| preset | symptom | fix |
|---|---|---|
| `manifold` | bores and the quarter cut drilled through the floor | ground unioned last |
| `arch` | the two intersect operations deleted the floor entirely | ground unioned last; pillars re-sized to meet the arch feet; glowing groove added |
| `lattice` | the clip sphere intersected ground + colonnade, so the gyroid rendered as a solid ball | gyroid made the base, clipped first, then ground/colonnade unioned on top |
| `artifacts` | an **unbounded** gyroid unioned into the scene filled all space with emissive material — a solid yellow screen | gyroid made the base and clipped with an intersect box |

Retest: `screenshots/preset-*.png` for all six. The `artifacts` preset now does its job — the
razor-thin shell, the Lipschitz-violating twist (visible banding rings), the high-frequency blob
(over-stepping speckle) and the bloated fine gyroid are all legible at `eps 5.5e-3`,
`maxSteps 64`, `stepScale 1.0`.

A note explaining the ordering rule was added above the preset table in the source, and the
scene panel already carries the same explanation for users.

### 5.7 Stale explanatory text in the object inspector — fixed, retested

Changing the composition operation updated the widgets but not the sentence describing the
operation ("Combined with everything above it using **Smooth union**" while the select read
*Subtraction*). Fix: rebuild the pane on operation change. Retest: the note tracks the select in
`screenshots/03b` (Subtraction) and `03c` (Intersection).

Two further failures during this work were bugs in the *test harness*, not the application (a
`moveObject` call that was a no-op because the object was already at that index, and a frame
comparison that did not account for the selection rim). Both were corrected in
`evidence/regression.js` and are noted here for honesty.

---

## 6. Other feature checks performed

| # | Check | Method | Result |
|---|---|---|---|
| 6.1 | Sphere tracing is genuine | `view-steps.png` shows per-pixel loop counts; `view-slice.png` shows `map(p)` on a plane; `view-grad.png` shows `\|∇d\|−1` | **pass** |
| 6.2 | 13 primitives incl. 3 procedurally deformed | Add-primitive grid: sphere, box, rounded box, cylinder, capsule, torus, plane, cone, hex prism, octahedron, wave blob, twisted bar, gyroid | **pass** |
| 6.3 | Per-object translate / rotate / non-uniform scale / rounding / material | numeric fields exercised; scale + rounding correctly **disabled** for the infinite plane with an explanation | **pass** |
| 6.4 | Six CSG operations | union, subtraction, intersection, smooth union, smooth subtraction, smooth intersection — all present, all change the frame hash | **pass** |
| 6.5 | Add / duplicate / rename / hide / show / delete / select | `Body → duplicate → rename "Ribcage" → hide → show → delete`, object count 8→9→…→8 | **pass** |
| 6.6 | Direct viewport translation | gizmo X-handle dragged 70 px with real mouse events: `pos.x −1.55 → −0.886`, Y and Z untouched, numeric field synced live | **pass** |
| 6.7 | Orbit / pan / zoom / focus / reset | toolbar buttons: yaw 34→22, pitch 15→23, dist 6→4.8; **Focus** re-targets to the selection (dist 3.23); **Frame all** fits the scene (dist 8.04); **Reset** restores exactly. Middle-button drag pans the target only (`0,1.25,0 → −0.77,1.90,0.31`) with yaw/pitch/dist unchanged | **pass** |
| 6.8 | Animation time | frame differs between t=0 and t=4.5; **Pause** stops the clock and relabels to "▶ Play"; resuming restarts it | **pass** |
| 6.9 | Materials cover diffuse / metallic / glossy / emissive / glass / translucent | 8-slot palette: Clay, Steel, Enamel, Neon (emissive), Glass (transmission 1, IOR 1.48), Copper, Checker (procedural), Jade (translucent). Refraction visible bending the checker floor in `preset-glass.png` | **pass** |
| 6.10 | Domain repetition | `manifold` bolt-hole array and `lattice` colonnade both use per-object limited repetition | **pass** |
| 6.11 | Unsupported-WebGL handling | reproduced for real, §4.10 | **pass** |
| 6.12 | Self-containment | static audit: **zero** `http(s)` URLs, exactly one `<script>` (inline, no `src`), no `<link>/<img>/<iframe>`, no `fetch`/`XHR`/`WebSocket`/`EventSource`/`importScripts`/`sendBeacon`/`@import`/`url()` | **pass** |
| 6.13 | Runs from `file://` | opened `file:///…/index.html` directly: shader compiled in 2.1 ms, 8 objects, full render, `localStorage` usable, **the only network request logged was the document itself** (`screenshots/11-file-protocol.png`) | **pass** |
| 6.14 | Performance overlay contents | FPS, frame ms, internal render dimensions, visible/total object count, average **and** max ray steps, steps at the last picked pixel, active mode, selected object, quality summary, camera — all present and live | **pass** |

---

## 7. Blocked / not-run

* **GPU-hardware performance — blocked.** No GPU is reachable from this WSL2 container
  (`/dev/dri` absent), so every measurement is SwiftShader software rasterisation. Representative
  numbers from the working session, at 1280 × 800 with the default *Bloom* preset
  (8 objects, soft shadows 44 steps, AO 5 taps, 1 reflection bounce):

  | internal buffer | frame time | FPS |
  |---|---|---|
  | 684 × 754 (0.52 MP) | ~110–120 ms | 8–9 |
  | 513 × 566 (0.29 MP) | ~216 ms* | 4.6* |
  | 442 × 404 (0.18 MP, dpr 3 phone) | ~20 ms | 50 |
  | 273 × 246 (0.07 MP) | ~16 ms | 61 (vsync-capped) |

  \* the slower readings were taken while the window was not the frontmost surface on the virtual
  display, where the compositor stops presenting and rAF is throttled; they are an artefact of the
  test rig, not of the renderer. The consistent signal is that cost scales with pixel count as
  expected and that quality controls move step counts in the predicted direction
  (21.7 → 32.3 average steps when epsilon tightens and step scale drops). What a discrete GPU
  would do with this shader has **not** been measured and is not claimed.

* **WebGL context-loss recovery — not-run.** Handlers exist; there is no reliable way to force a
  loss here.

* **Real touch input — not-run.** Pointer-event handling covers touch (including two-finger pinch
  zoom) and was verified structurally at 390 px with a dpr-3 device profile, but no physical touch
  device was available. Mouse and pen pointer types were exercised.

---

## 8. Known limitations of the delivered application

1. **Shader object cap.** The uniform budget sets the maximum number of *simultaneously visible*
   objects; on this machine that is 24 (`floor((MAX_FRAGMENT_UNIFORM_VECTORS − 78) / 8)`, clamped
   to 4…24). Scenes may hold more objects — hidden ones cost nothing — and importing a larger
   scene warns rather than failing. On a minimum-spec GLES3 device the cap would drop to about 18.
2. **Material blending across smooth seams keeps two materials.** `map()` tracks the dominant
   material plus one blend partner. Three or more materials meeting at a single seam collapse to
   the two strongest; the geometry is unaffected.
3. **Object ID at exact ties.** The "responsible object" is `argmin |dᵢ|`. Where two surfaces are
   genuinely equidistant (the seam of a smooth subtraction) the winner alternates pixel to pixel,
   visible as speckle in *Object ID* mode. It does not affect shading, and picking on such a seam
   returns one of the two truly responsible objects.
4. **Refraction is a two-interface approximation.** Entry refraction, an internal march, exit
   refraction, one scene hit behind the glass, and Beer–Lambert absorption. No internal total
   internal reflection beyond the first bounce, no dispersion, no caustics.
5. **Reflections are mirror-direction traces attenuated by roughness**, not a glossy integral, so
   a rough metal reflects a sharp image dimmed by the *Reflection blur* control rather than a
   blurred one.
6. **Non-uniform scale uses the conservative bound** `d(p/s) · min(s)`, which under-estimates
   distance for strongly anisotropic scales. It is always safe for sphere tracing but costs extra
   steps; this is visible in the *Ray-march steps* view.
7. **The infinite plane primitive has no meaningful non-uniform scale or rounding**, so both
   controls are disabled with an explanation rather than silently ignored.
8. **The ordered stack is flat, not a tree.** A subtraction applies to everything above it. This
   is stated in the scene panel and is the reason the presets union their ground plane last; a
   hierarchical graph would allow scoped operations but was not built.
