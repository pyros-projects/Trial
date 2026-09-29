# Vector & Layout Studio — validation evidence

Artifact: `index.html` (single self-contained file, ~105 KB, no external
resources — verified by grep: no `http(s)://` asset refs, `fetch`, `import`,
`link`, storage, cookies, or workers; only the SVG `xmlns` namespace string).

Tool: `agent-browser` 0.31.1 (Chrome via CDP), real pointer/keyboard input,
screenshots, a11y-tree snapshots, plus `window.__vls` read-only diagnostics to
corroborate document-space state. Viewport coords = `doc*view.k + view.t +
canvasOffset` were computed live before each gesture.

## 1. Editable opening & offline delivery — PASS

- Boot on `file://` renders Composition A "Signal": backdrop, halo ellipse,
  closed cubic blob, open cubic wave, rule, tag+label, VECTOR headline (sans
  bold), serif subhead, mono note, grouped logo mark — all editable scene items
  (`boot.png`). No console errors, no page errors.
- Composition B "Studio Card" loads via File menu — 9 roots incl. serif
  headline, swoosh curve, swatch group (`compB.png`). Objects inspected and
  editable (select/drag/inspector).
- Direct file open: PASS (all testing done via `file://`).
- Opaque-origin iframe `sandbox="allow-scripts allow-downloads"` (no
  `allow-same-origin`): app boots and is fully usable — created a rect via
  pointer drag inside it; statusbar showed "1 selected (Rectangle)", bounds,
  "items 15/200", "undo 1". Parent→frame DOM access is `SecurityError`-blocked
  (verified opaque). `evidence/sandbox-test.html`.
- No storage/cookies/clipboard/filesystem APIs used anywhere in code.

## 2. Creation & coordinate continuity — PASS

- Rect/ellipse/line/text created with real tool drags; ellipse resized
  non-uniformly via SE handle (`rectSize` gesture; opposite anchor fixed);
  inspector X/Y/W/H fields set exact values (40/60/80/40 etc.).
