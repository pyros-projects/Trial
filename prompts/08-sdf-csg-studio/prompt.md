# SDF and Constructive Solid Geometry Studio

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements
Create a polished, interactive real-time 3D signed-distance-field and constructive-solid-geometry modeling studio that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, procedural materials, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, textures, models, or network dependencies.

Render the scene using sphere tracing or another genuine signed-distance-field ray-marching technique. Support at least spheres, boxes, rounded boxes, cylinders, capsules, tori, planes, and one procedurally deformed primitive. Each object must expose translation, rotation, non-uniform scale where mathematically supported, rounding, and material controls.

Implement constructive-solid-geometry operations including union, subtraction, intersection, smooth union, and at least one smooth subtraction or blending operation. The scene editor may evaluate objects as an ordered field-composition stack or as a hierarchical graph, but object ordering and operations must have visible and logically consistent effects.

Provide a scene panel that allows the user to add, duplicate, delete, select, rename, reorder, hide, and edit objects. Include numeric transform controls and direct viewport manipulation for at least translation. Mouse or pointer picking must identify the visible SDF surface and select the responsible object or operation rather than relying only on list selection.

Provide orbit, pan, zoom, focus-selected, and camera-reset controls. Camera movement and object editing must continuously update the ray-marched result.

Render the final scene with calculated surface normals, multiple procedural materials, directional and ambient lighting, soft shadows, ambient occlusion, fog or atmosphere, tone mapping, and optional reflections or refraction. Materials must include at least diffuse, metallic, glossy, emissive, and translucent or glass-like appearances using a coherent approximation.

Include multiple visualization modes for final shading, surface normals, depth, object or material ID, ray-march step count, shadow visibility, ambient occlusion, and an SDF slice or distance-field inspection view. Visualization modes must derive from actual ray-marching data.

Provide controls for render resolution, ray-march maximum steps, hit epsilon, maximum distance, shadow quality, ambient-occlusion quality, reflection bounces or approximation, exposure, field of view, background, grid visibility, and animation time.

Include several impressive presets such as a smooth abstract sculpture, mechanical cutaway, impossible arch, glass object, repeating procedural structure, and a scene designed to reveal ray-marching artifacts or numerical weaknesses.

Support exporting and importing the complete scene as JSON, copying a deterministic scene representation, and exporting a screenshot as PNG. Preserve the current scene in localStorage.

The application must adapt to browser resizing, support high-DPI displays appropriately, remain usable on common desktop hardware, and provide clear shader-error or unsupported-WebGL handling.

Display a compact performance overlay containing frames per second, internal render dimensions, object count, average or selected-pixel ray steps, active visualization mode, selected object, and quality settings.

Use defaults that immediately display a striking editable sculpture. Treat SDF correctness, CSG behavior, picking accuracy, editor usability, shader quality, diagnostic usefulness, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: SDF and Constructive Solid Geometry Studio

Add and transform at least two primitives, then change composition operations to subtraction and intersection and confirm that visible geometry changes coherently. Use viewport picking, reorder objects, change a material, and exercise final, normal, depth, ID, and ray-step modes. Resize the viewport, change quality settings, export and import a scene, and inspect shader compilation and runtime errors.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
