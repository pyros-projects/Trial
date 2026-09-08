# Vector & Layout Studio — validation log

Agent-authored evidence. Outcomes are **pass**, **fail**, **blocked**, or **not-run**. This is not an evaluator score.

- **Artifact:** `/home/pyro/projects/naked/grok46/22-vector-layout-studio/index.html` (self-contained HTML/CSS/JS, no runtime libraries)
- **Browser driver:** `agent-browser` (Chromium via CDP), session `vls-8fe7ba940c47`
- **Local HTTP:** `python3 -m http.server 8772 --bind 127.0.0.1` in the project root
- **Iframe harness:** `evidence/sandbox.html` (`sandbox="allow-scripts allow-downloads"`, no `allow-same-origin`)
- **Date:** 2026-09-08

Network during HTTP inspection: document GETs to `127.0.0.1:8772` only. An early `favicon.ico` 404 came from Chromium, not from app code. A `data:,` icon was added so the delivered file does not request a favicon. The app never calls `fetch`, XHR, `localStorage`, or remote URLs. SVG `xmlns="http://www.w3.org/2000/svg"` is a namespace, not a fetch.

Raster import is **not implemented** (optional). No raster workflow was added to the toolbar.

## Commands used

```bash
python3 -m http.server 8772 --bind 127.0.0.1
agent-browser set viewport 1280 800
agent-browser open http://127.0.0.1:8772/index.html
agent-browser snapshot -i
agent-browser screenshot evidence/screenshots/….png
# labeled controls
agent-browser click "#btn-citrus" | "#btn-new" | "#align-t" | "#dist-h" | …
agent-browser fill "#insp-text" "…"
# canvas: PointerEvents on #board in document space (app handlers)
# hostile import: File + DataTransfer on #file-json change
agent-browser open http://127.0.0.1:8772/evidence/sandbox.html
agent-browser tab new file:///…/index.html
```

Corroboration used `window.__VLS` **getters** (document, bounds, history, parseProject, exportSVG). Mutations went through tools, inspector fields, layers, and pointer handlers.

---

## Check 1 — Editable opening and offline delivery

**Result: pass**

- Opening **Northbound** composition loaded with vectors, a cubic horizon path, and typography (`01-opening-1280x800.png`).
- Selected **Title** via Layers; inspector text commit changed `NORTHBOUND` → `NORTH STAR` (one history step). Selected **Sun**; fill changed to `#ff4d6d` (`02-edited-opening.png`).
- **Citrus Market** loaded a distinct scene (ellipse, rects, open wave, closed petal, type, line). History cleared (`03-citrus.png`).
- **Direct file:** `file:///home/pyro/projects/naked/grok46/22-vector-layout-studio/index.html` opened and rendered the editor (`11-file-url.png`). Protocol `file:`. **Not blocked.**
- **Opaque iframe:** `evidence/sandbox.html` with `sandbox="allow-scripts allow-downloads"` (no `allow-same-origin`). Parent `contentWindow.__VLS` throws `SecurityError`. Snapshot still showed the full editor; Citrus loaded inside the iframe (`07-sandbox-iframe.png`, `08-sandbox-citrus.png`).
- No app-initiated external requests.

## Check 2 — Creation and coordinate continuity

**Result: pass**

- Rect, ellipse, line, text, and path tools created real scene objects (pointer down/move/up on `#board`, then inspector refinement).
- Inspector X/Y/W/H set unrotated rectangles to exact document bounds.
- After zoom-in, a drag of +30,+10 document units landed at +30,+10 (no jump, no extra transform). Zoom was 0.7704 after fit/zoom; mapping used current pan/zoom.
- Viewports **1280×800** and **390×844** (`04-desktop-1280.png`, `05-narrow-390.png`). Narrow UI uses Board / Layers / Inspect tabs; inspector and layers remain labeled.
- Multi-select (Shift on layer rows), Duplicate, Delete, arrow nudges work. With `#item-name` focused, Delete did **not** remove the scene item.

## Check 3 — Snapping

**Result: pass**

Grid snap off, object snap on, two 100×100 rects at x=0 and x=150.

| Zoom | Unsnapped | CSS gap to x=150 | Guides | Final x |
|------|-----------|------------------|--------|---------|
| 100% | x=45 (right=145) | 5px | x=150, y=0 | **50** (snapped) |
| 100% | x=42 (right=142) | 8px | y=0 only | **42** (no x snap) |
| 200% | right=147.5 | 5px | x=150 | **50** |
| 200% | right=146 | 8px | y=0 only | **46** |