- Pan (space-drag: view delta tracked pointer exactly), zoom (buttons, real
  WheelEvent — harness `mouse wheel` doesn't reach canvas, noted), browser
  resize 1280×800 ↔ 390×844 — subsequent drags tracked with correct doc mapping,
  no jump, no double transform (multi-item drag moved both +60.6 doc units).
- Narrow 390×844: panels become a working drawer (`narrow.png`,
  `narrow-panel.png`), tools/inspector/layers/undo all reachable.
- Multi-select (marquee + additive shift-click), duplicate (+10/+10 offset),
  delete, arrow nudges (exact ±1/±10, coalesced). Delete/Backspace typed into a
  focused numeric field does NOT delete scene items.

## 3. Snapping — PASS

- Obj snap on / grid off, 100%: dragged right edge to within ~3 CSS px of
  target → snapped exactly (x=400 → edge=500). Landed 8 px away → no snap
  (stayed at unsnapped value).
- 200% zoom: 2-doc-unit gap (4 CSS px) → snapped; threshold stays 6 CSS px.
- Grid snap on / obj off: drag landing 2 doc units off grid → snapped to grid
  line. Grid size input configurable (default 10).
- Hidden object: not a target (edge landed inside old snap window, stayed
  unsnapped).
- Nested child via Layers: dragged inside group — sibling attracted (snapped
  exactly to sibling edge at 700); ancestor group did not act as a target.
- Pink dashed snap guides visible during drags (`snap-guide.png`).
- Numeric edits and nudges stay exact (never resnapped).

## 4. Alignment & equal gaps — PASS (spec numbers reproduced)

Blank 1200×800, three rects A(40,60,80,40) B(180,100,60,40) C(320,160,80,40):
- Align top → all y=60 exactly.
- Distribute horizontally → A stays 40, C stays 320, B → x=190, gaps 70/70.
  Sizes/order unchanged.
- Impossible case (span 200 < extents 250) → "Cannot distribute: available
  span 200 < total item extents 250 — make more room." Scene unchanged.

## 5. Groups & transforms — PASS

- Group two contiguous siblings: world geometry + paint order unchanged
  (identity group transform).
- Drag + rotate 30° + scale 150% on group → ungroup → child world bounds
  identical to 0 delta (bit-exact), paint order preserved.
- Nested group (group-of-group) works; undo/redo restored each stage.
- Noncontiguous siblings → "Cannot group: selected items are not contiguous
  siblings — occlusion would change." Different parents → "...live in different
  parents." Scene/selection untouched.
- Ancestor+descendant selected together → `selectionRoots` dedup: one +10
  translation applied once (group AND child each moved +10 doc, not +20).

## 6. Curve editing & bounds — PASS

- Pen tool drew a 2-anchor open cubic (click adds corner anchor; click+drag
  grows symmetric handles; Enter commits open, click on first anchor closes,
  Esc discards).
- Node tool + numeric point controls set endpoints (100,100)/(200,100) with
  controls (100,0)/(200,0) → measured layout bounds exactly **(100,25,100,75)**
  (cubic extrema; excludes stroke/handles).
- Moved a control point → bounds recomputed (25→45.27).
- Close path via inspector button → closed+filled path; Open reverses.
- Edited an anchor after 30° rotation and inside a group — doc↔local
  conversion via full world matrix, correct result both cases.
- Export keeps cubic geometry as `C` commands in `<path d>`.

## 7. Text & typography — PASS

- Multiline text via canvas editor (Ctrl+Enter/blur commit, Esc restores) and
  inspector textarea; family (sans/serif/mono), size, weight, align L/C/R,
  line height, fill — all applied; measured bounds consistent across
  editor/bounds/export (baseline = size×0.8, advance = size×lineHeight).
- `<img src=x onerror=alert(1)> & "layout"` stayed literal text: no DOM
  element injected, no alert, SVG contains `&lt;img ... onerror` only as
  escaped tspan text; no `<script>`/`foreignObject`/href anywhere.
- Rotated text: SVG transform `translate rotate scale` + same metrics.
- Committed edit = 1 undo step (verified via undo/redo on fresh item);
  Esc-cancelled edit changed nothing.

## 8. Layers, visibility, locks — PASS

- Front-to-back order in panel; ▲▼ reorder changed paint order ([n23,n25,n26]
  → [n25,n23,n26]).
- Hide → not rendered, not hit-testable (point inside its box hit nothing),
  excluded from SVG export, still in doc; Show restores.
- Lock → canvas drag refused ("“Text” is locked — unlock it in Layers"),
  Delete refused, opacity/style/geometry fields guarded, parent-group
  transform refused via `selHasLocked` (locked descendant inside moved group
  blocks the op). Unlock via Layers then edits work.
- Rename via double-click on layer name (commit Enter / cancel Esc).

## 9. History & cancellation — PASS

- One long drag = 1 step; slider scrub (3 live input events) = 1 step;
  text commit = 1 step; layer reorder = 1 step. Undo restores doc+selection.
- Pan/zoom/selection changes consume zero history.
- Undo → different edit → redo branch cleared (future 1 → 0).
- Esc mid-drag: geometry restored to start (558→510), no history entry.
  Window `blur` mid-drag: same restore (577.9→510). `pointercancel`/`blur`
  listeners wired the same way.

## 10. Project round trip & hostile inputs — PASS

- Real download of `project.vls.json` (schema v1). Deleted an item, reimported
  via the file input → scene byte-identical to saved JSON; selection/history
  cleared with boundary message.
- Refusals (each preserved doc, selection, undo history):
  malformed JSON ("Not valid JSON"), duplicate id ("duplicate id n15"),
  group depth >4 ("group nesting beyond 4"), `1e309`→Infinity
  ("bad transform"), unsupported type ("unsupported type \"video\""),
  250 items ("Item count 250 exceeds limit 200"), HTML/SVG file
  ("Not valid JSON"), version 99 ("Unsupported project version"),
  scale 0 ("bad transform"), 5000-char text ("bad text", cap 2000).
- Arbitrary SVG/HTML import: rejected (only versioned JSON accepted).
- Raster import: NOT implemented (optional per spec — documented choice, no
  raster workflow required).

## 11. Preview & exports — PASS

- Preview mode shows only the clean artboard (`preview.png`), Esc/button exits.
- Downloaded `artboard.svg`: vector `<rect>/<g>/<path>` geometry, artboard
  dims+bg, no script/foreignObject/event attrs/hrefs, escaped text only.
- Downloaded PNGs: 1x = 1200×800 px, 2x = 2400×1600 px (exact), RGBA;
  transparent background honored (alpha where no item covers).
- Oversize refusal verified: 2100-unit artboard @2x → "Export refused:
  4200×1600 exceeds 4096px side or 16,777,216px total." (Unreachable from UI
  since artboard caps at 2048 — 2×2048=4096 and 4096²=16,777,216 are both
  inside bounds; refusal path exercised internally.)

## 12. Session boundary & reset — PASS

- Reset (two-step, in-app — no native dialogs which are blocked in sandboxed
  iframes): restores opening composition, clears selection/history/pending.
  Verified items=11, artboard 960×640, undo=0.
- Reload → identical fresh composition each time.

## Harness limitations / honest notes

- `agent-browser` cannot hold keyboard modifiers across `mouse` commands, so
  shift-click additive select was verified by dispatching a real
  `PointerEvent` with `shiftKey:true` through the same handler path (PASS).
  Shift-snap-15° rotation and Alt-drag anchor-handle-growth exist in code but
  weren't exercised through the harness.
- `agent-browser mouse wheel` doesn't reach the canvas; zoom verified via
  zoom buttons, keyboard shortcuts, and a real dispatched `WheelEvent`.
- The error log shows `NotFoundError: setPointerCapture` entries — produced
  by the automation harness's own event dispatch (persists even with the call
  removed from the app); not an app defect.
- Stale entries in the shared error buffer reference other pages
  (localhost:8741) — unrelated.

## Remaining limitations (deliberate scope)

No raster import workflow (optional), no word-wrap/rich-text, no skew/
reflection/boolean ops/SVG import — all out of the required scope per spec.
