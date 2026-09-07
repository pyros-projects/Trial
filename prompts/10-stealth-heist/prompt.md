# Procedural Stealth Heist Sandbox

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
Create a polished, replayable top-down stealth-heist game that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, rendering code, controls, levels, audio synthesis, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, audio files, fonts, or network dependencies.

The game must be an actual systemic stealth experience rather than a scripted animation or simple avoid-the-cones toy. Generate or assemble a coherent infiltration map containing rooms, corridors, doors, cover, restricted zones, patrol routes, security terminals, cameras, loot or intelligence, an entry point, and an extraction point. Every generated mission must be traversable and the objective must be obtainable without requiring impossible timing or inaccessible rooms. Support a deterministic seed and several curated mission presets.

Implement a controllable player with smooth movement, walking and running or another meaningful noise tradeoff, collision against level geometry, contextual interaction, and clear feedback about visibility, sound, suspicion, inventory, objective state, and escape status. Support keyboard controls and usable pointer or touch controls; prevent browser scrolling or lost-input problems while the game has focus.

Implement multiple guards with independent stateful behavior including patrol, idle observation, suspicion, investigation, alert or pursuit, local search after losing sight, communication or alarm response, and eventual return to duty. Guards must use line-of-sight checks that are occluded by walls and closed doors, have configurable view distance and field of view, and navigate around obstacles using an actual grid, graph, flow-field, or pathfinding system rather than moving directly through geometry. Guards should react to the player's last known position instead of tracking the player through walls.

Model sound as meaningful game state. Running, opening doors, using gadgets, colliding with objects, and other noisy actions must create sound events with position, intensity, decay, and occlusion or distance effects. Nearby guards should investigate plausible sound sources. Visual feedback may show expanding sound rings, but guard reactions must derive from the underlying sound data rather than the animation alone.

Include a security system with cameras, alarms, locked or access-controlled doors, and terminals that can disable or alter parts of the system. Provide at least three useful player tools or gadgets, such as a thrown distraction, smoke, temporary EMP, lockpick, decoy, or limited cloaking device. Gadgets must have finite charges, cooldowns, or another real tradeoff and must affect the relevant simulation systems.

Provide a complete game loop with briefing, objective tracking, detection or danger escalation, failure, victory, restart, and a performance summary including time, detections, alarms, optional loot, and rank or score. Include difficulty controls that meaningfully alter perception, response speed, patrol density, or resource availability rather than only changing a label.

Render the game with deliberate visual polish using Canvas, SVG, DOM, WebGL, or a combination. Include dynamic lighting or darkness, visible but readable guard and camera vision cones, animated doors and terminals, particles or screen effects, a compact minimap, contextual prompts, and restrained procedural audio generated through Web Audio after a user gesture. The default presentation should feel like a small finished game rather than an editor demo.

Provide pause, restart, new mission, seed, difficulty, master volume, effects volume, reduced-motion or reduced-flash, and control-remapping or control-reference options. Support local high-score or run-history persistence and export or import of mission or replay data as JSON. A replay may be deterministic action playback or another verifiable record of the completed run.

Include optional diagnostic overlays for navigation nodes or paths, guard state, vision ray hits, sound events, last-known positions, collision geometry, and frame timing. These overlays must be connected to actual AI and simulation state and must be switchable without restarting the mission.

The application must adapt to browser resizing, support high-DPI displays, remain playable at common desktop sizes and a narrow viewport, handle pointer cancellation and focus loss gracefully, and remain stable with several guards simultaneously searching or chasing.

Display a compact live status overlay containing frames per second, mission seed, alert level, objective state, elapsed time, active guards by state, current noise level, selected gadget, and pause state.

Use defaults that immediately present a readable mission with moving patrols, a clear objective, and an obvious first interaction. Treat map validity, AI coherence, perception correctness, pathfinding, systemic interactions, game feel, visual polish, robustness, replayability, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Procedural Stealth Heist Sandbox

Play a complete mission far enough to collect the primary objective and reach extraction, or use a deterministic compact preset that makes this possible within the test budget. Intentionally enter and leave a guard or camera vision cone, create a noise that causes investigation, break line of sight during pursuit, and confirm that AI state transitions and search behavior are observable rather than cosmetic. Use at least one door or terminal and one gadget, toggle perception and navigation diagnostics, test pause and restart, regenerate with the same seed, and verify keyboard plus pointer interaction at desktop and narrow widths.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