- Grid snap (spacing 10, 100% zoom): dx=4 snapped to 0; dx=7 snapped to 10. Numeric X/Y=3,3 stayed exact (not resnapped).
- Hidden sibling did **not** attract (unsnapped x=45 stayed 45; r2 `visible:false`).
- Nested child drag: ancestor group not in guides; nearby external object at x=400 **did** snap (child x→320, guide x=400). Sibling leaves remain eligible.

## Check 4 — Alignment and equal gaps

**Result: pass**

Blank 1200×800 artboard. Rects A=(40,60,80,40), B=(180,100,60,40), C=(320,160,80,40) created with tools + inspector.

- Align top: all `y=60`.
- Distribute Gap X: A and C fixed, B `x=190`, gaps **70** and **70**. Widths 80/60/80 and paint order unchanged.
- Impossible case (inner width 250 vs span 200): status `Not enough space for equal gaps: span 200.0 is smaller than the 250.0 extent of inner items.` Scene and history unchanged.

## Check 5 — Groups and transforms

**Result: pass**

- Grouping two contiguous siblings left world boxes unchanged; group identity at origin; child locals preserved; paint order wrapped as one unit.
- Group rotate 30°, translate, uniform scale 1.25: descendants moved together.
- Ungroup: world boxes matched pre-ungroup within floating error (far below 0.5). Child local rotation/scale composed (30° / 1.25).
- Noncontiguous siblings (first+third): **refused** — `Cannot group noncontiguous siblings. Reorder in Layers first.` Geometry, order, selection, history unchanged.
- Ancestor+descendant both selected, rotate 20° via inspector: group `rotation=20`, child **local rotation stayed 0 / scale 1**; child world box updated once through the parent. No double transform.
- Undo/redo around group/ungroup consume document history (grouping is a history step).

## Check 6 — Curve editing and bounds

**Result: pass**

Path tool: two clicks + Enter (open cubic). Numeric node fields (document space) set P0=(100,100) out=(100,0), P3=(200,100) in=(200,0).

- Layout bounds **(100, 25, 100, 75)** exactly (within 0.5).
- Dragging the outgoing handle to y≈40 changed bounds to ≈(100, 39.09, 100, 60.91). Undo restored (100,25,100,75) in one step.
- Open/close: closed gets fill `#5ee0c8`; reopened fill `none`.
- Path inside a rotated group: node tool hit the world-space anchor; setting Node X to 110 updated local coordinates (≈123.27) so document X is 110.
- SVG retains cubics, e.g. `M 100 100 C 100 0 200 0 200 100` and Northbound `M 80 720 C 260 720 430 610 640 500 C …`.

## Check 7 — Text and typography

**Result: pass**

- Multiline inspector text, serif/bold/center, size 28, line height 1.4, fill `#112233`.
- Literal `<img src=x onerror=alert(1)> & "layout"` stored as text in the scene, project JSON, and SVG as `&lt;img … &amp;`. No `<img>` element, no alert, no resource request. `svgHasRawImg: false`. The substring `onerror` appears only inside escaped text, not as an event attribute (`/\son\w+\s*=/` was false on Northbound SVG).
- Layout box used declared metrics (two lines × 28 × 1.4 = 78.4 height). After 25° rotation, AABB changed and SVG contained `rotate(25)`.
- Escape in the text field restored the pre-edit string; document unchanged. Committed text edits are one history step each.

## Check 8 — Layer order, visibility, and locks

**Result: pass**

- Fwd/Back swap `roots` order; export walks the same order.
- Hide: `visible=false`, object still in `nodes`. Show restores it. Hidden items skipped by hit testing; selection handles are not shown for a fully hidden selection.
- Lock: canvas drag left geometry unchanged (`Locked items cannot be moved.`). Delete refused (`Locked items cannot be deleted.`). Group transform while a descendant is locked refused (`Locked items cannot be edited…`). Unlock then drag moved the rect (~+40 x).
- Locked items remain in the tree and are included in SVG/PNG when visible.

## Check 9 — Coherent history and cancellation

**Result: pass**

- One pointer drag: undo 1→2 (single step). Undo restored start box; redo restored the drag. Intermediate pointermoves were not extra steps.
- Zoom/fit/pan do not change undo/redo counts.
- Escape during drag: live x moved 100→160, then restored to 100; history count unchanged; status `Edit cancelled`.
- Window `blur` during drag: same cancel path; geometry restored; no extra history.
- Undo then a different inspector X edit: redo count went 1→0.
- Typing in a field does not delete objects (see check 2).

