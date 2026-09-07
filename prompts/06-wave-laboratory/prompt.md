# Wave Interference and Diffraction Laboratory

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
Create a polished, interactive real-time two-dimensional wave laboratory that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, shaders, controls, numerical simulation code, plotting code, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, or network dependencies.

Simulate a continuous scalar wave field using an actual numerical wave-equation method such as finite differences, finite-difference time domain, or an equivalent grid-based solver. Do not represent waves as expanding circles, sprite animations, or independently moving particles. The field must exhibit interference, diffraction, reflection, refraction, absorption, standing waves, focusing, and destructive cancellation as consequences of the simulation.

Allow the user to place and edit continuous emitters, pulsed emitters, point sources, line sources, phased-array elements, reflecting barriers, absorbing barriers, slits, obstacles, lenses, and regions with different propagation speeds or refractive indices. Drawing and erasing structures must work smoothly while dragging, and changes must affect the live simulation immediately.

Provide source controls for frequency or wavelength, amplitude, phase, pulse duration, source type, waveform, and activation state. Phased-array elements must support relative phase control and produce visible beam steering or focusing.

Provide global controls for pause/resume, single-step, clear field, reset scene, simulation resolution, timestep, wave speed, damping, boundary behavior, simulation substeps, color scale, exposure, persistence, and brush radius. Prevent or clearly indicate numerically unstable timestep and resolution combinations using an appropriate stability condition.

Include carefully designed presets demonstrating at least a double-slit experiment, single-slit diffraction, two-source interference, standing waves in a cavity, focusing through a lens, refraction at an interface, phased-array beam steering, and a pulse reflecting through a complex obstacle field.

Provide selectable visualization modes for instantaneous signed amplitude, intensity or time-averaged energy, phase, gradient magnitude, propagation medium, and energy-flow direction or another meaningful diagnostic. The signed-amplitude mode must visually distinguish positive and negative displacement.

Allow the user to place one or more probes in the field. Each probe must display a live waveform plot, measured amplitude, phase or dominant frequency, and optionally a small frequency spectrum. Probe data must come from the actual simulation field.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer controls, and remain visually coherent across common desktop viewport sizes.

Display a compact live overlay containing frames per second, simulation dimensions, timestep, stability ratio, simulated time, source count, probe count, active visualization mode, and pause state.

Use defaults that immediately produce a rich interference pattern. Treat numerical correctness, stability, emergent wave behavior, editing quality, probe accuracy, visualization quality, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Wave Interference and Diffraction Laboratory

Confirm that multiple sources form interference and that adding or moving a barrier changes diffraction through the actual field. Draw a refractive region or lens and observe altered propagation. Place a probe and verify that its waveform reflects local field state. Change timestep and wave speed, inspect the stability indicator, switch diagnostics while running, and test clear, pause, single-step, and reset.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
