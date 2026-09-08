# Form Lab — validation evidence

The delivered artifact is `../index.html` (one self-contained HTML file). This is an agent-authored record of observations, failures, fixes, and retests. It is not an evaluator score or report.

## Outcome

The required main workflow passed in Chromium through the installed **agent-browser 0.31.1** CLI. The file was opened directly with `file://`, and HTTP and HTTPS requests were blocked. No runtime server, external assets, libraries, fonts, imports, or services are required.

Final screenshots:
- `screenshots/39-delivered-desktop.png` — desktop workspace.
- `screenshots/40-delivered-mobile.png` — narrow preview.
- `screenshots/27-final-mobile-box-selection.png` — narrow graph selection.
- `screenshots/32-expanded-preview.png` — expanded live preview.
- `screenshots/38-safe-recovery-final.png` — valid output with locally limited node thumbnails.

Final browser diagnostics are in `delivered-diagnostics.json`. The clean startup measured 24 fps / approximately 16 ms submission-and-copy time at an adaptive 256 × 256 preview with a requested 512 × 512 resolution. Timing varies with the browser’s software graphics implementation. Pausing was verified to restore the requested 512 × 512 / four-sample quality. Export quality is independent of adaptive playback.

`delivered-errors.log` and `recovery-final-errors.log` are empty. `delivered-console.log` is empty. The earlier `clean-final-console.log` intentionally contains the sampling-budget warning from the error-recovery test. `delivered-network.log` and `clean-final-network.log` contain local document navigations only.

## Tooling and exact entry commands

Read the installed `.agents/skills/agent-browser/SKILL.md`, then the version-matched guides:

```sh
agent-browser skills get core
agent-browser skills get core --full
agent-browser skills get dogfood
```

Started direct-file validation:

```sh
agent-browser --session formlab open file:///home/pyro/projects/naked/astra/bench/19-node-graphics-studio/index.html
agent-browser --session formlab set viewport 1280 800
agent-browser --session formlab network route 'http://**' --abort
agent-browser --session formlab network route 'https://**' --abort
agent-browser --session formlab reload
agent-browser --session formlab snapshot -i
```

The final clean session used the same commands with `--session formlab-final`; narrow checks used `set viewport 390 844 2`. There was no substitution for agent-browser.

Commands and observed browser state are preserved in `browser-commands.log` and `workflow-results.jsonl`. The executable workflow scripts contain the exact selectors, pointer coordinates or bounding-box calculations, key presses, inputs, waits, and assertions:

```sh
python3 evidence/browser-workflow.py
python3 evidence/browser-animation.py
python3 evidence/browser-persistence.py
python3 evidence/browser-presets-mobile.py
python3 evidence/browser-final-regression.py
python3 evidence/browser-color-final.py
node evidence/core.test.cjs
python3 evidence/verify-exports.py
```

These are chronological session scripts, not independent fixtures that reset the application before every test. Some runs stopped at findings and were resumed at the documented failed step after a fix or corrected synchronization. They never call application mutation functions as a replacement for UI interaction. Browser evaluation is used to read graph state, diagnostics, bounding boxes, and real Canvas pixels. All graph mutations in browser workflows use controls, pointer events, keyboard input, or file upload.

## Workflow results