## Check 10 — Project round trip and hostile inputs

**Result: pass** (raster: **not-run**)

Downloaded/serialized project includes ids, types, geometry, style, text, hierarchy, transforms, locks, visibility, artboard. Reimport after New restored 8 items and cleared history (`Imported project loaded. Undo history cleared.`).

File input (`#file-json`) + `change`, invalid cases **preserve** document, selection, and undo:

| Input | Status |
|-------|--------|
| `{not json` | Import rejected: Malformed JSON. |
| Duplicate id | Import rejected: Duplicate id: r9 |
| Self-parent group | Import rejected: Cyclic parent relationship. |
| `transform.x = 1e309` | Import rejected: Non-finite transform. |
| `type: "widget"` | Import rejected: Unsupported item type: widget |
| 200+ extra items | Import rejected: Too many items (max 200). |
| 6 nested groups | Import rejected: Group nesting exceeds 4 levels. |
| `evil.svg` / `.html` | Arbitrary SVG/HTML/script imports are not allowed. |
| Root `"href":"https://evil.example/…"` | parseProject: Remote or external resource references are not allowed. |

`sameHist` / `sameRoots` true on every rejection.

Raster import: **not-run** (not in the product).

## Check 11 — Preview and exports

**Result: pass**

- After scene edits, JSON/SVG/PNG 1x/2x captured via real download (`URL.createObjectURL` / `toBlob`).
- PNG 1x: **1200×800**. PNG 2x: **2400×1600**. `image/png`.
- SVG: vector `rect`/`ellipse`/`line`/`path`/`text`+`tspan`, artboard fill, transforms, paint order. No `<script>`, no event attributes, no `foreignObject`, no `href`/`url()`. Cubic `d` attributes, escaped text. File: `evidence/artboard.svg`.
- Preview overlay draws only the artboard (no handles/guides) (`13-preview.png`).
- Oversized export: 1x/2x are the only scales. Max artboard 2048 ⇒ 2x is 4096 per side and at most 16,777,216 pixels (square). Controls **prevent** going over the cap; the exporter still refuses if `scale * side` would exceed those limits. No 3x/4x control exists (out of spec).

## Check 12 — Session boundary and reset

**Result: pass**

- Reset restores Northbound (`NORTHBOUND`, 8 items, artboard `#1a2332` 1200×800), clears selection and history (`12-file-reset.png`). Documented in the banner as non-undoable.
- FileReader generation token: a reset during a pending read discards the stale onload.
- Reload / file reopen starts from the same initial composition.
- App does not use browser storage for the document. `file:` origin may *allow* `localStorage`, but the editor never reads or writes it. Persistence is JSON download/reimport only.

No uncaught console errors after the flows above.

---

## Limits stated in the UI

200 items, 32 anchors/path, 4 nested groups, 2000 characters/text, artboard 64–2048, JSON 1,500,000 bytes, coordinates ±1e6, scale 0.001–1000, export ≤4096/side and 16,777,216 pixels.

## Remaining limitations

- Raster import/export of embedded bitmaps is not offered.
- 1x/2x PNG cannot exceed the pixel cap at the allowed artboard sizes; refusal is implemented but not reachable through those two buttons.
- In-canvas text editing uses Enter to commit and Shift+Enter for a newline; the inspector textarea is native multiline (Ctrl+Enter / blur commits).
- Marquee additive selection and node editing are pointer-accurate; very small objects at low zoom may need Layers to select.

## Screenshots

| File | What |
|------|------|
| `screenshots/01-opening-1280x800.png` | Default Northbound, 1280×800 |
| `screenshots/02-edited-opening.png` | Title/fill edits |
| `screenshots/03-citrus.png` | Second composition |
| `screenshots/04-desktop-1280.png` | Desktop after create |
| `screenshots/05-narrow-390.png` | 390×844 |
| `screenshots/07-sandbox-iframe.png` | Opaque sandboxed iframe |
| `screenshots/08-sandbox-citrus.png` | Iframe still editable |
| `screenshots/11-file-url.png` | Direct `file://` open |
| `screenshots/12-file-reset.png` | Reset on file origin |
| `screenshots/13-preview.png` | Unobstructed artboard preview |
| `artboard.svg` / `project.json` | Captured exports |
