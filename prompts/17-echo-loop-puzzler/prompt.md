# Time-Loop Physics Puzzle Game and Editor

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
Create a polished two-dimensional time-loop physics puzzle game with an integrated level editor that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, physics, controls, levels, procedural audio, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, audio files, fonts, or network dependencies.

The central mechanic must let the player perform actions during a fixed-duration loop, reset to the loop's initial world state, and spawn an echo that replays the previous loop's recorded movement and interactions while the player attempts the next loop. Multiple echoes must be able to cooperate with the current player. Echoes must replay from recorded input or deterministic state transitions on the same simulation timeline rather than following a decorative prerecorded path disconnected from collisions and switches.

Implement stable platform-game physics for the player, echoes, crates, moving platforms, doors, and hazards. Include horizontal movement, jumping with forgiving coyote time and input buffering, carrying or pushing objects, collision against static and moving geometry, gravity, grounded state, and consistent reset. Physics must be sufficiently deterministic that a recorded echo performs the same useful action after a reset under unchanged initial conditions.

Include pressure plates, toggle switches, timed switches, doors, lifts, laser or hazard emitters, movable crates, one-way platforms, checkpoints or goal zones, and at least one object that can be carried or thrown. Switches and doors must respond to actual overlapping or interaction state from the player and echoes. Puzzle elements should remain visually legible when several echoes are active.

Provide at least six handcrafted levels that teach and combine the mechanic, including one-loop introduction, plate cooperation, object handoff, moving-platform timing, hazard synchronization, and a multi-echo final puzzle. Include a level-select screen, completion times or loop counts, medals or ranks, restart, undo last echo, clear all echoes, and a complete victory flow.

Display a visible loop timeline with current time, recorded input segments, interaction markers, echo lanes, and remaining duration. Let the user scrub or inspect the timeline while paused and optionally create a checkpoint preview, but prevent edits that would silently desynchronize existing echoes. Include slow motion or frame-step for debugging and accessibility.

Support keyboard, gamepad where available, and usable pointer or touch controls. Handle simultaneous movement and jump, pointer cancellation, focus loss, and gamepad disconnect without leaving actions stuck. Include a concise tutorial and remappable or alternative controls.

Include a full in-application level editor with a snap grid, pan and zoom, palette, placement, selection, move, resize or property editing, rotate where relevant, duplicate, delete, undo, redo, multi-select, play-test, return-to-editor, validation, and clear indication of spawn, goal, loop duration, and invalid geometry. The editor must support all core puzzle object types and configure switch-door links through IDs, channels, or another understandable mechanism.

Support exporting and importing custom levels as validated JSON, local named level slots, export of a replay or solution trace, and deterministic loading of built-in levels. Imported levels must not execute arbitrary code or crash the app when malformed.

Render the game with deliberate visual identity using Canvas, SVG, DOM, or WebGL: layered backgrounds, crisp silhouettes, echo trails and color separation, switch and door animation, particles, screen transitions, camera easing, contextual prompts, and procedurally generated sound and music through Web Audio after a user gesture. Include reduced motion, reduced flash, color-contrast, and volume options.

Include optional diagnostics for collision shapes, contact normals, grounded state, physics accumulator, recorded inputs, echo divergence, switch channels, object IDs, and frame timing. Detect and surface significant replay divergence instead of silently allowing an echo to drift away from its recorded intent.

The application must adapt to browser resizing, support high-DPI displays, remain playable and editable at common desktop and narrow viewport sizes, and stay stable after repeated loop resets, editor play-tests, and echo creation.

Display a compact live overlay containing frames per second, level, loop index, loop time remaining, active echoes, divergence warning, player state, active switches, current editor or play tool, and pause state.

Use defaults that open directly into a beautiful introductory puzzle whose solution demonstrates the echo mechanic within a minute. Treat replay determinism, physics stability, puzzle-system coherence, editor completeness, input quality, visual storytelling, accessibility, persistence, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Time-Loop Physics Puzzle Game and Editor

Record a loop in which the player activates or carries something, reset the loop, and verify that an echo reproduces the recorded actions at the same times while the new player acts independently. Use the echo to hold a pressure plate or otherwise solve a cooperative puzzle, test player and crate collision, jumping, switches, doors, hazards, undoing an echo, and deterministic restart. Open the level editor, place and configure at least three object types, play-test the edited level, undo and redo an edit, save and reload it, and verify timeline plus diagnostic overlays after resizing.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
