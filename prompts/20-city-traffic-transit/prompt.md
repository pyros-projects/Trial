# City Traffic and Transit Simulator

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
Create a polished, interactive city traffic and public-transit simulator that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, simulation code, controls, charts, procedural audio, and visual assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, image files, audio files, fonts, or network dependencies.

Provide a buildable top-down or isometric city map where the user can draw and edit roads, intersections, one-way segments, lane counts, turn restrictions, traffic signals, roundabouts or equivalent junctions, zones or trip generators, parking or destinations, bus stops, and transit routes. Continuous road drawing must create a coherent graph with snapping, previews, undo, redo, deletion, and useful handling of crossings and invalid geometry.

Simulate individual vehicles or well-grounded vehicle packets with origins, destinations, route planning, lane position, acceleration, braking, safe following distance, intersection yielding, signal compliance, queueing, and collision avoidance. Vehicles must not simply move along random decorative paths. Include at least cars, service or freight vehicles, and buses or trams with distinguishable behavior.

Implement actual route choice over the current network using shortest time, distance, congestion-aware cost, or another explicit model. Network edits, road closures, incidents, or severe congestion must cause affected agents to stop, reroute, or fail visibly rather than driving through missing roads. One-way and turn restrictions must be respected.

Implement configurable traffic signals with phases, cycle lengths, offsets, protected turns or a simplified equivalent. Provide automatic, fixed-time, and user-edited control. Signal changes must affect right of way and queues. Include a visual phase editor and diagnostics for conflicting or unreachable phases.

Implement public transit with route creation, ordered stops, vehicle frequency, capacity, dwell time, passenger generation, waiting, boarding, transfers or a useful simplified model, and destination completion. Transit ridership and travel time must derive from available routes and demand rather than a cosmetic bus animation. Allow comparing car-only and transit-supported scenarios.

Provide land-use or demand tools that create residential, commercial, industrial, event, or school trip patterns. Include time of day, rush hour, directional demand, incidents, construction, weather slowdown, and special-event controls. Demand must influence actual origin-destination trips and network load.

Provide pause/resume, single-step, reset, deterministic seed, simulation speed, demand scale, driver aggressiveness or headway, rerouting sensitivity, lane-change behavior, signal policy, transit frequency, vehicle capacity, incident rate, road-building cost or sandbox mode, and map size. Time acceleration must preserve coherent behavior rather than letting vehicles tunnel through junctions.

Display live analytics derived from actual state: throughput, average and percentile travel time, delay, queue length, network speed, completed and failed trips, transit wait and occupancy, ridership, emissions or fuel proxy, and congestion by corridor. Include time-series charts and the ability to select a road, intersection, stop, route, or vehicle for detailed inspection.

Include selectable overlays for speed, density, queue length, travel time, route choice, signal phase, turn movement, transit coverage, waiting passengers, emissions, and origin-destination demand. Show vehicle paths or next-route segments on selection and provide a network-validation view for disconnected components and illegal turns.

Include curated scenarios such as simple crossroads, synchronized avenue, suburban bottleneck, downtown grid, stadium event, bridge closure, bus rapid transit corridor, transit strike, induced-demand experiment, and dense stress test. Scenarios must configure real network and demand state.

Render the simulation with intentional miniature-city polish: readable roads and lanes, animated vehicles, signals, buildings or land-use blocks, transit stop activity, headlights or time-of-day treatment, construction and incident effects, map labels, selection outlines, and restrained procedural interface and traffic audio through Web Audio after user interaction.

Support saving and loading complete city state as validated JSON, local autosave and named scenarios, CSV export of metrics, PNG export of the map, and deterministic scenario replay. Invalid imports must fail gracefully without destroying the current city.

The application must adapt to browser resizing, support high-DPI displays, provide usable mouse and touch or pointer controls, avoid conflicts between road drawing, selection, and camera movement, and remain responsive with hundreds or thousands of active agents through efficient graph, spatial, or aggregation techniques.

Display a compact live overlay containing frames per second, simulated time and speed, active and completed trips, average travel time, network speed, total queue, transit ridership, selected tool, active incident count, and pause state.

Use defaults that immediately show a functioning city with visible traffic, signals, and a transit line, while allowing meaningful edits within seconds. Treat routing correctness, intersection behavior, traffic-flow coherence, transit-system depth, editor usability, analytics truthfulness, visual polish, performance, persistence, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: City Traffic and Transit Simulator

Build or edit a connected road network, allow vehicles with distinct origins and destinations to route through it, and confirm queueing plus traffic-signal response. Create a bottleneck or closure, observe rerouting or congestion metrics, then add or modify a bus or transit route and verify stops, vehicles, passengers or ridership, and travel-time impact. Test one-way or lane direction, signal timing, pause and single-step, speed changes, a preset under stress, save and reload, heatmap diagnostics, and continuous road drawing after viewport resize.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
