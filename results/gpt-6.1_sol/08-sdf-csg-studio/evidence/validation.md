# FIELD validation — agent authored

Artifact: ../index.html. Date: 2026-09-29. Browser tool: installed `agent-browser` CLI, core and dogfood workflows loaded using `agent-browser skills get core` and `agent-browser skills get dogfood`. Main workflows use agent-browser; targeted native CDP input/readback supplements are described below.

## Test environment and commands

- `node evidence/tests/core.test.cjs`: initial RED (missing delivered scene core), then GREEN 5/5 after implementation. Tests execute the embedded core with Node VM, covering complete deterministic round trips, invalid primitives/operations/scales/numbers, duplicate IDs, oversized scenes and empty scenes.
- `node --check /tmp/field-app.js`: passed after first integration.
- `python3 -m http.server 8080 --bind 127.0.0.1`: temporary inspection server; not a runtime dependency.
- Browser launch: `agent-browser --session field-studio --allowed-domains 127.0.0.1,localhost open http://127.0.0.1:8080`.

## Current status

All required workflows have completed browser verification as recorded below, including direct-file offline operation. Hardware frame rate and additional browser families are not-run. No evaluator score is authored here.

## First browser inspection

`evidence/tests/browser.sh` wraps every agent-browser command with the same session and allowed-domain launch flags (127.0.0.1, localhost only). An initial tool configuration mismatch relaunched the session at about:blank; `agent-browser doctor --offline --quick` passed (16 pass, 0 warn, 0 fail). This was a browser-launch configuration issue, not an application pass. The retained screenshot 01 is the blank tool state. Reopening with consistent flags produced the app.

- PASS: 1280×800 actual WebGL2 scene rendered; screenshots/02-desktop-render.png. Vertex and fragment shaders compiled and linked; picking framebuffer complete; glError 0, 4 visible objects, internal resolution 576×379. See logs/initial-diagnostics.json and initial-console.txt.
- Observed visual defect: materials appeared overly pale and smooth blend layers had visible color transitions. Investigating color transfer and smooth-operation material ownership before retesting.
- Observed request: local `/favicon.ico` 404. Will embed a data-URL favicon and retest requests. No external scene assets loaded; preview images are locally generated data URLs.

- Color fix RED→GREEN: `node evidence/tests/color.test.cjs` initially failed (no sRGB transfer function); passed after adding the transfer function and using it for GPU uniforms. Actual coral uniform changed from [0.80392,0.50196,0.37255] to [0.61050,0.21586,0.11444]. Screenshots 03 and 04 retain the result. Smooth composition now blends procedural colors using the same CSG weights. Normals screenshot 05 shows continuous normal gradients; shadow screenshot 06 confirms remaining dark regions derive from calculated shadow visibility.
- PASS network isolation probe: `fetch('https://example.com/field-network-isolation-probe')` rejected with Failed to fetch under the allowed-domain browser session. This was an intentional test probe, not an application dependency.
- Observed performance concern in the software browser: roughly 2 FPS while active. Investigating redundant per-sample trigonometry and unbounded floor marching; will move rotation setup to CPU and bound solid marching without changing SDF evaluation.

- Animation persistence RED: while playing, live time 1.68 s vs stored 0.14 s. Cause: wall-clock `Date.now()` was compared with `performance.now()`. After correcting clocks, a second run still had 1.35 s lag due to the deferred save interval in the slow browser. Revised playback to flush at most every 250 ms and on page hide. Retest pending below.
- Rotation setup RED→GREEN: `node evidence/tests/rotation.test.cjs` initially failed (precomputed inverse quaternion missing), then passed for X/Y/Z quarter turns and distance preservation. The optimized shader still hit Soft junction at the same 6.80613-unit center distance; center steps reduced from 15 to 13. Software-browser throughput remains about 2 FPS for this complex preset; idle rendering stops after interaction, reducing resource use. No unsupported hardware acceleration is claimed.

## Input continuity failure and fix

