# Soft-Body, Cloth, and Constraint Playground

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
Create a polished, interactive real-time 2D deformable-body physics playground that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, controls, rendering code, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, or network dependencies.

The simulation must implement actual deformable-body dynamics rather than playing canned animations or moving rigid sprites. Use a suitable numerical technique such as position-based dynamics, extended position-based dynamics, Verlet integration with constraint projection, or another stable solver. Support particles connected through structural, shear, bending, distance, area, pressure, pin, and attachment constraints as appropriate.

Include multiple physically distinct object types: cloth sheets, ropes or chains, elastic soft bodies, pressure-preserving balloons or blobs, and rigid or static collision geometry. Dynamic objects must respond to gravity, inertia, damping, friction, restitution, wind, pointer forces, and collisions with boundaries and obstacles. Different deformable objects must collide with one another meaningfully. Cloth and ropes should not simply pass freely through every other object, and approximate self-collision should be included where practical.

Allow the user to grab and drag particles or objects directly, pin and unpin points, cut constraints, tear cloth, apply impulses, create wind gusts, and spawn new ropes, cloth sheets, balls, soft bodies, and static obstacles. Continuous dragging and cutting must remain smooth during rapid pointer movement. Tearing must alter the actual constraint graph and remain visible after the interaction ends.

Provide controls for pause/resume, single-step, reset, scenario selection, gravity direction and magnitude, wind, solver iterations, substeps, timestep, structural stiffness, bending stiffness, pressure strength, damping, friction, restitution, collision thickness, self-collision, tear threshold, object density, and interaction strength and radius.

Include several demonstration scenarios such as a hanging flag, cloth draped over obstacles, a bridge under load, a stack of soft bodies, a suspended rope structure, a balloon chamber, and a destructive stress test. Switching scenarios may reset the world, but switching visualization modes must not.

Provide selectable visualization modes for final rendering, particle positions, constraints, velocity, stress or constraint error, collision contacts, pinned points, and spatial-partitioning cells if a broad-phase acceleration structure is used. Stress visualization should respond to actual constraint strain and make imminent tearing visible.

Render the simulation with deliberate visual polish, including smooth deformable surfaces where appropriate, shaded cloth or blobs, shadows, outlines, contact effects, and clear editing feedback. The application must adapt to browser resizing, support high-DPI displays, and maintain coherent world coordinates after resizing.

Display a live performance and simulation overlay containing frames per second, particle count, constraint count, collision pairs, solver iterations, substeps, maximum constraint error, active tool, current scenario, and pause state.

Use defaults that immediately demonstrate deformation, collisions, swinging, folding, and tearing. Treat solver stability, believable deformation, collision quality, tool behavior, diagnostic accuracy, visual quality, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Soft-Body, Cloth, and Constraint Playground

Use real pointer input to grab and drag particles or bodies, pin and unpin points, cut constraints, and tear cloth. Spawn multiple object types and confirm collisions and deformation rather than canned motion. Change solver iterations, stiffness, wind, and tear threshold and observe consistent effects. Exercise stress and constraint diagnostics, pause, single-step, reset, and at least two scenarios.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
