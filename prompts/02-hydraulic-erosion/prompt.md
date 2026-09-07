# 3D Hydraulic Erosion Laboratory

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
Create a polished, interactive real-time 3D hydraulic erosion laboratory that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, textures, models, or network dependencies.

The application must simulate a mutable terrain heightfield undergoing visible hydraulic erosion rather than merely animating a fixed procedural landscape. Maintain meaningful terrain, water, sediment, and erosion state, and implement a coherent erosion cycle containing rainfall or water injection, gravity-driven water flow, sediment carrying capacity, erosion, sediment transport, deposition, evaporation, and optional thermal or talus-angle erosion. Water must move downhill, pool in depressions, carve channels, transport material, and visibly alter the terrain over time.

Render the evolving terrain as an interactive 3D scene with perspective projection, orbit, pan, and zoom controls. Recompute or approximate surface normals from the current heightfield so that lighting changes as the terrain erodes. Visually distinguish dry terrain, wet terrain, standing water, sediment-rich water, steep slopes, and recently eroded or deposited regions. Use procedural lighting, atmospheric treatment, shadows, contour lines, grid overlays, or other techniques to make the result presentation-ready without external assets.

Allow the user to interact with the terrain using pointer tools for raising terrain, lowering terrain, smoothing, flattening, adding water, adding sediment, drying an area, and inspecting local values. Brush radius and strength must respond smoothly during continuous dragging, and camera controls must not conflict with editing tools.

Provide a compact control interface containing at least pause/resume, single-step, reset, regenerate terrain, deterministic seed, simulation resolution, simulation speed, substeps, rainfall rate, evaporation, erosion rate, deposition rate, sediment capacity, flow strength, thermal erosion strength, brush radius, brush strength, vertical exaggeration, water visibility, lighting direction, and terrain-generation parameters. Include several useful presets such as mountain drainage, canyon formation, island rainfall, river valley, and aggressive stress test.

Include selectable visualization modes for at least final shaded terrain, elevation, water depth, sediment concentration, erosion and deposition delta, slope, and flow direction or velocity. Switching modes must not reset the simulation. Provide a probe or hover readout showing meaningful values at the selected terrain position.

Support exporting the current heightfield as a grayscale PNG and exporting or importing the complete simulation state as JSON, entirely in the browser.

The application must adapt to browser resizing, support high-DPI displays appropriately, provide usable mouse and touch or pointer interaction, and remain stable when simulation settings are changed while running. Include sensible bounds and graceful recovery from numerically unstable parameter combinations.

Display a live status overlay containing frames per second, simulation dimensions, simulated time, water volume, sediment amount, active visualization mode, pause state, and any useful numerical stability or performance information.

Use visually interesting defaults that begin evolving immediately and produce recognizable channels, valleys, deltas, or erosion patterns without configuration. Treat numerical coherence, evolving terrain geometry, interaction quality, rendering quality, stability, performance, diagnostic usefulness, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: 3D Hydraulic Erosion Laboratory

Run the simulation long enough to confirm that moving water changes the underlying terrain rather than only its shading. Add water and edit terrain with real pointer input. Confirm that water depth, sediment, and erosion or deposition diagnostics evolve consistently. Change erosion and evaporation parameters and observe meaningful differences. Verify orbit controls, pause, single-step, regeneration, and reset.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
