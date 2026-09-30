# Fieldwork — validation record

Agent-authored evidence for `../index.html`. This is a development and validation record, not an evaluator report or score.

Final outcome: required desktop and narrow workflows passed. Direct-file delivery and offline local HTTP passed. Twenty engine checks pass. Actual graph edits change GPU-rendered pixels. Project JSON, share text, PNG, PNG sequence ZIP, WebM, and baked GLSL exports were exercised. Historical failures are preserved below and in the logs.

## Environment and setup

- Workspace: `/home/pyro/projects/naked/sol61/19-node-graphics-studio`.
- Runtime: one HTML file with embedded HTML/CSS/JS/SVG/GLSL, definitions, presets and controls. No external libraries, imports, images, fonts, services or build step. Development scripts and server are not application dependencies.
- Browser: installed **agent-browser 0.31.1**, real Chrome. Required viewports **1280×800** and **390×844**; additional devicePixelRatio 2 check.
- Before browser use, read `.agents/skills/agent-browser/SKILL.md`, version-matched `agent-browser skills get core`, `agent-browser skills get core --full`, and `agent-browser skills get dogfood`. Full core reference: [agent-browser-core.txt](logs/agent-browser-core.txt).
- Temporary server: `python3 -m http.server 8793 --bind 127.0.0.1`. Port 8765 was occupied. No git repository existed. Architecture and completed checklist: [design-and-plan.md](design-and-plan.md).

Every HTTP command repeats this same prefix:

```sh
agent-browser --session fieldwork-http \
  --proxy http://127.0.0.1:9 \
  --proxy-bypass '127.0.0.1,localhost' \
  --allowed-domains '127.0.0.1,localhost'
```

The external proxy endpoint is deliberately unavailable; only the local server bypasses it. This isolated session had no external cached resources. During rapid edits, real CDP `Network.setCacheDisabled({cacheDisabled:true})` and `Page.reload({ignoreCache:true})` prevented stale local HTML. Final requests reach local HTML documents only.

Fresh direct-file prefix:

```sh
agent-browser --session fieldwork-delivered-<fresh-timestamp> --allow-file-access
```

Opened `about:blank`, installed `network route 'http://**' --abort` and `network route 'https://**' --abort`, then opened `file:///home/pyro/projects/naked/sol61/19-node-graphics-studio/index.html`. This test did not use the server.

Browser scripts record their **exact CLI commands** in their logs. They use navigation, labeled controls, pointer drags, keyboard entry, screenshots and actual Canvas pixel reads. Read-only state observations supplement those actions. No benchmark requirements, supplied fixtures or evaluator files were changed.

## Required workflows and results

