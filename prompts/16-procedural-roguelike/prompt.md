# Procedural Tactical Roguelike

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
Create a polished, complete turn-based tactical roguelike that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, game logic, level generation, controls, procedural audio, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, audio files, fonts, or network dependencies.

Generate a deterministic multi-floor dungeon from a user-visible seed using rooms, corridors, doors, stairs, hazards, treasure, enemies, and optional special structures. Every floor must be connected or otherwise provably completable, place entry and exit on reachable tiles, and avoid spawning the player inside hazards or unavoidable enemy attacks. Include several curated generation styles such as caverns, fortress, crypt, overgrown ruins, and compact test arena.

Implement grid-based turn logic in which player actions, enemy actions, environmental effects, cooldowns, and status durations advance coherently. Moving, waiting, attacking, using an item, opening a door, interacting, and descending must consume turns according to explicit rules. Animations may interpolate between states, but the underlying game must remain deterministic and must not let enemies take extra actions because of frame rate.

Provide field of view and line of sight with walls and closed doors blocking vision, explored but currently unseen tiles, hidden enemies outside perception, and clear feedback for sound or other sensed events. Enemy targeting must not use perfect knowledge of the player through walls unless a specific ability explains it.

Include several enemy archetypes with distinct tactical behavior, such as direct pursuit, ranged attacks, flanking, guarding, fleeing, summoning, area denial, or pack coordination. Use actual pathfinding or distance maps, collision-aware movement, and conflict resolution so enemies navigate around geometry and one another rather than clipping through walls.

Implement coherent combat with attack accuracy or another transparent resolution method, damage, armor, health, death, experience or progression, critical or special effects, and a combat log. Include melee and ranged options, at least six usable items or abilities, equipment slots, consumables, keys or utility items, status effects, traps, and environmental interactions. Tooltips must expose enough information for tactical decisions.

Provide a complete run loop with character selection or loadout, objective, multiple floors, escalating difficulty, a boss or final encounter, victory, death, restart, score or run summary, and local records. Include optional daily-seed behavior using a deterministic date string without requiring network access.

Support keyboard, pointer, and touch or pointer controls. Clicking a visible tile may move one step or follow a previewed safe path, but it must respect turn order and stop on newly revealed danger or blockage. Include inspect mode, inventory, targeting, keyboard help, remapping or alternate keys, and clear focus handling.

Render the game with polished tiles or vector art generated entirely in code, smooth but brief turn animations, particles, lighting or tint, readable entities, minimap, health and status UI, event log, inventory panel, contextual prompts, and restrained procedural sound through Web Audio after a user gesture. Use an intentional visual identity rather than plain colored squares alone.

Provide pause or menu, new run, restart floor where appropriate, seed, difficulty, animation speed, text size, color contrast, reduced motion, master volume, and optional permadeath or forgiving mode. Support complete save and load to localStorage, export and import of a run as JSON, and a deterministic action log or replay that can re-simulate a completed or failed run.

Include optional diagnostic modes for walkability, connectivity regions, field of view, enemy path or distance maps, AI intent, turn queue, collision occupancy, random seed state, and generation validation. Diagnostics must reflect the actual systems and remain switchable during play.

The application must adapt to browser resizing, support high-DPI displays, remain usable on common desktop and narrow viewports, gracefully handle a saved game from an older or invalid schema, and remain stable across long runs with many entities and effects.

Display a compact live overlay containing frames per second, floor and seed, turn number, player health and level, visible enemies, active status effects, objective, selected action, replay or save state, and pause state.

Use defaults that begin in a visually interesting, immediately playable room with nearby choices rather than an empty corridor. Treat generation validity, turn determinism, perception correctness, tactical AI, combat depth, usability, replayability, visual polish, persistence, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Procedural Tactical Roguelike

Start two seeds and verify valid connected maps, then play several turns with movement, closed-door occlusion, enemy discovery, combat, damage, and at least one item or status effect. Confirm that enemies path around walls, take only legal turns, lose knowledge outside line of sight as designed, and do not act while the game is awaiting input or paused. Use inventory and equipment, descend or load a compact later-floor preset, save and reload the exact turn state, inspect the event log and debug overlays, and test keyboard plus pointer controls at narrow width.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
