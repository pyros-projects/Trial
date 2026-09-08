# Civic Mobility Lab implementation plan

Goal: Deliver the full editable traffic and transit simulator in one offline index.html.
Architecture: Canvas renderer and pointer editor over a directed road graph; deterministic fixed-step individual-agent simulation; DOM controls and analytics. Pure model code is embedded in an identifiable script so the exact delivered engine can also be exercised in Node without a browser.
Tech stack: Native HTML, CSS, JavaScript, Canvas 2D, Web Audio, browser storage. No runtime dependencies.
Spec: The user's City Traffic and Transit Simulator requirements in this conversation.

The user explicitly requested one uninterrupted end-to-end run. Execute inline, with no design approval or execution handoff gates. This empty task workspace is the delivery location; no worktree or source repository is present.

- [x] Model: Write behavior tests for directed routing, illegal turns, closures, segment splitting, signal gating, vehicle following, transit boarding/completion, deterministic replay and rejected imports. Verify initial failures, then implement the real embedded model.
- [x] City workspace: Build the responsive interface, procedural city renderer, live charts, compact diagnostics, selection and camera controls.
- [x] Editor: Wire continuous snapped drawing with crossing splits, preview, undo/redo, roads/lanes/one-way/restrictions, intersections/signals, zones, destinations, stops, ordered transit routes, closure and deletion.
- [x] Operations: Add all curated presets, demand/weather/event and driver controls, transit comparison, exact state export/import, local names/autosave, CSV/PNG, seed/reset/replay and gesture-enabled procedural audio.
- [x] Validate: Use agent-browser 0.31.1 core and dogfood workflows. Exercise real controls and canvas on file:// with HTTP/HTTPS blocked, inspect diagnostics/screenshots/console/requests. Repeat at 1280x800 and 390x844, after resize, and under stress.
- [x] Repair observed defects, rerun meaningful model and browser checks, document results and limitations in evidence/validation.md.

Model contracts planned for browser UI and tests: CitySim constructor(config), addNode(x,y), addRoad(a,b,props), drawRoad(x1,y1,x2,y2,props), route(origin,destination,options), rebuild(), tick(dt), spawnTrip(origin,destination,type), addStop(node,name), addRoute(stops,props), metrics(), serialize(), CitySim.fromJSON(text), CitySim.scenario(name,seed). Data: nodes, roads, zones, stops, routes, vehicles, passengers, settings, counters, history.

Model choices: Distances in meters, speeds in m/s, fixed 0.1-second updates. Dijkstra over (node,incoming-road) states enforces turn bans. Downstream capacity, lane-local following and conservative exclusive junction reservation avoid collisions. Signals provide EW/NS protected phases with clearance intervals. Transit uses direct services or one transfer, individual wait/board/alight records and walk completion. Vehicles removed from deleted links fail visibly; closure vehicles hold while affected approaching traffic reroutes. All analytics derive from actual state and are explicitly labeled where proxies are used.

Completed: implementation, repairs, model regression suite and actual browser workflows. See validation.md for observations, preserved failures, retests and limitations.