| Check | Status | Steps and observed result | Evidence |
|---|---|---|---|
| Direct-file delivery | PASS | Fresh file session starts an animated 13-node/15-link graph; time advances. Pause, change Ramp Offset, undo: exact previous pixels return. Delete during held drag and undo work. Blob JSON download works with networking blocked. | [final-direct-file.log](logs/final-direct-file.log), [screenshot](screenshots/42-final-direct-file.png) |
| Offline HTTP | PASS | Unavailable external proxy and local bypass; no external assets requested. Final console/error arrays are empty and `gl.getError()` is 0. | [requests](logs/final-http-requests.txt), [console](logs/final-http-console.json), [errors](logs/final-http-errors.json), [diagnostics](logs/final-http-diagnostics.json) |
| Add/move/connect/edit | PASS | Ctrl K → search Constant → add; drag header; drag output into Warp Amount. Actual edge/dependency order and rendered pixel hash change. Ramp Offset edits also change pixels. | [final graph workflow](logs/final-graph-workflow.log), [screenshot](screenshots/26-final-graph-workflow.png) |
| Types and cycles | PASS | Color Ramp→Warp UV rejected with “Cannot connect”; Warp→upstream Transform rejected with “Cycle rejected.” Existing links and counts remain intact. | [graph log](logs/final-graph-workflow.log), [incompatible](screenshots/04-incompatible-connection.png), [cycle](screenshots/05-cycle-rejected.png) |
| Disconnect/history/clipboard | PASS | Inspector disconnect; Ctrl Z/Ctrl Shift Z restore exact link states. Ctrl C/V, Ctrl D and Delete change node counts correctly. | [graph log](logs/final-graph-workflow.log) |
| Graph navigation/selection | PASS | Background pointer pan, coordinate-positioned real wheel zoom, Shift box selection, Fit and minimap pointer navigation change camera/selection correctly. | [graph log](logs/final-graph-workflow.log), [editor extras](logs/editor-extras.log) |
| Frames/comments/collapse | PASS | Ctrl A/Ctrl G creates a frame with all 13 members. Context menu edits comment. Frame drag moves all members, undo restores every position. Default frame includes Blend. Collapse/expand retains connections. | [extras](logs/editor-extras.log), [frame-green](logs/frame-green.log), [preview workflow](logs/preview-workflow.log) |
| Preview tools | PASS | Switch all 12 diagnostic alternatives; channel/alpha/luma output checked for grayscale. Select Noise and eye for intermediate output. Tiling produces 768px canvas for 3×3 256px copies. Frozen pixels remain unchanged during live edits; divider drag, pointer pan, wheel zoom, fit, expand/Escape and RGBA pixel readout work. | [preview workflow](logs/preview-workflow.log), [extras](logs/editor-extras.log), [intermediate](screenshots/18-intermediate-noise.png), [comparison](screenshots/19-frozen-comparison.png) |
| Numeric animation | PASS | Two Constant keys through inspector diamonds at scrubbed times; choose interpolation; curve and dope-sheet appear. Scrub and mobile play/pause change actual pixels. | [mobile workflow](logs/mobile-workflow.log), [dope sheet](screenshots/29-mobile-graph.png) |
| Color animation/transparency | PASS | Native alpha slider Home yields transparent pixels; End opaque pixels. Two RGBA keys interpolate partial alpha. Hold preserves earlier color until next key. | [color-green](logs/color-green.log), [screenshot](screenshots/33-color-keys-transparency.png) |
| Timeline | PASS | Non-loop stops exactly at 4s; reset/step advances 1/24s at 24fps; loop wraps and pauses. Duration 99s is rejected and restored to 4s. | [color-green](logs/color-green.log), [storage](logs/storage-workflow.log) |
| Complete library | PASS | Agent-authored 41-node fixture imported; click every visible node header and inspect its live intermediate output. All 41 GPU pipelines succeed, GPU error 0, cache ≤20. | [complete-library](logs/complete-library.log), [screenshot](screenshots/34-complete-node-library.png) |
| Eleven presets | PASS | Actual gallery buttons load all presets, 13–24 editable nodes / 15–29 links, ≥8 active dependencies and nonuniform rendered colors. Terrain Ramp edit at 390×844 changes pixels. | Preset PASS entries in [runtime log](logs/final-runtime-workflow.log); later GLSL failure resolved below. [gallery](screenshots/36-complete-preset-gallery.png), [mobile terrain](screenshots/37-mobile-complex-terrain.png) |
| Narrow editing | PASS | At 390×844: create empty graph; Nodes search/add Constant and Output; move/connect them. Inspector keyboard types `-0.25` with continuing focus and correct pixels. Four panel tabs, diagnostics, timeline and Settings work without horizontal document overflow. | [mobile workflow](logs/mobile-workflow.log), [editor](screenshots/29-mobile-graph.png), [Paper settings](screenshots/30-mobile-paper-settings.png) |
| Touch/cancellation/focus | PASS | Real touch move/cancel restores old node position and clears pointers. Completed touch drag moves node; two-finger pinch zooms. Switching real browser tabs while holding a drag cancels it and restores the position. | [mobile workflow](logs/mobile-workflow.log), [extras](logs/editor-extras.log) |
| Resize/high DPI | PASS | Drag separator changes panel width. Resize between desktop/narrow. Real Chrome deviceScaleFactor 2 preserves usable layout/output. Switching inspector tabs resets scroll to show selected node title. | [extras](logs/editor-extras.log), [high DPI](screenshots/35-high-dpi-desktop.png), [inspector](logs/inspector-polish.log) |
| Persistence/share | PASS | Save named “Touch study,” create empty graph, reload named item: graph, keys and pixels identical. Autosave→real reload retains same paused frame. JSON download and FIELD1 share-text round trip preserve graph/keys/pixels. | [storage](logs/storage-workflow.log), [downloaded JSON](downloads/touch-study.fieldwork.json) |
| Imports/paste/limits | PASS | Malformed JSON/cyclic imports show errors and retain project. Cross-project paste rejects out-of-duration keys unchanged, then succeeds when duration permits them. Engine validates node/edge/key/frame limits and safe unique IDs. | [storage](logs/storage-workflow.log), [paste](logs/paste-safety.log), [import error](screenshots/32-import-error-preserves-project.png), [engine](logs/engine-final-green.log) |
| Error recovery | PASS | Import seven nested Blur nodes over cost bound; edit Color opacity: graph stays editable and exact last valid image/original diagnostic remain. Sequence export fails clearly, releases busy state and closes. Valid preset resumes rendering. | [final recovery](logs/final-exports-recovery.log), [screenshot](screenshots/40-cost-limit-retains-preview.png) |
| Blend transparency | PASS | Test masks 0 and 1 in all five blend modes against independent RGBA compositing arithmetic. Zero mask preserves base alpha; full mask respects layer alpha. | [blend-alpha-green](logs/blend-alpha-green.log) |
| Colour inspector | PASS | Reset a keyed blue/opaque colour to red/transparent: swatch, hex label and alpha slider all match the evaluated value. | [inspector-green](logs/color-inspector-sync-green.log) |
| Settings | PASS | Resolution, color space, AA and seed changes affect dimensions/pixels. Invalid seed rejected. Grid/cache toggles, Paper/high contrast and actual 96×96 thumbnail quality work. | [final controls](logs/final-exports-recovery.log), [quality](logs/thumbnail-quality-green.log), [mobile](logs/mobile-workflow.log) |
| PNG fidelity | PASS | Export paused current graph at 256px; independent PNG decoder verifies every RGBA byte matches preview at same time/resolution/4-sample AA/linear setting. Earlier 256px image also matched and contained 8,708 colors. | [final fidelity](logs/final-png-fidelity.log), [PNG](downloads/final-material.png), [reference](screenshots/39-export-preview-reference.png), [earlier](logs/png-fidelity.log) |
| JSON/GLSL | PASS | Download JSON, edit Offset, upload downloaded JSON: exact graph/time/pixels return. Baked GLSL has no uniforms and independently compiles/links in a second real WebGL2 context. | [exports](logs/final-exports-recovery.log), [JSON](downloads/final-material.fieldwork.json), [GLSL](downloads/final-material.frag) |
| Animation export | PASS | Four-frame 512px ZIP contains valid distinct PNGs and project/timeline manifest. Tested 1-second WebM: VP9, 512×512, duration 0.967719s, 23 decoded frames. | [ZIP](downloads/validation-flow-frames.zip), [WebM](downloads/validation-flow.webm), [probe](logs/webm-probe.json), [frame count](logs/webm-frame-count.json), [sequence screenshot](screenshots/15-sequence-export.png) |

