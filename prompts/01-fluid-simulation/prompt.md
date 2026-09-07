# Real-Time 2D Fluid Simulation

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
Create a polished, interactive real-time 2D fluid simulation that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, or network dependencies.

The simulation must behave like a continuous fluid rather than a simple particle animation, supporting visible velocity flow, advection, diffusion or viscosity, pressure, incompressibility, vorticity or swirling motion, dissipation, and the transport and mixing of colored dye through the simulated fluid field.

Allow the user to interact directly with the fluid using the mouse or pointer by dragging through the simulation to inject momentum and dye, with the direction and speed of the drag influencing the resulting force and with interaction remaining smooth during rapid or continuous movement.

Provide a compact real-time control interface containing at least pause/resume, reset, clear dye, simulation resolution, timestep or simulation speed, viscosity, pressure strength or pressure iterations, vorticity, velocity dissipation, dye dissipation, interaction force, interaction radius, and dye color controls, while giving the implementation freedom to choose suitable ranges, defaults, widgets, and presentation.

Include multiple selectable visualization modes that expose meaningful aspects of the simulation, such as rendered dye, velocity magnitude or direction, pressure, divergence, vorticity, or another useful diagnostic representation, and make switching between modes possible without restarting the simulation.

The application must automatically adapt its rendering surface and simulation to browser-window resizing, support high-DPI displays appropriately, provide usable mouse and touch or pointer input, and remain visually coherent across common desktop viewport sizes.

Display a small performance and simulation-status overlay containing useful live information such as frames per second, simulation dimensions, current visualization mode, pause state, and any other metrics the implementation considers valuable for evaluating performance.

Design the interface and fluid rendering to look intentional and demonstration-ready, including a full-screen or near-full-screen simulation area, readable controls, clear interaction feedback, visually rich dye mixing, and sensible defaults that produce interesting fluid motion immediately without requiring configuration.

The implementation may choose WebGL, WebGL2, Canvas, CPU techniques, GPU shaders, numerical method details, data structures, rendering style, optimization strategies, control layout, color treatment, and additional features freely, but every required feature must work from the delivered HTML file alone when opened in a modern browser.

Treat correctness, stability, fluid-like behavior, responsiveness, interaction quality, visual quality, performance, code organization, graceful handling of unsupported capabilities, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Real-Time 2D Fluid Simulation

Inject momentum and dye with several slow and rapid pointer drags and confirm that the flow persists, advects, mixes, and responds to drag direction and speed. Switch among dye and diagnostic visualization modes while the simulation is running. Change viscosity and vorticity enough to produce observable behavioral differences. Verify that clear dye removes dye without silently resetting all velocity state, that pause and resume work, and that reset restores a valid initial state.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
