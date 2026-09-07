# Rhythm-Synchronized Bullet-Hell Game

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
Create a polished, complete rhythm-synchronized bullet-hell arcade game that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, game logic, synthesis code, controls, levels, shaders, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, audio files, image files, fonts, or network dependencies.

The game must combine genuine real-time bullet-hell gameplay with a procedurally synthesized soundtrack. Build the soundtrack using the Web Audio API after a required user gesture. Use a stable AudioContext-based look-ahead scheduler or equivalent timing design so that percussion, melody, enemy phase changes, projectile emissions, beat indicators, and scoring windows derive from a shared musical transport rather than unrelated `setInterval` or animation timers.

Provide a responsive player character with smooth eight-direction movement, a slower focus mode with a visible hitbox, collision detection against bullets and hazards, health or lives, temporary invulnerability, and at least one ability such as dash, shield, bomb, or time-slow with a meaningful cooldown or resource cost. Support keyboard, pointer or touch, and gamepad controls where available, and prevent stuck inputs after focus loss.

Create a multi-phase encounter with at least one visually distinct boss or sequence of enemies. Patterns must include several genuinely different forms such as radial bursts, aimed shots, spirals, sweeping walls, lanes, accelerating bullets, curved or orbiting bullets, and rhythm subdivisions. Difficulty, phase, health, or player performance must influence the pattern system. Bullets must be logical game entities with coherent collision and lifetime behavior, not only shader decoration.

Tie game mechanics to rhythm in meaningful ways. Include beat and measure visualization, combo or multiplier rules, bonus windows for near-beat grazing, dashing, shooting, or another deliberate mechanic, and clear feedback for perfect, good, or missed timing. The game must remain playable even when the player ignores the rhythm, while rewarding accurate timing.

Provide a synthesized soundtrack containing at least drums, bass, and melodic or atmospheric voices, with track muting, master volume, and several musical presets or scales. Include reactive mixing or arrangement changes across boss phases. The audio graph must drive a live waveform, spectrum, or other visualization based on actual output.

Include a practice or pattern-laboratory mode that lets the user choose a pattern, tempo, subdivision, density, speed, and seed and then immediately test it. Include at least a compact pattern editor or step grid whose changes alter actual projectile scheduling, not only labels. Provide curated presets from approachable to intentionally chaotic.

Implement a complete game loop with title or enable-audio screen, instructions, countdown, active run, pause, failure, victory, restart, score, combo, accuracy, graze count, best score, and local high-score persistence. Support deterministic seeded runs and export or import of a compact replay or action log sufficient to reproduce a run when simulation settings match.

Render the game with deliberate arcade polish using Canvas or WebGL: layered backgrounds, readable bullets, trails, impact effects, screen shake with a toggle, boss health and phase UI, particles, post-processing or bloom approximation, and coherent color treatment. Visual intensity must not obscure the player's hitbox or make required interface text unreadable.

Provide controls for tempo, latency calibration or visual offset, difficulty, master and track volume, particle density, screen shake, reduced motion, reduced flash, color contrast, input mapping or control reference, and render quality. Pause and resume must suspend and restore audio and gameplay coherently without jumping the musical timeline or emitting a backlog of bullets.

Include optional diagnostics for scheduler horizon, current AudioContext time, transport beat, scheduled events, gameplay time, active bullet count, collision bounds, timing error, and dropped frames. These values must derive from the actual scheduler and game state.

The application must adapt to browser resizing, support high-DPI displays, remain playable on common desktop viewports and a narrow viewport, and degrade gracefully when Web Audio, gamepad, or high-end rendering capabilities are unavailable.

Display a compact live status overlay containing frames per second, tempo, beat and measure, audio state, scheduler look-ahead, active bullets, current phase, score, combo, timing offset, and pause state.

Use defaults that begin with a striking but survivable first pattern and an immediately memorable synthesized loop. Treat scheduler stability, audio-game synchronization, collision correctness, game feel, pattern depth, accessibility, replay behavior, visual impact, performance, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Rhythm-Synchronized Bullet-Hell Game

Begin audio through a real user gesture, play through multiple measures, and verify that the transport, visual beat indicator, enemy attacks, and audible events remain synchronized. Move with normal and focus controls, use dash or special ability, intentionally take damage, trigger restart, and confirm collision, invulnerability, combo, and scoring state. Pause and resume after several beats without accumulating obvious drift, alter tempo or a pattern in the editor or practice controls, test deterministic replay or seed behavior, and exercise reduced-flash plus narrow-viewport controls.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
