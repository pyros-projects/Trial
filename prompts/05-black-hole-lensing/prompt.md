# Black Hole and Gravitational Lensing Explorer

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
Create a polished, interactive real-time black hole and gravitational-lensing explorer that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, procedural textures, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, models, or network dependencies.

Render a cinematic three-dimensional view of a black hole, procedural star field, and luminous accretion disk using WebGL or WebGL2. The result must model gravitational bending through a coherent ray-integration, ray-marching, or physically motivated approximation rather than placing a flat black circle over a static background. Background rays must visibly bend around the mass, form strong lensing distortions or an Einstein-ring-like structure, and produce increasingly complex behavior near the photon-sphere region.

The accretion disk must be represented as actual geometry or a mathematically intersected volumetric or planar structure. Light from the disk should be affected by the lensing calculation. Include temperature-based emission, radial variation, turbulence or procedural density structure, gravitational redshift, and a configurable Doppler-brightening approximation that makes the approaching side visually distinct from the receding side.

Provide orbit, pan, zoom, and cinematic camera controls. Camera motion must continuously update the lensing rather than rotating a pre-rendered image. Include optional auto-orbit and several carefully composed camera presets.

Provide controls for pause/resume, simulation time, black-hole mass or lensing strength, spin approximation, event-horizon size, disk inner and outer radius, disk thickness, disk inclination, disk temperature, turbulence, Doppler strength, redshift strength, exposure, contrast, bloom approximation, ray step size, maximum integration steps, render resolution, quality level, and temporal accumulation or antialiasing.

Include multiple visualization modes for final cinematic rendering, ray step count, deflection magnitude, redshift and Doppler factor, disk intersection coordinates, distance to the black hole, and integration failure or escape classification. These modes must expose meaningful data from the rendering process rather than displaying arbitrary colors.

Add optional overlays showing the event horizon, photon sphere, disk plane, ray path for a selected screen pixel, and a small diagram explaining the selected ray's trajectory. Clicking or tapping the image should select a ray and display useful integration values.

The implementation must adapt its rendering resolution to browser resizing, support high-DPI displays appropriately, remain interactive on common desktop hardware, and provide quality presets or adaptive resolution for slower devices. Handle missing WebGL2 or shader-compilation failure with a clear and graceful explanation.

Display a compact performance overlay containing frames per second, internal render dimensions, average or selected-ray step count, quality level, active visualization mode, camera distance, and pause state.

Use defaults that produce an immediately dramatic and scientifically recognizable black-hole image. Treat physical coherence, lensing quality, shader correctness, camera behavior, diagnostic usefulness, visual impact, performance, error handling, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Black Hole and Gravitational Lensing Explorer

Move and orbit the camera and confirm that lensing and accretion-disk geometry update continuously rather than rotating a pre-rendered image. Exercise lensing, redshift, Doppler, and ray-step diagnostics. Select a screen ray and inspect its trajectory values. Change quality and integration settings, resize the viewport, and inspect shader compilation, console, and runtime errors.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
