# FORM SDF Studio — validation evidence

Artifact: `../index.html`. Validation uses the installed `agent-browser` CLI with its version-matched `core` and `dogfood` workflows. No alternate browser automation tool was substituted.

## Environment and initial checks

- Browser: Chromium through agent-browser, ANGLE Vulkan SwiftShader. Actual renderer details are recorded in logs.
- Direct file navigation: **PASS**. Opened `file:///home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/index.html`.
- External network: HTTP and HTTPS requests are explicitly aborted. Initial request list contains only the local file document.
- Initial shader compilation/link: **PASS**. `studio.diagnostics.shaderCompiled === true`, no GL errors, no uncaught errors, empty console.
- Initial desktop viewport: 1280 × 800, internal render 618 × 492 at 80%, DPR 1. Screenshot: `screenshots/01-desktop-initial.png`.

Exact setup:

```sh
agent-browser skills get core
agent-browser skills get dogfood
agent-browser --session sdf --allow-file-access --args '--enable-unsafe-swiftshader' --download-path /home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/evidence/downloads open about:blank
agent-browser --session sdf network route 'https://**' --abort
agent-browser --session sdf network route 'http://**' --abort
agent-browser --session sdf set viewport 1280 800
agent-browser --session sdf open file:///home/pyro/projects/naked/astra/bench/08-sdf-csg-studio/index.html
agent-browser --session sdf snapshot -i
agent-browser --session sdf screenshot evidence/screenshots/01-desktop-initial.png
agent-browser --session sdf errors
agent-browser --session sdf console
agent-browser --session sdf network requests
agent-browser --session sdf eval 'JSON.stringify(studio.diagnostics)'
```

## Numerical checks

`node evidence/tests/core.test.cjs`: initial expected failure because the application did not exist (`logs/core-red.txt`). The first implementation run exposed an agent-authored test choosing a point where reordered CSG happened to have the same distance. The probe was corrected to the overlap, where order changes the result. No supplied requirements, fixtures, or evaluator files were altered.

Current result: **PASS** (`logs/core-green.txt`): primitive signs, required types, conservative scaling zero surfaces, ordered union/subtraction/intersection, smooth composition, hiding, stable complete JSON round trip, invalid object type/count/scale rejection, and no external script/style references. Embedded scripts also parse with Node's `vm.Script`.

## Findings during initial visual inspection

1. **UI layout**: the five-object scene list was unnecessarily short, leaving lower objects behind a scroll while preset space was large. Screenshot `01-desktop-initial.png` demonstrates this. The list/preset flex allocation was corrected; `02-desktop-refined.png` shows all five rows.
2. **Rendering presentation**: the default ground/horizon transition was too sharp and the grid too prominent. The finite march range and fog/ground contrast were inspected; atmospheric falloff and ground values were adjusted and visually rechecked.
3. **Performance display**: initial on-demand rendering submitted only one frame, so the FPS field remained a dash before any interaction. An initial brief active sampling period and a zero initial reading were added; resting rendering will still pause to save power.

## Main workflow coverage

Completed. Final acceptance results and corrected failures are recorded below.

## Completed desktop workflows

**PASS:** Added a sphere and box through the Add object menu, renamed them “Boolean base” and “Cutting box”, changed scale on all axes, translated the box and rotated Z by 15°. Changed Operation through Union → Subtraction → Intersection → Subtraction. Actual silhouettes and cut interiors change consistently (`04-csg-union.png`, `05-csg-subtraction.png`, `06-csg-intersection.png`). Field/sign/state observations are in corresponding JSON logs.

**PASS:** Actual mouse click at (540,425) selected the sphere; click at (680,369) selected the cutter on its cut face. GPU probe recorded object ID 2, 15 steps and distance 9.419 world units (`09-picked-cutter.json`). Reordering the cutter to the top changes it to the base field and combines the sphere by union; moving it back restores subtraction (`10-reordered.png`). Changed cutter material to metallic and copper color (`11-copper-cut.png`).

**PASS:** Move tool, pointer down at (680,380), drag to (705,350), pointer up changed cutter position from [0.65,0.5,0] to [0.8458274,0.7878332,-0.1639544]; the actual cut and numeric controls update (`12-direct-translation.png`, JSON log).

**PASS:** Final, normals, depth, object ID, ray steps, shadow visibility, ambient occlusion and SDF slice were selected through the visualization control. Screenshots `13`–`19` show actual outputs. Slice keyboard arrows change Z to 0.02. A slice legend overlap and a stale selected-pixel count were observed; both were corrected and retested below.

**PASS:** Real keyboard typing “-0.75” into Position X followed by ArrowUp retains focus and yields -0.65 in both input and scene (`20-input-continuity.json`). Duplicate, delete, undo, redo and hide/show were exercised. Hiding the cutter visibly restores the sphere (`20-hidden-cutter.png`).

**PASS:** Real orbit, pan, wheel zoom, focus selected, and camera reset were exercised. Camera snapshots are in logs `21-camera-*`.

