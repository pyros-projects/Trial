# Vector & Layout Studio — validation log

**Artifact:** `../index.html`. One self-contained file with inline CSS/JS/artwork, no external requests, and a CSP meta that blocks all network. It is built from `../src/*` by the dev-only `../build.sh`.
**Environment:** Linux (WSL2), headless Chromium via agent-browser 0.31.1, local server `python3 -m http.server 8765 --bind 127.0.0.1` (the only reachable host; the app makes no requests anyway).

**Tools used:**
- **agent-browser** (the required skill; read `skills get core` and `dogfood`) for almost all checks: real `mouse move/down/up`, `press`, `keyboard type`, `fill`, `select`, `upload`, `download`, `screenshot`, `set viewport`.
- **Playwright MCP** as a recorded substitution for three things agent-browser could not do:
  1. mouse clicks with a held modifier (agent-browser's `keydown Shift` does not set modifiers on mouse events);
  2. capturing downloads from an opaque-origin iframe;
  3. CDP touch events for `pointercancel` and pinch.

**Harness:** `ab.sh` (helpers), `tests/*.sh` (one script per check; raw output in `tests/*.out`), `tools/png.js` (PNG decoder for pixel checks), `sandbox-frame.html` (the iframe harness). The read-only `window.VLS.diagnostics()` only corroborates the result of real interactions; nothing mutates state through it.

## Results summary

| # | Check | Result |
|---|-------|--------|
| 1 | Editable opening, offline, file://, sandboxed iframe | **pass** |
| 2 | Creation and coordinate continuity (1280×800, 1100×720, 390×844) | **pass** |
| 3 | Snapping | **pass** |
| 4 | Alignment and equal gaps | **pass** |
| 5 | Groups and transforms | **pass** |
| 6 | Curve editing and bounds | **pass** |
| 7 | Text and typography, hostile text | **pass** |
| 8 | Layer order, visibility, locks | **pass** |
| 9 | Coherent history and cancellation | **pass** |
| 10 | Project round trip and hostile inputs | **pass** (raster import not implemented, so its sub-checks do not apply) |
| 11 | Scene-derived preview and exports | **pass** |
| 12 | Session boundary, Reset, reload | **pass** |

## Details (commands, observations)

### 1. Opening, offline delivery, direct file, sandbox — `tests/t01-delivery.sh`, `tests/t01b-sandbox.sh`, Playwright

**Default composition.** "Solstice poster" (800×1000) loads with 0 console errors (`screens/01-initial-1280.png`). It includes groups, nested groups, custom cubic ridges, stroked swifts and serif/sans/mono type. Clicking selects the "Sky" group; dragging the title moved it and undo/redo restored it.

**Second composition.** "Form Follows Function" (900×900) was loaded and edited throughout checks 5 and 8 (`screens/final-bauhaus-text.png`). Both templates are ordinary project documents passed through the same `projectToDoc()` validation as user files.

**Direct `file://` open.** Tested in a separate session with no server. It boots with 21 leaf elements rendered and the status "Ready — Solstice poster loaded". A rectangle was drawn with the tool (items 25/500). The only request was the file itself; no errors (`screens/01-file-url.png`).

**Sandboxed iframe (`sandbox="allow-scripts allow-downloads"`, no `allow-same-origin`)** — `sandbox-frame.html`:
- In-frame `self.origin` is `"null"` and `localStorage` throws `SecurityError`; the app never touches storage.
- Via agent-browser: an ellipse was drawn, then undo/redo worked, and Reset opened the in-app dialog (no `window.confirm`; modals are not allowed in the sandbox).
- Via Playwright: the Project JSON, SVG and PNG downloads were all delivered (`downloads/pw-iframe.*`; PNG 800×1000).
- Importing the check-10 project through the file input inside the sandbox worked, and the hostile `cycle.json` was refused.
- agent-browser `download` could not capture downloads from the opaque-origin frame, which is why Playwright was used for that part.

**Network.** No request other than the page/harness was observed in any run. The only console error ever seen was the *harness page's* automatic `/favicon.ico` 404. `index.html` now declares `<link rel="icon" href="data:,">` to avoid even that.

### 2. Creation and continuity — `tests/t02-create.sh`

**Creation.** Ellipse, line, rectangle and text were each created with their tools; the text was typed as "Hello layout". History entries: `Add ellipse, Add line, Add rectangle, Add text, Edit text`.

**Move and resize (zoom 0.6967, object snap off so deltas are exact):**
- Drag +50,+30 px moved the rect by +71.7703, +43.0622 units (expected 50/z, 30/z).
- SE handle +40,+20 px → w 229.67, h 143.54.
- W handle −30 px moved the left edge while the right edge stayed at 401.91.
- Inspector W=150, H=90 were applied exactly.

**Bounds vs visible geometry.** The rendered shape's `getBoundingClientRect` equals the mapped document bounds with **0.000 px** error at 1280×800, at 1100×720, and at 390×844.

**Continuity.** I panned (Hand tool), zoomed in twice (1.0885), and resized the browser to 1100×720; the selection was kept. A drag of +37,+23 px then moved exactly +33.9904, +21.1292 units: no jump and no double transform.

**Rotated ellipse.** At 30°, bounds are 238.6271 × 212.3573, matching w·cos+h·sin and w·sin+h·cos.

**Selection and editing:**
- The marquee selected two items; Ctrl+D created two duplicates, which are then selected; Delete removed them.
- Arrow = +1 and Shift+Arrow = +10, both exact.
- Backspace/Delete/arrow keys typed inside a numeric field deleted nothing (items unchanged); Escape restored the field's value.

**390×844.**
- `scrollWidth` is 390, so there is no horizontal page scroll.
- The panel switches between Inspect and Layers tabs.
- A drag of +30,+15 px at zoom 0.3017 moved +99.45, +49.72 units exactly (`screens/02-narrow-*.png`).
- Fixed after review: the hint bubble covered the small canvas on phones and is now clamped to one line.

### 3. Snapping — `tests/t03-snap.sh` (output `tests/t03-snap.out`)

Setup: A=(300,200,100,100), C=(100,620,100,100), B=(600,120,100,100). Grid snap off, object snap on.

- **3a, 100%:** B's left edge proposed 5 px from A's right edge (405) → **B.x=400**, guide `x:400` visible during the drag.
- **3b, 100%:** proposed 8 px away (408) → **408**, no guide.
- **3c, 200%** (after panning with the Hand tool): proposed 402.5 (5 CSS px) → **400**, guide shown; proposed 404 (8 CSS px) → **404**.
- **3d, grid only** (grid 10, object snap off): unsnapped 453 → **450**. Unsnapped 444 → **440**: every feature is 4 away, so the tie goes to the lower target.
- **3e, hidden A:** the same 405 case stays at **405**.
- **3f, A+B selected and moved 4 px:** they end at **304 / 604**; members of the moving selection do not attract.
- **3g, nested child selected through Layers:** A and C were grouped (group centre y=460 is unique to the group) and A was dragged. A proposed position 3 px from the ancestor's centre did **not** snap (457). A proposed position 4 px from sibling C's top **did** snap (A.y=520, guide `y:620`).
- **3h:** a keyboard nudge (+1) and a typed Y of 318.5 were applied exactly, with no resnap.

### 4. Alignment and equal gaps — `tests/t04-align.sh`

- On New (1200×800), A/B/C were drawn with the rect tool, then W/H/X/Y were typed.
- Align top → all y=60.
- Distribute horizontally → A.x=40, **B.x=190**, C.x=320, gap 70. Sizes and order n1,n2,n3 unchanged.
- **Impossible case:** with B widened to 300, the refusal reads "combined widths (460) exceed the span between the outermost items (360) … nothing was changed". The project JSON and the history count are byte-identical before and after (`screens/04-distribute-refused.png`).

### 5. Groups and transforms — `tests/t05-groups.sh`

- **5a:** slab and wedge (contiguous) were grouped: rendered world matrices identical, and the group is inserted at the block position.
- **5b–5c:** the group was moved to X=150, rotated 25° and scaled 1.5 via the inspector, then ungrouped with the button. Maximum world-corner drift is **0.0008 units**, and order is restored.
- **5d:** undo/redo of ungroup restores the hierarchy and selection; drift 0.
- **5e:** a two-level nested group (inner [slab, wedge], outer + arc) was rotated −40°, then both levels were ungrouped: drift **0.0015**. Undo ×2 restores the nesting.
- **5f:** disc + wedge (slab between them) → "not adjacent in layer order" refusal. Scene and selection byte-identical.
- **5g:** disc + a bar inside Registration marks › Mark top-left → "belong to different parents" refusal. Scene and selection byte-identical.
- **5h:** group `reg` and its child `mk1` selected together resolve to the single effective target `reg`. A nudge moved `mk1h` by +1 once; rotating 90° gives reg = 90° and mk1's local rotation stays 0.

### 6. Curve editing and bounds — `tests/t06-curve.sh`, `tests/t06b-closed.sh`

- **Open path:** drawn with the path tool (two press-drags create real handles, Enter finishes). The numeric point controls then set P1=(100,100), out=(100,0), P2=(200,100), in=(200,0). Bounds are **exactly (100,25,100,75)**.
- **Handle drag:** in the Node tool, dragging the out handle on the canvas moves it to (60.29,−20.57); bounds become (92.89,17.11,107.11,82.89).
- **Closed path:** three clicks plus a click on the first point make a closed path whose fill is painted. Unchecking "Closed path" sets the rendered fill to `none`; re-checking restores it.
- **Rotated path:** after rotating it 30°, dragging anchor 2 in the Node tool lands at (759.33, 379.90) for pointer target (760, 380).
- **Grouped path:** after grouping it and rotating the group 15°, a node drag lands at (519.62, 359.81) for target (520, 360).
- **Export:** SVG paths are emitted as `M … C …` cubic commands, confirmed in check 11.

### 7. Text and typography — `tests/t07-text.sh`

**Editing and history:**
- Typing multiline text in the textarea shows a live preview (`live=text`, history still 0).
- Backspace in the textarea did not delete scene items.
- Ctrl+Enter commits as **one** step ("Edit text").

**Typography controls:** serif, 44 px, bold, center alignment, line height 1.5 and fill #22aa88 were applied. Checked in both the model and the rendered SVG attributes.

**Hostile text:** `<img src=x onerror=alert(1)> & "layout"` stays a plain string.
- **Editor:** 0 injected elements, no dialog, no network request.
- **Project JSON:** holds the raw string.
- **Exported SVG:** holds `&lt;img src=x onerror=alert(1)&gt; &amp; &quot;layout&quot;`. Its element types are svg/title/rect/g/path/ellipse/line/text/tspan, with no `on*` attributes.

**Layout box vs export:** after rotating the text 20° and adding a line, the exported `transform` and every tspan's x/y/text are **identical** to the editor's rendered DOM.

**Undo and cancel:** Ctrl+Z undid the last text commit in one step and restored the selection. A further edit cancelled with Escape left the project byte-identical and the history unchanged.

### 8. Layer order, visibility, locks — `tests/t08-layers.sh`

**Order and occlusion.** At the overlap point (500,380):
- Before: editor top = slab and PNG pixel #1f4aa8.
- After "Send backward" on slab: editor top = disc, PNG pixel #e1452d, and the SVG paints the slab before the disc.
- Undo restores the order.

**Hiding the disc:**
- It is still in the project with `visible:false`, and the item count is unchanged.
- It is not hit-tested: `elementFromPoint` returns the artboard and a click selects nothing.
- It is not exported: the PNG shows background #f2ede3 there.
- Showing it again restores it.

**Locking the slab:**
- A canvas drag leaves the bounds unchanged, with the toast "“Blue slab” is locked and cannot be changed. Unlock it in Layers first."
- The item can still be selected; Delete is refused with the toast "…cannot be deleted…" and history is unchanged.
- It is still exported (SVG contains its fill).

**Locked child inside "Dot row":**
- Setting the group's X in the inspector is refused ("transforming its parent group would move it"); a canvas drag of the group is refused too.
- After unlocking in Layers, the same X edit applies: the group moves to x=200.

### 9. History and cancellation — `tests/t09-history.sh`, Playwright (touch)

- One 40-move drag, one opacity slider drag (1 → 0.65), one label scrub on font size (112 → 132) and one layer reorder each produced **one** entry.
- Undo stepped back through them, restoring geometry, styles, hierarchy and selection; redo re-applied them.
- Panning, zooming and changing the selection between undo steps consumed no history.
- An undo followed by a nudge cleared redo (redo count 0; the redo attempt reports "Nothing to redo.").
- **Escape mid-drag:** geometry was restored on release; history unchanged.
- **Focus loss mid-drag** (opening another tab): the operation was cancelled and restored, with no history.
- **Touch `pointercancel` mid-drag** (CDP `touchCancel`, in the sandboxed iframe): restored, no history.
- A completed touch drag is one step. A two-finger pinch zoomed 1.83 → 3.65 with no history.

### 10. Round trip and hostile inputs — `tests/t10-roundtrip.sh`

**Round trip.**
- The project contained paths, styled multiline text with `<trip> & "quotes"`, nested transformed groups (Swifts rotated 12° ×1.2), a hidden star and a locked title. It was downloaded, then changed (a delete and a move), then reimported through the file input.
- The confirm dialog explains that import replaces the document and clears history.
- Artboard and items (IDs, types, order, parents, transforms, locks, visibility, text) are **identical**. History is 0/0 after import.

**Hostile files.** Each of these was refused with the scene, selection (`["sky"]`) and history (1/0) unchanged and no dialog opened:
- malformed JSON;
- duplicate ID;
- cyclic parents;
- `1e309`;
- unsupported type `image`;
- 504 items (limit 500);
- 2001-character text;
- 36 anchors;
- 9 nested group levels;
- a `url(https://…)` fill;
- an unknown `href` field;
- version 2;
- a missing parent;
- zero scale;
- a file over 5 MB;
- `drawing.svg` (with script/image);
- `page.html`;
- SVG markup renamed to `.json`.

Every refusal message names the reason. No element was injected and no request was made to `example.com`.

**Raster import:** not implemented by design (it is optional). PNG/JPEG files are refused as unsupported.

### 11. Preview and exports — `tests/t11-export.sh`

**Edits before export:** sun fill → #39c0a0, one Far-ridge handle moved (out Y=500), title → "EQUINOX", Halo ring hidden, Swifts sent to back.

**Preview:** an `<img>` built from the SVG export blob (800×1000) is shown full-window with no editor UI (`screens/11-preview.png`).

**SVG:**
- Root is `width=800 height=1000 viewBox="0 0 800 1000"`, with the background `rect #0f1530` first.
- Contains EQUINOX and not SOLSTICE; contains the sun colour; the halo is absent; every path is cubic and the edited handle is present.
- Contains no script, foreignObject, image, `on*`, href, `data-*`, class or `url(`.

**PNG:**
- 1x is 800×1000 and 2x is 1600×2000.
- Background pixel is #0f1530. The sun centre shows the blended new sun colour (#e1b566, sun core at 85% over #39c0a0).

**SVG vs PNG fidelity.** Chromium rendering the downloaded SVG, compared with the PNG export: **mean absolute difference 0.30/255**, with 0.17% of pixels differing by more than 40 (glyph antialiasing).

**Transparent background:** the PNG corner has alpha 0 and the SVG has no background rect.

**Export size limits:**
- A 2048×2048 artboard at 4x (8192 px) is refused: "PNG 8192×8192 px exceeds the 4096 px per side limit". The document and history are unchanged.
- 2x (4096×4096, exactly at the limit) exported.
- Typing an artboard width of 4000 was refused (the width stayed 2048).

### 12. Reset and reload — `tests/t12-reset.sh`

**Reset with pending work.** I moved the title, imported the check-10 project (confirmed), nudged, and left a text edit pending (`live=text`). Reset then opened a confirmation explaining that it is a non-undoable fresh-session boundary. After confirming:
- the document is **identical** to the initial composition;
- selection is empty and history is 0/0;
- there is no live transaction, pointer operation, modal or preview;
- the document name is back to "Solstice poster".

**Pending import.** I started an import and pressed Reset, then waited 2.5 s: still identical to the initial composition, with no delayed callback re-applying content. Pending file reads and timers are keyed to a session token that Reset increments.

**Reload.** After an edit and a page reload, the document is identical to the initial composition. localStorage, sessionStorage and cookies are all empty, and no console errors appeared.

## Failures found and fixed during validation

1. **Unfilled shapes swallowed clicks.** A `.hit { fill: transparent }` CSS rule made the whole interior of unfilled shapes hittable (the Frame rect captured clicks). Fixed by giving only the text hit-rect an explicit transparent fill. Retested in checks 5 and 8.
2. **IDs consumed per pointer move.** Live creation used a new ID on every pointer move; the ID is now fixed per gesture.
3. **Multi-selection click.** A plain click on a member of a multi-selection now selects just that item. A drag still moves the whole selection.
4. **Additive selection on touch.** Added a "Multi-select" toggle, because touch has no Shift key. Real Shift-click and Ctrl-click were also verified, via Playwright.
5. **Inexact zoom.** Pressing `1` gave zoom 0.9999999999999999; zoom is now set exactly. Also added `2` = 200% for precise tests.
6. **Export matrix precision.** Exported rotation matrices went from 4 to 6 decimals, which cut the measured ungroup drift from 0.12 to 0.0015 units.
7. **Hint bubble on phones.** The 4-line hint covered the canvas at 390 px wide; it is now one line.
8. **Favicon request.** Added `<link rel="icon" href="data:,">` so the browser never makes a favicon request.

Test-harness mistakes I made and corrected (not app bugs):
- a stale HTTP cache — fixed with a cache-busting `?v=` URL;
- relative upload paths — fixed with absolute paths;
- a viewport reset by `open`;
- wrong expected values: 200% snap maths, and snap targets I had overlooked.

## Known limitations

- **Raster import is not implemented.** Images, SVG and HTML are refused on import.
- **Limits:**
  - Items ≤ 500 (above the required 200).
  - Anchors ≤ 32 per path.
  - Group nesting ≤ 8 levels (above the required 4).
  - Text ≤ 2000 characters per item.
  - Names ≤ 120 characters.
  - |coordinates| ≤ 100000 and |world bounds| ≤ 1e6.
  - Transform scale 0.01–100; combined scale 1e-4–1e4.
  - Import files ≤ 5 MB.
  - PNG ≤ 4096 px per side and ≤ 16,777,216 px total.
- **Font-dependent text widths.** Text width is measured with the browser's installed system fonts (serif/sans/mono stacks). The same layout is used for editing, bounds, preview and export. An exported SVG opened on a machine with different fonts may therefore show slightly different glyph widths.
- **Ungroup and opacity.** Ungrouping a semi-transparent group multiplies its opacity into each child. That is exact for non-overlapping children and approximate where children overlap.
- **Undoable layer state.** Visibility and lock toggles are undoable document edits. Locked items can still be hidden or shown and unlocked from Layers, but not renamed or edited.
- **Open paths never paint fill;** fill appears when the path is closed.
- **Testing gaps.**
  - Downloads from the sandboxed iframe and Shift/Ctrl-click were verified with Playwright, not agent-browser.
  - Audio is not applicable.
  - No manual test was run on a physical touch device; touch was checked with CDP touch events only.