NaN/invalid view was exercised on a valid graph. Deliberate numeric overflow, physical GPU-context loss, Firefox/Safari and physical touch hardware are **not-run**. These are additional coverage limits, not substituted passes.

## Failures, causes, fixes and retests

Historical FAIL logs are intentionally retained. The product failures below were fixed and their failed flows repeated.

| Failure | Fix | Evidence/retest |
|---|---|---|
| Initially no engine | First test failed with undefined compileGraph before implementation. Implemented schema/compiler/validation. | Initially 12, now **20 passed / 0 failed**. |
| Offscreen focus scrolled graph DOM/toolbar | Graph uses overflow clip; camera is the navigation mechanism. | [scroll-red](logs/graph-scroll-red.log) → [scroll-green](logs/graph-scroll-green.log), scrollTop 0. |
| Cost-invalid graph diagnostic overwritten by uniform error; failed animation export locked dialog | Skip invalid graph draws; preserve last image. Resource creation and busy cleanup guarded by try/finally. | [error-red](logs/error-recovery-red.log) → [error-green](logs/error-recovery-green.log); final recovery repeated. |
| Undo after preset load could duplicate IDs | Recompute allocator on restore; skip occupied/wrapped IDs. | [ID-red](logs/review-ids-red.log) → [ID-green](logs/review-ids-green.log). |
| Cache toggle used deleted GL programs | Track ownership; clear/rebuild on mode change. | [cache-red](logs/review-cache-red.log) → [cache-green](logs/review-cache-green.log); final GPU error 0. |
| Hold wrong at exact intermediate key | Exact timestamp match before segment interpolation. | Engine RED/GREEN and actual color-hold check. |
| Cross-project paste created invalid keys/limits | Validate complete candidate before commit; leave graph/clipboard unchanged on rejection. | Engine checks and [paste-safety](logs/paste-safety.log). |
| Delete during held drag raised undefined-position errors | Cancel drags before mutations; guard missing nodes; clear pointers on blur. | [drag-red](logs/drag-red.log) → [drag-green](logs/drag-green.log); repeated on final direct file. [Historical errors](logs/historical-pointer-errors.json). |
| Default frame omitted Blend when moved | Store its numeric ID instead of node object. | [frame-red](logs/frame-red.log) → [frame-green](logs/frame-green.log). |
| Click after box selection retained whole group in inspector | Settle to one node on unmoved release; retain group during moves. | [selection-red](logs/final-graph-selection-red.log) → final graph PASS. |
| Mobile add used hidden graph’s zero dimensions | Show graph before computing insertion point. | [mobile-add-red](logs/mobile-add-red.log) → complete mobile PASS. |
| Long mobile title pushed Help offscreen | Shrink title, compact brand, preserve actions; improve Paper tab contrast. | [overflow-red](logs/mobile-overflow-red.log) → no document overflow. |
| Color RGBA alpha ignored | Multiply RGBA alpha by separate opacity. | [color-red](logs/color-red.log) → [color-green](logs/color-green.log), actual alpha pixels. |
| Reversed remap produced black | Preserve nonzero span’s sign; epsilon only near zero. | [remap-red](logs/remap-red.log) `0,0,0,255` → [remap-green](logs/remap-green.log) `191,191,191,255` for expected .75 linear output. |
| Unsafe/duplicate frame IDs and silent truncation | Validate IDs/member arrays/40-frame bound; cap creation. | [frame-validation-red](logs/frame-validation-red.log) → 20 engine PASS. |
| Thumbnail canvas ignored quality change | Initialize/resize it with selected quality. | [quality-red](logs/thumbnail-quality-red.log) → [quality-green](logs/thumbnail-quality-green.log), actual 96×96. |
| Blend modes ignored mask/layer alpha | Use alpha-aware compositing and normalize the resulting straight RGB. At zero mask alpha was 204 instead of 51 before the fix. | [blend-red](logs/blend-alpha-red.log) → [blend-green](logs/blend-alpha-green.log), all five modes. |
| Select change did not commit an enum when no input event was emitted | Share value commit logic between input and change events. UI said mix while model/shader remained screen. | [enum-red](logs/enum-change-red.log) → all five actual mode selections in blend-green. |
| Keyed colour inspector retained old hex/alpha after reset | Synchronize hex labels and alpha controls with effective key values, preserving focused inputs. | [inspector-red](logs/color-inspector-sync-red.log) → [inspector-green](logs/color-inspector-sync-green.log). The separate baseline loop-endpoint probe passed and did not reproduce this issue. |
| Exported GLSL comments preceded required version directive | Keep #version first; add project/frame comments afterward. | [GLSL-red](logs/glsl-export-red.log) → independent compile/link PASS in [final exports](logs/final-exports-recovery.log). |