The original two-primitive snapshot showed position edits ignored after rename. A later attempted repro (screenshots 09/10 and videos/rename-continuity-failure.webm) was initially labeled a failure, but addressed the wrong scene/object after recording changed tool state; that retry is excluded as described below. Inspection found the rename change handler rebuilt the inspector during the focus transition, detaching numeric inputs. Revised rename to update the list/title only, preserving the inspector DOM. Repetition spacing also updates its single row without rebuilding focused controls.

Correction to continuity repro: the recorded retry's assertion addressed object array index 1 after the recording tool had switched the visible scene back to Soft study; that assertion therefore did not establish a rename failure. Keep the video as tool-state evidence, not a valid application repro. The original two-primitive snapshot did show the first position edit ignored after rename. The revised test addresses the selected object by ID: rename Continuity probe, fill Position X 0.5, observed actual 0.5 / pass true. No inspector replacement occurs during rename blur.

PASS controlled persistence: edit scene title to Persistence probe, wait until localStorage contains that title, verify `SceneCore.parse` succeeds, reload, and observe both live and stored title remain Persistence probe. Normal reload preserves the scene. Recording-tool state switching is excluded from this application check.

A locator command `find label Operation select` was unsupported by this CLI version; doctor passed and the workflow was corrected to the documented `select '#object-operation' subtract`. Screenshot 11 is a tool-affected Soft study state and is not subtraction evidence. Corrected public workflow starts with screenshot 12.

## Completed public workflow (actual controls and rendered results)

`bash evidence/tests/public-workflow.sh` ran in the isolated `sdf-sol61-08-validation` session at 1280×800. `evidence/tests/browser.sh` supplies the same session and allowed-domain flags on every command. This avoids the earlier launch-state ambiguity.

1. Loaded Soft study, deleted its four objects through Delete, added Sphere and Box through Add object, and renamed scene/objects through labeled fields. Edited positions, radius, rotation and nonuniform scale through labeled numeric inputs. `logs/public-union-scene.json` records sphere position [-0.2,0.1,0], radius 1.2, Y scale 1.1, Z rotation 18°; box position [0.45,0.1,0.5], Y rotation 20°, Z scale 1.35. PASS: screenshot 12 shows the combined volumes.
2. Selected Subtract through Operation. PASS: screenshot 13 shows a coherent box-shaped cavity in the sphere. Probed actual GPU field samples to locate a visible cut face, selected the sphere through its list button, then sent native mouse move/down/up at that cut face. PASS: selection changed to cutter ID 2. `logs/public-cut-picking.json` has pass true; screenshot 14 shows the responsible cutter selected.
3. Selected Intersection. PASS: screenshot 15 shows the shared clipped volume. Moved the cutter above the sphere with Move up. PASS: screenshot 16 and `logs/public-reorder.json` show order [2,1]; the box seeds the stack and the following union sphere enlarges the result. Moved it back. Changed Surface to metallic, entered #856baf, selected marble. PASS: screenshot 17 shows the resulting procedural material.

`bash evidence/tests/modes-camera.sh` then exercised X-axis gizmo dragging with native pointer input, Ctrl Z, Ctrl Shift Z, orbit, right-drag pan, F to focus and R to reset. PASS: X changed 0.45 → 0.7700856 with Y/Z retained; undo restored 0.45 and redo restored the drag. Orbit changed azimuth/elevation, pan changed target, focus targeted the box and reduced distance, reset restored the preset camera. Exact states are in drag-*.json and camera-*.json.

PASS: selected all eight Visualization mode options and inspected their screenshots (`screenshots/mode-0.png` through mode-7.png) and actual diagnostics. Normals show orientation gradients, depth follows camera distance, ID separates actual owning fields, ray steps vary with tracing work, shadow and AO show calculated visibility/occlusion, and the SDF slice shows the actual composed zero contour. Changed slice normal to Z and range to 3 (screenshot 19).