| Check | Result | Observed behavior / evidence |
|---|---|---|
| Direct-file startup, offline dependencies | PASS | Real WebGL2 output from 9 nodes / 12 edges. HTTP(S) blocked; only file document requests. Repeated in a clean browser session. |
| Parameter → graph → pixels | PASS | Paused at frame 0, changed Color ramp Contrast from 1.25 to 1.85. Canvas hash changed `aed9e283` → `72f0559e`. `03-parameter-edit.png`. |
| Add and move nodes | PASS | Added Number from library, changed its coordinates through header dragging; later repeated via command search at 390 px width. |
| Drag-compatible wire | PASS | Dragged Number #10 output to Color ramp #7 Factor. Edge changed to `10 → 7`; image hash changed `72f0559e` → `9027ae5b`. Changed Number to 0.2 and hash became `777d4da5`. Repeated after compiler changes. `04-connected-number.png`. |
| Incompatible connection | PASS | Color output → Output execution Trigger rejected with “Incompatible connection: color → exec.” Edge count stayed 12. `05-incompatible-connection.png`. |
| Illegal cycle | PASS | Domain warp output → its upstream Fractal noise UV input rejected with “Cycle detected.” Existing graph and edge count preserved. `06-cycle-rejected.png`. |
| Disconnect, Undo, Redo | PASS | Disconnected Factor in inspector, Undo restored Number edge, Redo removed it, Undo restored it. Restored procedural Sine input through tap-to-connect. |
| Copy, paste, duplicate, delete | PASS | Actual Ctrl C / V created node 11, Delete restored 10. Ctrl D and Delete repeated correctly. Final temporary node removed. |
| Selection and history | PASS | Shift pointer box selected all nine starter nodes. Header selection after Undo retained Redo. Touch-friendly box-selection button also selected all nine at 390 px. |
| Pan, zoom, fit, minimap | PASS | Background drag and Space-drag changed camera translation; zoom increased scale; Fit restored a complete graph view. Minimap click changed the viewport. |
| Frame, collapse, comment, context menu | PASS | Ctrl G created a frame. Time collapsed and expanded. Right-click graph → Add comment created the entered note. Comment editing/deletion controls were subsequently added; those two controls were not separately browser-tested. |
| Resizable panels | PASS | Dragged vertical separator and horizontal inspector separator; measured right panel at 608 px and inspector at 226 px. Expanded preview exceeded 400 px. |
| Pointer focus loss | PASS | Began a node drag, switched to another real browser tab, returned, and read `interaction === null` **before** releasing the pointer. No stuck drag. |
| Playback, pause, reset, step | PASS | Space started playback, time and image pixels changed; pause stopped; reset returned to 0; frame step advanced exactly 1/30 s. |
| Numeric keyframes / interpolation | PASS | Contrast keys at 0 s = 1.85 and 2 s = 0.65; scrubbed timeline; selected linear interpolation; curve and diamonds visible. `08-keyframes.png`. |
| Color keyframes | PASS | Edited Shadows through the hex field and added keys at 0 s = `#2233aa`, 2 s = `#ee8844`. Linear midpoint independently verified as `#885e77`. Core tests also cover smooth/linear endpoints and hold behavior. |
| Preview inspection and navigation | PASS | Selected intermediate Fractal noise #5; root switched to 5. Real pixel readout observed `252,235 · RGBA 122 99 146 255 · #7a6392`. Preview zoom, drag, Fit, 3×3 tiling, checkerboard, and frozen comparison/divider exercised. `09-tiling-preview.png`, `10-frozen-comparison.png`. |
| Diagnostics | PASS | Tested RGB and isolated R; red output had equal R/G/B. Settled luminance `[81,81,81,255]`, derived normal `[206,28,142,255]`, node-ID `[41,130,77,255]`, range `[0,81,51,255]`, invalid-pixel view `[9,18,11,255]`; timing, cache/dirty, resolution views rendered their overlays. |
| Presets | PASS | All ten gallery previews compiled from node graphs, including after the final sampling-limit change. Opened every preset through its card. All had nonconstant rendered pixels; range checks are in `workflow-results.jsonl`. `12-presets.png`. |
| Complex graph / narrow editing | PASS | Opened Alpine terrain: 24 nodes / 28 edges, changed its ramp, added a 25th node on mobile, edited its value, dragged it, zoomed, played and paused. `13-complex-terrain-desktop.png`, `14–18-mobile*.png`. |
| Desktop / narrow layout | PASS | 1280 × 800 and 390 × 844, including DPR 2. Narrow document scroll width was exactly 390; Graph / Preview / Inspector navigation and parameter entry worked. Final narrow Contrast edit to 1.4 was reflected in graph state and reset to 1.25. |
| Named project save/reload | PASS | Saved “Validation currents” locally; changed Offset to 0.35; reopened saved project and verified Offset restored to 0. |
| Autosave / direct-file reload | PASS | Reloaded delivered file and compared all restored nodes to saved nodes. Named projects and autosave use localStorage, with visible storage-failure guidance. |
| JSON export/import | PASS | Downloaded actual JSON, parsed it on disk, uploaded it through the file input, and verified graph name, nodes, edges, and keyframes. Final JSON is `downloads/delivered-project.json`. |
| Invalid JSON recovery | PASS | Duplicate IDs rejected without project mutation. Inherited node type `constructor` rejected as unknown in both unit and real-browser import tests (`inherited-type-rejection.json`). |
| Compact graph text | PASS | Shared compressed text was 1,033 bytes versus 2,219 bytes of compact JSON. Loaded through the real share-text dialog and restored project data. `downloads/currents.form`. |
| PNG export and fidelity | PASS | Downloaded/decoded 256 × 256 RGBA PNG. Export while viewing intermediate #5 was **pixel-identical** to the settled final Output at the same size and time. Files: `final-from-intermediate-verified.png`, `live-final-verified.png`. |
| Animation sequence export | PASS | Exported TAR with four actual PNG frames at 0, 1/30, 2/30, 3/30 seconds and a manifest. All PNGs decoded and had different pixel hashes. Repeated a successful sequence after canceling prior exports. |
| Export bounds and cancellation | PASS | Oversized 2048 px sequence rejected before rendering. Escape, ×, backdrop, and Cancel all ended in `exporting=false` without a late download. A later valid sequence succeeded. |
| GLSL source export | PASS | Downloaded the final generated fragment shader with project/uniform context: `downloads/delivered-final.frag`. This is source export; no standalone GLSL player is claimed. |
| Theme / contrast | PASS | High contrast selected and rendered (`23-high-contrast.png`), then restored dark theme. Paper theme is implemented but was not separately visually checked. |
| Safe graph sizes | PASS | A 68-node / 195-edge graph rejected paste that would create 201 edges; original JSON remained byte-for-byte unchanged and validated. Depth bounds tested in both node orders. `21-paste-boundary.png`. |
| Incomplete/expensive graph recovery | PASS | Disconnected Output showed useful incomplete status and recovered with Undo. Excessive nested blur retained last valid preview with node context; reconnecting Noise directly to Output restored rendering, while expensive disconnected thumbnails were locally marked. `22-incomplete-output.png`, `33–38-*.png`. |

