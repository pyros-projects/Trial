# 3D Weather and Storm Laboratory

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
Create a polished, interactive three-dimensional weather and storm laboratory that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, simulation code, controls, procedural geometry, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, textures, models, image files, fonts, or network dependencies.

Simulate a simplified but coherent atmosphere over procedural terrain. Maintain meaningful evolving fields for at least horizontal and vertical wind or a useful approximation, temperature, humidity or water vapor, cloud water, precipitation, and pressure or buoyancy. Use grid-based advection, diffusion, relaxation, cellular transport, or another explicit numerical model rather than merely moving decorative cloud sprites across a static landscape.

Implement a water and energy cycle containing surface evaporation or moisture sources, transport by wind, cooling with altitude or uplift, condensation into visible cloud, precipitation, evaporation of falling rain where practical, latent-heat or buoyancy approximation, and dissipation. Terrain should affect airflow or uplift enough to produce an observable effect such as orographic cloud or rain. The model may be stylized, but changes in controls and pointer interventions must propagate through the actual fields.

Render the atmosphere as an interactive 3D scene using WebGL or WebGL2. Provide procedural terrain, sky, sun or moon, atmospheric haze, cloud volumes or convincing layered ray-marched or sliced cloud density, rain or snow particles, wet-ground or runoff cues, wind streaks, and optional lightning. Clouds must be driven by simulated cloud-water or humidity state rather than an unrelated noise animation.

Allow orbit, pan, zoom, free-look or fly-through, and several cinematic camera presets. Include a map or cross-section view in addition to the 3D view. The user must be able to click or tap to place a probe and inspect a vertical column or local time series for temperature, humidity, pressure or buoyancy, wind, cloud water, and precipitation.

Provide interactive tools for adding heat, cooling, injecting moisture, drying, applying a wind impulse, creating a pressure perturbation, seeding cloud, raising or lowering terrain, and placing an ocean, lake, forest, city heat island, or another surface type. Brush radius and strength must work during continuous pointer movement and update the actual simulation state.

Include presets such as fair-weather cumulus, sea breeze, mountain rain, squall line, rotating supercell, tropical cyclone approximation, cold front, heat island thunderstorm, snow band, and numerical stress test. Presets must configure fields and parameters coherently rather than only changing camera and color.

Provide controls for pause/resume, single-step, reset, deterministic seed, simulation resolution, vertical layers, timestep, substeps, wind strength, Coriolis or rotation approximation, temperature lapse rate, humidity, evaporation, condensation threshold, precipitation rate, buoyancy, diffusion, terrain influence, lightning probability, render resolution, cloud quality, precipitation density, exposure, and time of day. Clearly indicate or constrain unstable parameter combinations.

Include selectable visualization modes for cinematic weather, temperature, humidity, cloud water, precipitation rate, pressure or buoyancy, horizontal wind, vertical motion, vorticity or rotation, terrain height, and surface moisture. Add vector arrows, streamlines, vertical slices, contours, or volume slices derived from actual fields.

Lightning must be procedurally generated and tied to plausible simulated storm intensity, charge proxy, or vertical development. Include a manual trigger for inspection, but automatic lightning should respond to active storm state. Thunder audio may be synthesized through Web Audio after a user gesture with distance-based delay.

Support saving and loading complete simulation state or at least all deterministic fields and parameters, exporting probe history as CSV, exporting the current view as PNG, and local persistence of settings. Invalid imported state must be rejected gracefully.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer input, remain interactive on common desktop hardware through quality presets or adaptive resolution, and clearly handle missing WebGL2 or shader failures.

Display a compact live overlay containing frames per second, simulation dimensions and layers, simulated time, timestep or stability measure, average cloud cover, precipitation total, maximum updraft, wind speed, active preset and visualization, selected probe, and pause state.

Use defaults that immediately show an evolving storm system with readable terrain, cloud structure, and precipitation. Treat field coupling, atmospheric coherence, intervention response, cloud rendering, diagnostic truthfulness, camera quality, numerical stability, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: 3D Weather and Storm Laboratory

Run a storm preset and confirm that wind, moisture, temperature, cloud water, and precipitation evolve over time rather than only animating a fixed texture. Inject heat and moisture, alter wind, and observe a coherent delayed response in clouds or rainfall; inspect at least four diagnostic modes and a vertical or point probe. Trigger or observe lightning, orbit and zoom the camera, test pause and single-step, change quality or resolution while running, reset the same seed, and verify graceful behavior at narrow viewport and offline load.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