PASS: changed resolution 50% → 100%, epsilon 0.001, maximum distance 80, shadows 48, AO 6, reflections 2, atmosphere Cool slate and grid off. Actual internal dimensions changed 384×253 → 768×505; screenshots 20 and quality-*.json preserve the results. Later keyboard range-control checks changed maximum steps to 32, FOV to 22°, and exposure to 3.95 (`logs/keyboard-quality-settings.json`).

Tool correction: CLI mouse coordinates must be integers; rounded projected gizmo coordinates after its argument rejection. CLI `mouse wheel` delivered its event at (0,0) on the header rather than the requested canvas position; Live inspection with `mouse move 910 310`, `mouse wheel 150`, and a window wheel listener observed deltaY150 at client (0,0), targeting HEADER with defaultPrevented false. The canvas at the intended position was verified. Supplemental native CDP `Input.dispatchMouseEvent` at (910,310) exercised the real canvas wheel handler; PASS camera distance 7.4 → 5.6490083 (`logs/native-wheel.json`). No synthetic JS wheel event or application camera mutation was used.

## GPU field correctness and regression checks

Commands: `node evidence/tests/make-fixtures.cjs`; `bash evidence/tests/analytic-fields.sh`; `python3 evidence/tests/assert-fields.py`. The script imports independently specified scenes through the actual file-import UI and changes primitive/operation/rotation controls. Center probes read the renderer's genuine one-pixel picking framebuffer. Expected distances and ownership were derived analytically, not copied from output. At camera [0,0,6], nonuniform scale [1,2,0.5], the expected front distances include sphere 5.5, box 5.65, rounded box 5.58, cylinder 5.675, capsule 5.81, torus 5.36, undeviated center of the deformed sphere 5.5, rotated plane 6, and Y-rotated sphere 5. CSG expected distances/owners are union 4.6/12, subtraction 6.2/12, intersection 4.8/11, smooth union 4.58392857/12, and smooth subtraction 6.2/12.

PASS: all 14 checks within 0.01 world units with correct owning IDs. Final rerun after fixes also passed all 14; `logs/final-analytic-results.txt` records measured values. This establishes actual fields and ownership, beyond screenshots. See screenshot 23.

Independent read-only review found three material defects; details and re-review are in `review.md`:

- FAIL → fixed → PASS: large smooth blends escaped primitive-only acceleration bounds. Actual coincident radius-0.2 spheres with blend 4 initially missed. Conservative bounds now include smooth-min expansion and nonuniform/deformation distance slopes. Hit 4.79927 vs expected 4.8 (logs/large-blend-red.json, large-blend-green.json, final-large-blend.json; screenshot 24). A deformed nonuniform regression hit 3.85992 vs expected 3.86077.
- FAIL → fixed → PASS: an array color passed regex coercion. Added string validation; actual malformed file import now shows a color error and preserves the prior serialized scene exactly, renderer ready (`logs/malformed-color-ui.json`, screenshot 25). `node evidence/tests/review-regressions.cjs` records red and green behavior in review-regressions-red/green.txt.
- FAIL → fixed → PASS: independent dimension caps stretched supersampled images. Shared cap factor preserves aspect. Actual CSS 1368×768 at 200% became 2048×1150; portrait/landscape DPR1/2 cases also passed (`logs/capped-aspect.json`, screenshot 26).

## Exchange and persistence

Used labeled Scene JSON textarea, Import scene, file upload, Download JSON, Copy JSON, and PNG buttons. `bash evidence/tests/exchange.sh` records invalid JSON handling, file round trip, PNG download and reload.

PASS: malformed JSON reports an inline parse error without replacing the scene (screenshot 22 and logs/invalid-import-result.json). Downloaded complete scene to `public-scene.json`, imported that actual downloaded file, and compared deterministic serialized text before/after/reload: exact equality, 2138 characters. `public-scene.png` is a real downloaded PNG with valid signature and 384×253 IHDR dimensions, verified with Python `struct`. The export is the rendered viewport.

