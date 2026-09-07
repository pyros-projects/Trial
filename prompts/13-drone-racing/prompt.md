# 3D FPV Drone-Racing Simulator

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
Create a polished, interactive three-dimensional FPV drone-racing simulator that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, procedural geometry, procedural audio, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, textures, models, audio files, fonts, or network dependencies.

Render a navigable 3D racing environment using WebGL or WebGL2, with a procedural canyon, industrial course, neon city, forest-like obstacle field, or another coherent setting made entirely from generated geometry and materials. Include a complete ordered checkpoint course with gates, start and finish, collision surfaces, track boundaries or recovery zones, environmental landmarks, and a deterministic seed. Every generated course must be finishable.

Implement actual drone-like flight dynamics rather than translating a camera directly or following a spline. Maintain position, velocity, orientation, angular velocity, mass or inertia approximation, motor or thrust response, gravity, drag, and collision response. Throttle, yaw, pitch, and roll must affect the simulated craft independently. Use quaternions, matrices, or another robust orientation representation and include safeguards against numerical instability.

Provide at least three flight modes, such as stabilized angle mode, horizon mode, and acro or rate mode. Adjustable assists may include auto-level, altitude hold, anti-crash, throttle expo, rates, and camera tilt, but they must alter actual control dynamics. Include keyboard controls and gamepad support with calibration, dead zone, axis inversion, and clear fallback guidance when no controller is connected. Pointer or touch controls may be included for accessibility.

Implement ordered checkpoint detection, missed-gate feedback, lap and sector timing, penalties, best lap, restart, crash handling, and a complete race loop. Include a time-trial mode, free-flight mode, and several curated course presets. Track a ghost drone or racing line from the best local run using a deterministic recording of transform or control state.

Provide first-person FPV, chase, orbit, and trackside camera modes. The FPV view should include configurable field of view, camera angle, lens distortion or vignette approximation, horizon or attitude indicator, speed, altitude, throttle, battery or motor load, checkpoint direction, lap time, and warning indicators. Camera switching must not alter the drone's physical state.

Render deliberate visual effects such as procedural sky, atmospheric haze, directional lighting, shadows or contact darkening, gate glow, propeller or motor effects, dust or sparks on collision, speed lines, and optional post-processing. Generate engine and collision audio procedurally through Web Audio after a user gesture, with pitch and intensity driven by actual motor command or speed.

Provide controls for course seed, environment preset, difficulty, flight mode, gravity, thrust-to-weight ratio, drag, angular rates, expo, assist strengths, collision forgiveness, camera FOV, camera tilt, render resolution, shadow or lighting quality, particle density, master volume, and replay visibility.

Include diagnostics for body axes, velocity and acceleration vectors, angular rates, collision bounds, checkpoint volumes, control inputs, integration timestep, and frame timing. Provide a scrolling telemetry graph for at least altitude, speed, throttle, and one angular axis, derived from the live simulation.

Support local best-time persistence, export and import of course and replay data as JSON, deterministic reset, and PNG screenshot export. Invalid imported data must fail gracefully.

The application must adapt to browser resizing, support high-DPI displays, retain coherent projection and input mapping after resize, remain responsive on common desktop hardware through quality presets or adaptive resolution, and provide a clear fallback message if required WebGL capabilities are unavailable.

Display a compact live overlay containing frames per second, internal render dimensions, position or altitude, speed, throttle, flight mode, current gate, lap and sector time, best-time delta, collision state, and active camera.

Use defaults that place the drone ready to fly toward an unmistakable first gate and make the controls understandable within seconds. Treat flight-model coherence, control quality, checkpoint correctness, camera behavior, collision stability, replay fidelity, visual polish, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: 3D FPV Drone-Racing Simulator

Take off and demonstrate independent throttle, yaw, pitch, and roll response rather than moving a camera along a fixed path. Pass at least two ordered checkpoints, collide with terrain or an obstacle, recover or reset, switch camera mode, and compare an assisted setting with a more manual flight mode. Verify lap timing, checkpoint order, telemetry changes, seed reset, ghost or replay behavior, gamepad fallback messaging, quality controls, and stable rendering after desktop and narrow viewport changes.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
