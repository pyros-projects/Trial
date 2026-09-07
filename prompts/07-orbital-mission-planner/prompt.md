# Orbital Mechanics and Mission-Planning Sandbox

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
Create a polished, interactive orbital-mechanics and spacecraft mission-planning sandbox that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, numerical integration code, controls, plotting, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image assets, or network dependencies.

Simulate gravitational motion using an actual numerical integrator rather than moving bodies along decorative circles. Support multiple massive celestial bodies and one or more spacecraft, with configurable mass, position, velocity, radius, and display scale. Use a suitable stable integration method such as leapfrog, velocity Verlet, symplectic integration, or an appropriately controlled higher-order solver.

Provide a default system containing a star, planet, moon, and spacecraft with scaled but internally coherent units. Bodies must perturb one another according to the selected simulation model. Spacecraft trajectories must respond to gravitational encounters, burns, and time progression.

Allow the user to pan, zoom, select bodies, drag the initial position or velocity of a spacecraft while paused, and inspect state vectors. Provide smooth time acceleration and deceleration, pause, single-step, reverse-to-saved-checkpoint or restart, and configurable integration timestep.

Implement predicted spacecraft trajectories based on the current state. Allow the user to create maneuver nodes at future points along the prediction, configure prograde, retrograde, radial, normal or Cartesian delta-v components as appropriate for the dimensionality, and immediately recompute the projected trajectory. Display maneuver time, delta-v magnitude, estimated closest approaches, and resulting orbital changes. Maneuver nodes must alter the actual simulation when their scheduled time is reached.

Include several reference-frame modes such as inertial, selected-body-centered, and rotating body-moon or equivalent frame. Trajectories and velocity vectors must transform coherently when switching frames.

Provide controls for gravitational constant or scaling, integration timestep, time warp, prediction horizon, prediction resolution, trail length, collision behavior, body scale, trajectory visibility, velocity vectors, orbital guides, and numerical tolerance where applicable.

Include scenarios demonstrating a circular orbit, elliptical orbit, Hohmann-like transfer, moon transfer, gravitational slingshot, unstable three-body interaction, and escape trajectory. Scenario presets may use normalized units but must behave consistently.

For the selected body or spacecraft, display useful telemetry including position, velocity, speed, distance to primary, specific orbital energy, angular momentum, periapsis, apoapsis, eccentricity, orbital period where defined, remaining scheduled delta-v, and closest predicted encounter. Track total energy and momentum error for the complete simulated system.

Provide selectable visualization modes or overlays for trajectories, gravitational potential, velocity vectors, acceleration vectors, orbital elements, sphere-of-influence approximations, encounter markers, and integration error.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer controls, and handle very different spatial scales without losing basic usability.

Display a compact live overlay containing frames per second, simulated date or elapsed time, time-warp factor, integration steps per frame, body count, total energy error, selected reference frame, and pause state.

Use defaults that immediately show an active, legible orbital system. Treat integration correctness, trajectory prediction, maneuver-node behavior, reference-frame handling, numerical stability, interaction quality, visual clarity, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Orbital Mechanics and Mission-Planning Sandbox

Advance the simulation and verify coherent motion and telemetry changes. Create or modify a maneuver node and confirm that the predicted trajectory changes before the burn and that the actual simulation changes when the burn executes. Switch reference frames and inspect transformed trails and vectors. Test pause, single-step, time warp, reset, and energy-error reporting.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