Tool correction: relative upload/download paths produced an empty input/canceled transfer in this environment. Retried with absolute paths; the real JSON and PNG downloads and uploaded round trip passed. The successful commands in exchange.sh use absolute paths. No export success is inferred solely from a toast.

PASS: native clipboard contents exactly equal deterministic scene JSON, 3676 characters (`logs/clipboard-native-final-readback.json`). Clicked the actual Copy JSON control. Initial CLI/native readback attempts were denied. `Browser.setPermission` for clipboard-read immediately before the native CDP read allowed full readback. The earlier permission failures are preserved. There is no injected/mock clipboard value.

PASS: localStorage title/complete-scene reload equality. Playback save retest also passed: live 1.3166 s, stored 1.0833 s (0.2333 s lag), actual uploaded Y position 0.21999085 matches 0.22*sin(time*1.2), and the sphere hit distance changed with motion. Paused time 1.6166 s restored exactly and remained paused. Reset time returned zero; keyboard timeline input produced 0.03 s. `bash evidence/tests/animation.sh` (then animation-resume.sh after correcting unsupported `find label ... focus` to raw `focus`) and animation-*.json preserve exact actions/states. Screenshot 33.

## Mobile, DPI, and resizing

`bash evidence/tests/mobile.sh` ran at 390×844, DPR2. PASS: opened scene drawer, added Box, closed it, opened inspector, renamed Narrow box then immediately edited X=0.5, Y=0.15, rotation Y=20°, scale Z=1.3. Changed glossy material to #87b0a5. Duplicated it to unique ID19, hid the copy, moved it up, showed it, deleted it, closed drawer, orbited through real pointer drag, selected ray-step mode, and changed resolution. Final scene retains two objects and coherent camera state. Actual native resolution was 780×1146 for CSS viewport 390×573 at DPR2; half resolution was 390×573. Inspector and scene controls remain accessible in scrollable drawers. Screenshots 27–30 and mobile-*.json show results; no uncaught mobile errors.

PASS: native two-finger touch pinch and pan on the same mobile canvas, sent with supplemental CDP `Input.dispatchTouchEvent`. Camera distance 7.4 → 5.55 (120/160 pinch ratio); target moved with finger center. No app-state mutation was used. `logs/mobile-native-pinch.json`, screenshot 36.

PASS: resize between 1280×800, 390×844 DPR2, and 1920×1080; rendering and gizmo adapt, including aspect-preserving 2048 cap. Native mouse/keyboard editing and the two-finger touch flow were exercised. Physical mobile-device performance remains unmeasured.

## Direct-file / no-dependency check

`bash evidence/tests/direct-file.sh` creates a separate session, opens about:blank, sets offline on BEFORE navigating to the delivered `file:///home/pyro/projects/naked/sol61/08-sdf-csg-studio/index.html`, then reloads it. Initial attempt using allowed-domains rejected file URLs with “No hostname in URL”; removed that hostname-only restriction in this file-only session and used full offline mode. Local HTTP validation retains the allowed-domains restriction.

PASS: actual file-protocol offline render, compiled shaders, glError0, default sculpture, added/renamed Offline sphere, edited Position X=1.2, saved, reloaded, and restored that exact object. No server was reachable or required for this check. Screenshot 32, logs/direct-file-*.json/txt. Direct-file resource-performance list was empty; network log contains file documents and generated data images only, with zero external URLs and zero failures.

PASS: static artifact checks: no external script src, stylesheet link, remote asset src/url, fetch, XMLHttpRequest, WebSocket or importScripts calls. All HTML/CSS/JS/GLSL/SVG and procedural previews are embedded or generated. Final HTTP request log has exactly seven requests: the local HTML and six generated data-URL preview images; zero external URLs or failures. No cached external assets were needed.

## Presets and renderer errors

`bash evidence/tests/presets-and-recovery.sh` clicked Cutaway, Impossible arch, Glass house, Lattice and Stress test (Soft study was already extensively tested). PASS: screenshots preset-*.png show each actual ray-marched scene, glError0. Center ownership included Central spindle, Suspended light, Crystal vessel, Repeated cells and Smooth cavity. Stress starts at 32 steps/epsilon0.018 in ray-step mode; keyboard End raised it to 256 and numeric epsilon to 0.0005. Actual center work changed 22 → 26 steps and distance 7.02403 → 7.03777, revealing precision sensitivity (screenshot 34).