## Failures, fixes, and retests

1. **Initial syntax failure — fixed.** Script parsing caught a missing brace in node pointerdown before browser use. Corrected it and reran parsing and core tests. Removed a strict-mode property assignment to a boolean in Space handling.
2. **Slow initial rendering — fixed within the supported adaptive model.** First implementation measured approximately 224–338 ms at 512 px / four samples (3–4 fps). Adaptive playback resolution and sampling lowered this to a clean-session 256 px / approximately 16 ms / 24 fps. The first large terrain shader also stalled compilation. Specializing compilation to the chosen root and ancestors, caching up to 24 programs, and using one antialias sampling loop reduced terrain to approximately 20 ms at 128 px and reload to a few seconds. Paused quality and export fidelity were retested.
3. **Preview too small / overlapping graph caption — fixed.** Reduced preview margins, adjusted inspector size, removed overlapping subtitle, and added an expanded preview view. Screenshots preserve initial and final layouts.
4. **Export dialog closure did not cancel a sequence — fixed.** Real reproduction: start 120 frames, press Escape; `exporting` remained true while modal was gone (`19c-export-cancel-confirmed.png`). Added immutable export snapshots and operation tokens, cancellation on every dialog exit, and checks after async encoding/before download. Escape/×/backdrop/button retests passed; valid export afterward passed.
5. **Redo lost on selection — fixed.** Header pointerdown used to checkpoint even without movement. Checkpoint now occurs only when a drag actually begins. Selecting another header after Undo retained and executed Redo.
6. **Paste/validation boundary — fixed.** Candidate paste now validates before committing or autosaving. The 201-edge test rejected atomically. Frame count/geometry and added-node positions/IDs are also bounded.
7. **Depth and inherited-property validation — fixed.** Test-first reproductions found that visited nodes bypassed depth accounting, and inherited JavaScript object properties could be treated as node/parameter definitions. Memoized longest-path depth and own-property checks pass the regression tests. Real malformed import remains editable and unchanged.
8. **Held Shift pointer continuity — fixed and made accessible without modifiers.** The CLI’s held key did not propagate its modifier flag to separate mouse commands. Tracking held Shift now supports continuous input, and a box-mode button also supports selection without a keyboard. Both were tested with genuine keyboard/pointer actions.
9. **Native color fill did not enter the intended hex — addressed.** CLI filling a native color input yielded black. Added explicit validated hex fields alongside native color pickers; entered the requested hex values and verified real color keyframes. Native OS picker automation is not claimed.
10. **Costly disconnected thumbnail raised an exception — fixed.** After repairing a too-expensive final graph, thumbnail generation still visited a costly disconnected node. Each thumbnail now catches its own budget failure, displays a local error, and preserves the valid final render. Tightened the expansion budget to 256; all ten presets remain below it (largest preset estimate 146). A fallback thumbnail scheduling path also ensures paused fast-loading graphs get thumbnails. Final recovery session had zero uncaught errors.
11. **Exact interior hold keyframe — fixed.** A three-key unit test showed hold interpolation returned the prior key at an exact interior timestamp. Advancing to the correct interval fixed it; core suite passed afterward.