**PASS:** Set resolution to 50%, maximum steps to 64, epsilon to .002, maximum distance 80, shadows 8, AO 2, reflections off, and adjusted exposure/FOV with keyboard arrows. Internal dimensions become 386×308 and settings persist (`22-quality-settings.png`, JSON log).

**PASS:** Downloaded real JSON and PNG through the export dialog. PNG signature and dimensions 386×308 verified, 124462 bytes. Actual downloaded files are in `downloads/`.

**PASS:** Copy JSON resolves and displays “Scene JSON copied to clipboard.” The automation session cannot read the system clipboard (`NotAllowedError: Read permission denied`), so independent clipboard-content readback is **BLOCKED**. This is a browser-session permission restriction; no substitute success was fabricated.

**PASS:** Invalid JSON displays an inline syntax error and retains the working scene (`24-import-invalid.png`). An early automated upload ran before a download existed because the preceding clipboard-read command had failed; that attempt is not counted as an import pass. The corrected round trip downloaded the file, deleted the selected object (count 2→1), uploaded the existing file, clicked Import scene, and verified restoration to two objects. Exported JSON exactly equals the imported serialization and the serialization after reload (`27-import-verified.json`, `28-persistence-verified.json`).

**PASS:** Loaded mechanical, impossible arch, liquid glass, lattice and precision presets through their buttons (`29`–`33`). Played the glass deformation animation, waited until time advanced, paused, and reset time to zero. Live state logged in `31-animation-pause.json` and `32-animation-reset.json`.

Tool note: installed agent-browser `find label` supports fill but not a select subaction. After that unsupported command, native `agent-browser select '#operation' ...` was used for the labeled select. One auto-scroll click of an offscreen button was covered by the footer; explicit `scrollintoview '#new-scene'` made the same button clickable. Neither is counted as a successful action until the retry.

## Review findings, fixes and final retests

- **FIXED — Extreme transforms could leave schema bounds.** A near-parallel axis could amplify a 100 px drag into Z = -3664.66, while import validation accepts only ±1000. Interactive changes now clamp positions and camera targets, wrap yaw, and guard near-parallel axis motion. `review-regression.cjs` failed before the fix and passes afterward (`review-red.txt`, `final-core-tests.txt`).
- **FIXED — Maximum imported ID could overflow on add/duplicate.** Allocation now chooses the first unused positive ID instead of incrementing the largest imported ID. A valid ID of 1000000000 now supports further creation and serialization. Covered by the same numerical regression.
- **FIXED — Fragment uniform capacity.** The first shader used 224 vec4 object uniforms plus settings, exceeding the minimum uniform allowance on some WebGL2 devices. Object data now occupies a std140 uniform buffer, retaining the 32-object limit. The final compiled block is 5120 bytes. Actual final shader compilation, GPU picking and CSG outputs were rechecked. Minimum-spec physical hardware was not available for a hardware test.
- **IMPROVED — Transform evaluation.** Inverse rotation coefficients and animated translation are computed once per object per frame, instead of evaluating rotation trigonometry inside every field sample. A separate test compares inverse matrices with independent forward XYZ rotations, including animated spin (`transform-regression.cjs`). This is an implementation optimization; no unsupported hardware speedup claim is made.
- **FIXED — Mobile focusability and import label.** Closed drawers are inert and excluded from keyboard/accessibility navigation. The compact import button retains its accessible name. Final mobile inspector input was exercised after these changes.
- **FIXED — Slice layout and diagnostic freshness.** The slice slider and legend no longer overlap. Last-selected pixel readings are refreshed from the actual GPU after edits and mode changes. Final `74-final-slice.json` records steps = 0 in slice mode, slider bottom below the legend's top, and a 615 px viewport. Screenshot `74-final-slice.png` shows the final result.
- **FIXED — High-DPI → desktop resize feedback loop.** After returning from DPR 3 mobile emulation, the canvas's intrinsic height set the grid item's minimum height. The workspace was 711 px tall but the view area grew to 1326 px and the timeline was pushed offscreen. The browser raised `ResizeObserver loop completed with undelivered notifications.` This was reproduced (`52-resize-failure.json`, `53-resize-reproduced.png`, `videos/resize-before.webm`). The view area now has min-height:0, the grid row has minmax(0,1fr), and the canvas is absolutely sized inside its viewport. The same device/desktop transition now yields viewport 772×615, timeline y=724–773 and no errors (`54-resize-fixed.json`, `videos/resize-after.webm`). Render dimensions also respect the driver's limits.

Screenshots `41`–`53` were taken during investigation of the resize problem and are **not** the final layout acceptance evidence. The first plane-probe attempts in that phase missed the surface; they were not passes. Final plane creation, rotation and mouse picking succeeded at (850,650), selecting ID 3 with 18 actual ray steps and distance 7.3695 (`68-plane-verified.json`). Dragging the X handle from (711,581) to (741,581) changed only X to 0.3224093, keeping Y=-1.4 and Z=0 (`69-axis-translation.json`). A procedural checker appearance was then applied through Texture and Surface controls (`69-procedural-checker.png`).