Independent read-only code review found the allocator, cache ownership, hold boundary, paste validation and interrupted-drag issues; browser testing found the remaining issues.

Tool/test corrections, distinct from app failures:

- Rounded mouse coordinates to integers. Corrected role syntax and scrolled offscreen inspector controls into view before acting. The last Settings checkbox test needed the same scrolling correction.
- Agent-browser 0.31.1 wheel events arrived at 0,0. Supplemented with **real CDP Input.dispatchMouseEvent** at explicit coordinates. Shift box selection, touch/pinch, high DPI and cache configuration use the same real browser’s CDP. Agent-browser remains the navigation/control/screenshot tool. No missing browser capability was fabricated.
- Initial HTTP flags differed between commands, relaunching to about:blank and causing a timeout. Repeating identical proxy/bypass/domain flags fixed setup. Screenshot 23 is that failed setup, not a passing app screenshot.
- Rapid edits in one Last-Modified second served stale HTML. Disabled browser cache and forced reloads before retests.
- Relative uploads yielded unreadable File references. Use absolute paths and wait for imported project identity plus completed render. [Upload probe](logs/remap-upload-probe-failure.log).
- Theme observation was corrected from a dataset to the app’s body class. Intermediate preview follows selection automatically, so the library test stopped toggling it off on every node.
- Render waits now require pending dirty/structural work to finish. Plain errors --clear did not erase error history; inspect JSON errors/count deltas and use separate fresh final sessions.
- Screenshot 02 is the palette before insertion. Legacy screenshot names 13/14 were reused during recovery; screenshot 40 is the latest error-state evidence. Historical images are not claimed as final images. The earlier validation-flow.frag is a historical pre-fix export; final-material.frag is the independently compiled final export.

