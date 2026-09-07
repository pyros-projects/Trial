# Factory Automation and Logistics Game

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
Create a polished, interactive factory-automation and logistics game that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, simulation code, controls, procedural audio, icons, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, audio files, fonts, or network dependencies.

The application must simulate a real production system rather than displaying decorative conveyor animations. Provide a grid or freely placeable construction surface containing finite or renewable resource deposits, extractors, conveyor belts, turns, splitters, mergers, inserters or loaders, storage, processing machines, assemblers, generators, power connectors or a coherent abstracted power network, delivery targets, and obstacles. Items must exist as logical entities or quantities that move through connected transport networks, queue, block, merge, split, and are consumed or produced according to recipes.

Allow the user to build, rotate, upgrade, configure, copy, move, and delete structures. Dragging to lay belts or power lines must be smooth and predictable, support corners or automatic routing, and provide a valid-placement preview. Include an eyedropper or copy tool, undo and redo, multi-delete or area selection, and clear visual feedback for invalid connections, occupied cells, missing inputs, full outputs, and insufficient power.

Implement several multi-stage recipes with distinct resources, processing times, input ratios, output ratios, and machine requirements. Include at least one recipe that requires combining two independently produced components. Machines must pause or slow when starved, blocked, unpowered, or incorrectly configured. Upgrades or modules may alter speed, power, efficiency, or storage, but must change actual simulation values.

Implement a meaningful energy system. Generators must consume fuel or use another constrained source, connected consumers must draw power, demand and supply must be measured, and brownout or overload behavior must affect machines. The power display must not be a cosmetic bar disconnected from machine operation.

Provide a compact campaign or challenge loop with a target production contract, resource budget or construction cost, progress, completion, restart, and score based on time, efficiency, power, footprint, or throughput. Include a sandbox mode with unlimited construction and several curated presets such as starter line, balanced factory, congested belts, power crisis, multi-product bus, and high-throughput stress test.

Provide simulation controls for pause/resume, single-step, reset, simulation speed, item density, belt speed, machine speed, recipe selection, construction cost mode, power difficulty, deterministic seed, and optional grid size. Changing simulation speed must preserve coherent production ratios rather than causing large timing errors or duplicate items.

Include live analytics derived from actual factory state: per-item production and consumption rates, machine utilization, belt throughput, queue length, storage levels, power generation and demand, delivery progress, and detected bottlenecks. Display time-series charts or sparklines and allow selecting a machine, belt, or network segment to inspect its current state and recent history.

Include selectable overlays for item flow direction, connection graph, power network, utilization heatmap, congestion, blocked outputs, and per-structure status. Diagnostics must update from the active simulation and remain usable while building.

Render the factory with intentional game-like polish, clear animated transport, readable item identities, machine activity, power pulses, construction effects, selection outlines, compact tooltips, and procedurally generated interface sounds through Web Audio after user interaction. The default preset should visibly produce and move items immediately.

Support saving and loading the complete factory as JSON, local autosave with named slots, deterministic preset seeds, PNG export of the current factory, and a compact shareable text representation where practical. Imported data must be validated sufficiently to avoid crashing the application.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer controls, handle continuous belt drawing and camera panning without conflicts, and remain responsive with hundreds or thousands of moving items or aggregated item packets.

Display a compact live overlay containing frames per second, simulation tick, current speed, active item count, operating and stalled machine counts, power supply and demand, delivery rate, current tool, and objective progress.

Use defaults that immediately demonstrate extraction, transport, processing, and delivery. Treat logistics correctness, connected subsystem behavior, construction ergonomics, timing stability, bottleneck visibility, game progression, visual quality, performance, persistence, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Factory Automation and Logistics Game

Construct or modify a working chain from resource extraction through transport and processing to delivery of a target product. Verify item movement, machine recipes, power consumption, blocking or backpressure, belt rotation, deletion, and at least one splitter, merger, or inserter behavior. Create a deliberate bottleneck, observe the metrics change, pause and single-step the simulation, test time speed, save and reload the exact factory state, and confirm that a curated preset continues producing after a viewport resize.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