## Automation findings and coverage accounting

- The CLI mouse command requires integer coordinates; rounded measured bounding-box coordinates in the harness. This did not change application behavior.
- Inspector disconnect controls required `scrollintoview` inside the scrollable panel. Retested the same flow after scrolling.
- Early pixel reads and share import assertions ran before the next render/decompression finished. Corrected waits to observe actual render completion and modal closure; repeated the diagnostic and import flows. An initial export/preview comparison also ran against a different still-playing project after a relative-path upload; the verified comparison uses absolute uploads, a checked project identity, paused time, and settled resolution. Only the verified pair is a fidelity pass.
- Starting recording created another browser tab/context. Downloads in that recording context were canceled by the browser even though a PNG blob was generated; the same exports succeeded in the original tab. `cancel-before-fix.webm` captures that unsuccessful recording setup and is **not** claimed as a successful cancellation reproduction. The confirmed reproduction is the later screenshot plus live exporting state.
- One later automation reload returned a newly launched `about:blank` tab and timed out. Reopened the explicit file URL, reapplied network blocking, and reran the final exports and checks successfully. No claim is made about the cause of that automation-session restart.
- Pillow/pip were unavailable. Used the standalone, standard-library PNG decoder in `verify-exports.py` to decode PNG filters, verify dimensions/pixels, and inspect the TAR. No optional-tool absence blocked image verification.

## Remaining limits / not-run checks

- **WebGL2 is required.** There is no CPU fallback. Context-unavailable/lost messages are implemented; forced GPU context loss/restoration and non-Chromium browsers were not tested.
- Animation export is a **PNG frame-sequence TAR with manifest**, not GIF or video. Four-frame export and cancellation of long sequences were tested; a full 120-frame archive and 2048 px still export were not run.
- Real pointer and keyboard interaction was tested, including DPR 2 narrow layout. Physical touch hardware and pinch gestures were not tested. Zoom buttons, tap-to-connect, and box-selection mode provide touch-accessible alternatives.
- Timing is browser CPU submission plus Canvas-copy wall time, not a GPU hardware timer. Cache diagnostics concern compiled program reuse and dirty graph state, not cached node pixel buffers. Blur and normal/light derivatives are approximations, and the optional linear-to-display conversion uses gamma 2.2.
- Every preset was rendered and opened; not every individual node type was compared against an independent mathematical pixel oracle.

No unresolved failure remains in the exercised main workflow. The limits above are explicit coverage/implementation limits, not passes.
