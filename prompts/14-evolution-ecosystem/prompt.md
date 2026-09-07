# Evolutionary Ecosystem Laboratory

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
Create a polished, interactive evolutionary ecosystem laboratory that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, simulation logic, controls, charts, rendering, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, fonts, or network dependencies.

Simulate a persistent two-dimensional environment populated by autonomous organisms that must acquire energy, avoid hazards, reproduce, mutate, compete, and die. The organisms must be logical agents with position, velocity or heading, energy, age, health, genotype, phenotype, sensors, decisions, and lineage rather than decorative particles with randomized movement.

Provide at least two ecological roles or allow roles to emerge from traits, such as plants or renewable food, herbivores or gatherers, predators, scavengers, and decomposers. Include energy transfer, feeding limits, digestion or conversion efficiency, movement cost, basal metabolism, reproductive cost, aging, injury, and death. Matter or energy accounting may be simplified but should remain coherent enough that populations cannot grow indefinitely without resources.

Each mobile organism must sense meaningful local information such as food direction, predator or prey proximity, obstacle distance, local crowding, temperature, moisture, pheromone, or light. Behavior may use weighted steering, state machines, compact neural networks, or another inspectable controller. Decisions must depend on sensor state and inherited parameters rather than pure random wandering.

Implement reproduction with inherited traits, mutation, and optional crossover. Traits must influence visible and behavioral properties such as size, speed, turning, vision, metabolism, preferred food, aggression, camouflage, fertility, lifespan, or controller weights. Track parents, generation, mutations, descendants, and species or cluster assignment using a stable distance or clustering approximation.

Provide a spatially varied environment with food growth, terrain or obstacles, climate gradients, day and night or seasons, and at least one changing field such as temperature, moisture, toxicity, or fertility. Environmental parameters must affect resource growth or organism performance. Include disasters or interventions such as drought, bloom, cold snap, disease, predator introduction, food pulse, or habitat barrier.

Allow the user to pan and zoom, select and follow organisms, inspect ancestry and descendants, spawn organisms or resources, remove entities, paint terrain or fertility, add barriers, alter climate locally, and create a protected observation area. Pointer tools must remain smooth while the simulation is accelerated.

Provide pause/resume, single-step, reset, deterministic seed, simulation speed up to a useful accelerated mode, world size or population preset, mutation rate and magnitude, food growth, metabolic cost, reproduction threshold, sensor range, climate amplitude, disaster controls, and rendering density. Include curated presets such as balanced meadow, predator-prey oscillation, island isolation, harsh desert, rapid radiation, mass extinction and recovery, and dense stress test.

Display live charts derived from actual history for population by role or species, births, deaths, average energy, biomass, trait distributions, generation, diversity, and resource abundance. Allow clicking a species or lineage to highlight its members and show a compact phylogeny or ancestry tree. Historical graphs must use retained samples rather than invented curves.

Include selectable visualization modes for natural appearance, energy, age, generation, species or lineage, speed, sensor range, current behavior, fertility, temperature, moisture, and resource density. Include optional overlays for sensor rays, steering vectors, nearby targets, spatial-partition cells, and decision outputs.

Support saving and loading complete simulation state as JSON or a compact binary-like text format, local autosave, exporting chart data as CSV, and exporting the current view as PNG. Deterministic seeds should reproduce initial conditions, while saved state must preserve evolved genotypes and lineages.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer input, and remain responsive with hundreds or thousands of organisms through spatial partitioning, aggregation, adaptive rendering, or other suitable optimizations.

Display a compact live overlay containing frames per second, simulation tick and speed, total population, births and deaths per interval, species count, oldest generation, total biomass or energy, selected entity, active intervention, and pause state.

Use defaults that immediately show organisms seeking food, avoiding threats, reproducing, and forming visible ecological patterns. Treat agent behavior, inheritance coherence, emergent ecology, lineage accuracy, intervention effects, visualization truthfulness, performance, persistence, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Evolutionary Ecosystem Laboratory

Run long enough or use accelerated time to observe feeding, energy change, reproduction, inherited variation, death, and population change. Select a creature and verify that its sensors, decision values, genotype, age, energy, parent or lineage, and current behavior update from live state. Alter food, climate, obstacles, mutation, or predation and confirm a measurable population response; test pause, single-step, deterministic reset, charts, lineage view, save and load, and multiple diagnostic modes.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