## Reproduction

Scripts use Node/Python standard libraries plus installed agent-browser; none are shipped runtime dependencies. Exact browser commands and observations are in their corresponding logs.

```sh
node evidence/engine-tests.cjs
node evidence/browser-refresh.cjs
node evidence/browser-final-graph-check.cjs
node evidence/browser-mobile-check.cjs
node evidence/browser-storage-check.cjs
node evidence/browser-color-check.cjs
node evidence/browser-blend-alpha-check.cjs
node evidence/browser-color-inspector-check.cjs
node evidence/browser-remap-check.cjs
node evidence/browser-library-check.cjs
node evidence/browser-editor-extras.cjs
node evidence/browser-runtime-final.cjs --exports
node evidence/browser-direct-file-final.cjs --fresh
python3 evidence/check-png.py
ffprobe -v error -show_entries stream=codec_name,width,height:format=duration -of json evidence/downloads/validation-flow.webm
ffprobe -v error -count_frames -show_entries stream=nb_read_frames -of json evidence/downloads/validation-flow.webm
```

Run `browser-runtime-final.cjs` without --exports for all eleven presets. The retained full log contains its later historical GLSL failure, resolved by the export-only retest. RED logs are retained for debugging, not unresolved delivered failures.

Final PNG check uses the independent `decode` function in `check-png.py` on `screenshots/39-export-preview-reference.png` and `downloads/final-material.png`, asserts both 256×256 and equality of every RGBA byte. ZIP check uses Python zipfile/testzip, PNG signatures/IHDR and frame SHA-256 hashes; all four frame hashes differ. Engine source is extracted from the delivered inline engine, not reimplemented by the test.

## Remaining limits

- WebGL2 required for rendering; no CPU fallback. Editing/JSON export remain available when rendering is unavailable, with an explicit message.
- Complex cold shader/evaluation frames can pause: longest observed terrain first frame about **2.37s at 512px**. A subsequent mobile edit rendered at 256px in about **59.6ms**. Default Neon was around 23–30 rendered FPS at 512px in this environment. Adaptive resolution reduces sustained expensive frames; performance depends on browser/GPU.
- Blur is a bounded neighborhood approximation; sRGB is a gamma approximation.
- Bounds: 100 nodes, 250 edges, 1,000 keys, 40 frames, 2 MB file imports, 3 MB share strings, 2,048px PNG. Animation: 512px/30fps/12s/48 PNG frames. Sixteen named local projects; twenty cached programs.
- WebM browser encoder cadence can differ from requested rate (tested 1s yielded 23 frames). PNG sequences provide deterministic sampled frames and timeline/project metadata.
- No unresolved functional failures from required checks. Direct-file and offline HTTP are **passed**, not blocked. Other browser engines and optional fault injections remain not-run as noted above.