PASS: separate Chrome session launched with --args '--disable-webgl'. Actual error explains WebGL2/hardware acceleration requirement; ready false, draw count0. JSON export still downloaded a valid scene. `evidence/tests/no-webgl-browser.sh`, screenshot 31 and unsupported-webgl-* logs.

PASS: actual WebGL context-loss extension produced the visible error. Injected an intentionally invalid shader only into the live browser DOM, restored context, observed real compilation failure and error log, restored original shader, clicked visible Retry renderer through its labeled button, and verified correct surface picking and glError0. Screenshot 35. Initial attempt to click hidden Retry was rejected by automation; the corrected fault harness used real context loss to expose the control.

FAIL → fixed → PASS: successful retry previously retained stale error diagnostics/footer. Success now clears the error/log and restores “Sphere tracing · WebGL 2 · no meshes”. `bash evidence/tests/shader-recovery-retest.sh` repeated loss/failure/retry; `logs/shader-recovery-green.json` has ready true, error null, overlay false, correct Soft junction hit. Intentional faults are kept in fault-test-console.txt, distinct from the clean final run.

## Final verification and coverage limits

Final commands: `node evidence/tests/core.test.cjs` (5/5); `node evidence/tests/color.test.cjs`; `node evidence/tests/rotation.test.cjs`; `node evidence/tests/review-regressions.cjs`; extract embedded scripts then `node --check evidence/tests/scene-core.check.js` and `node --check evidence/tests/studio-app.check.js`; final actual-browser field rerun, large-blend retest, Soft study screenshot, console/errors/network checks.

PASS: screenshot 37 is the final artifact at 1280×800. `logs/final-diagnostics.json`: shaders compiled/linked, framebuffer complete, ready true, error null, WebGL2, glError0, four visible objects, 576×379 internal pixels. `logs/final-uncaught-errors.txt` is empty. Final console contains only renderer initialization info. No failed or external requests.

| Check | Final status |
| --- | --- |
| Eight primitives, transforms, five operations and analytical ownership | PASS, 14/14 GPU checks |
| Actual public editing, subtraction/intersection, picking, ordering, materials | PASS |
| Eight visualization modes, quality, camera, translation, undo/redo | PASS |
| Desktop, mobile drawers, resize, DPR2, native pinch/pan | PASS |
| JSON import/export, invalid imports, native clipboard, real PNG | PASS |
| Full-scene and animation localStorage persistence | PASS |
| Actual direct-file offline operation / no external runtime resources | PASS |
| Unsupported WebGL, context loss, shader fault, successful recovery | PASS |
| Clean final errors/console/network | PASS |
| Hardware-accelerated throughput, physical mobile devices, Firefox/Safari | NOT-RUN; hardware/browser coverage unavailable in this run |

No unresolved reproduced application failures remain. Software SwiftShader rendering was roughly 2–8 FPS during active interaction, depending on scene/mode/quality; hardware throughput was not measured. The app stops continuous work when idle and exposes resolution/step/shadow/AO/reflection controls. Extreme anisotropy/deformation and high blend radii can conservatively enlarge tracing bounds and cost performance. The stress preset intentionally demonstrates low-step/coarse-epsilon artifacts. Glass/reflections are coherent approximations, not a physically exact path tracer. The scene editor supports up to 32 objects; reflection approximation up to two bounces. Audio is not part of this application.

Main workflows used installed agent-browser 0.31.1 after reading its version-matched core and exploratory-testing (dogfood) workflows. Small native CDP supplements targeted only the uniquely tagged validation page, for the wheel targeting issue, clipboard read permission, and native multi-touch input; their source is evidence/tests/native-cdp.cjs. No optional missing tool prevented the main validation.