The recording tool created a fresh page context, which restored the preset and reset its download configuration. One later automated download reported `Downloaded file not found at expected path`; its dependent comparison was not counted as a pass. A clean final session with an explicit download directory successfully repeated download, deletion, import and reload. A wait attempted while the failed-download export dialog remained open also timed out; this was an automation-sequencing failure, not counted as a successful probe check. The final session repeats the affected work with its actual visible state verified.

## Final acceptance results

**PASS — Self-contained delivery and direct opening.** A clean session, without `--allow-file-access` or any init script, opened the final file directly. All HTTP and HTTPS requests were blocked before navigation. `logs/final-network.txt` contains only two successful local-file document requests (initial load and reload), and no external resources. There is no build or runtime dependency.

**PASS — Actual CSG / materials / diagnostics.** The final renderer was exercised through union, subtraction, intersection, smooth union and smooth subtraction (`58`–`62`) and final, normals, depth, object ID and steps (`63`–`67`). These were inspected visually. Earlier shadow and AO views also derive from the actual field. The final glass material was rendered with reflections disabled (`75-glass-reflections-off.png`).

**PASS — Final import/export and persistence.** `downloads/final-roundtrip.json` is a real 3783-byte downloaded scene. The selected object was deleted (five objects became four), the file was uploaded, and five objects were restored. The complete imported serialization and serialization after reload are byte-for-byte identical to the downloaded file (`73-final-roundtrip.json`, `73-final-persistence.json`). The earlier real PNG export is valid, 386×308 and 124462 bytes. Copy/paste verification restored the exact exported JSON through actual Ctrl+V input (`44-clipboard-paste.json`), so content verification is complete despite the restricted clipboard-read API.

**PASS — Desktop / narrow layout and input.** Final screenshots: `final-desktop.png` (1280×800), `final-mobile.png` (390×844), and `final-mobile-inspector.png`. The final mobile inspector changed Position X through a labeled numeric input, then returned to desktop and reset the preset. No horizontal page overflow was observed. High-DPI emulation was separately exercised at 393×852 / DPR 3; the DPR cap of 2 produced 629×1010 internal rendering at 80%.

**PASS — Graphics errors and recovery.** Actual `WEBGL_lose_context` loss showed a clear recovery panel and preserved scene data; restoration recompiled the shader and resumed rendering (`45`, `46`). Explicit development-only fault injection tested unavailable WebGL and invalid shader source (`47`, `48`); the application displayed the driver error and could still export JSON. Those intentional shader errors are isolated in the fault-session log. The final clean browser has an empty console and zero uncaught errors (`final-browser-console.txt` and `final-browser-errors.txt`, both zero bytes), and `final-diagnostics.json` reports no WebGL errors.

**PASS — Final numerical checks.** All three Node suites pass: primitive fields and CSG, schema/state invariants, and precomputed transform equivalence. Test harnesses and fault-injection scripts are outside the delivered HTML.

## Limits and coverage not claimed

- The renderer supports up to 32 objects. Non-uniform transforms and deformation use conservative bounds; very thin surfaces or low step budgets can still expose numerical artifacts, deliberately demonstrated by the precision preset.
- Glass is a tinted transmission / Fresnel approximation; reflections use an environment or one additional field bounce, not a full path tracer.
- **NOT RUN:** Physical GPU and physical mobile-device performance. This environment uses SwiftShader software rendering. Observed active rates varied considerably: about 0.8 FPS in the five-field animated, probed scene and roughly 6–7 FPS in the two-field draft regression; a later unprobed final run reported 19.7 FPS (visible in `final-desktop.png`). These are actual software-driver observations, not hardware performance claims. The renderer stops drawing at rest; the overlay labels this on-demand behavior, and quality controls allow lower resolution/steps.
- **NOT RUN:** Physical multitouch pinch testing and exhaustive testing of every numeric boundary / browser-native color-picker interaction. Pointer, keyboard, viewport tools, responsive drawers, high-DPI emulation, core schema bounds and the primary workflows were exercised as described.
- The clipboard-read API remained permission restricted, but the complete copy workflow was independently verified by pasting into the application's import field. No required workflow remains blocked by that restriction.

No unresolved application failure was found in the final acceptance run. This document is agent-authored validation evidence, not an evaluator score or evaluator-owned report. Exact commands are in `commands.md`; observed screenshots, downloads, logs and videos are preserved without deleting failed-attempt evidence.

Final artifact: 114150 bytes. SHA-256: `2c2df3d5556bb00d47db944e26a6b09f8be20d7e725bde19ceb66378b2afef4f`. Fresh numerical, syntax and dependency audit output is in `logs/final-verification.txt`. All three task-owned browser sessions were closed after validation.
