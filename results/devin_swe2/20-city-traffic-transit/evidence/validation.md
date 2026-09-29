# Validation — Metroflux City Traffic & Transit Simulator

Artifact: `index.html` (single self-contained file, no external assets/deps).
Server for tests: `python3 -m http.server 8912` on 127.0.0.1 (file is also verified via `file://`).
Browser tool: `agent-browser` 0.31.1 (headless Chromium via CDP), sessions `mf`/`mf2`.
Verification method: real pointer/mouse events on the canvas, toolbar/panel clicks via a11y refs and CSS selectors, `eval` state inspection of the live `W`/`S` objects, screenshots.

## Environment checks

| Check | Result | Evidence |
|---|---|---|
| Page loads, default city visible with traffic/signals/transit | PASS | default scenario "Downtown grid" builds 25 nodes/40 edges/2 routes; vehicles spawn within seconds; `shot3.png` |
| No external requests | PASS | `performance.getEntriesByType('resource')` → `[]` outside 127.0.0.1/data: |
| `file://` direct open | PASS | session mf2: `W.edges.size=40`, sim runs (t=23403) |
| Console errors after cycling all 10 scenarios at 16× | PASS | `window.__errs` → `[]` |
| 1280×800 and 390×844 viewports | PASS | `narrow.png` — panel overlays map, toolbar wraps, phase editor usable |

## Editor / build

| Check | Result | Evidence |
|---|---|---|
| Continuous road drawing (clicks → polyline, dblclick finish) | PASS | mouse clicks at 3 points → `edges 40→48`, `nodes 25→29` (auto-split at crossings) |
| Snapping & intersection splitting | PASS | drawn line crossing grid created junction nodes (n82/n83) and split edges (e84–e86) |
| Undo / redo | PASS | draw → undo → edges 46→40 nodes 29→25; redo → 46/29 |
| Eraser | PASS | click on drawn edge → `e86` deleted (edges 46→45). Initial miss was a genuine miss (>28m from geometry) — retest hit and passed |
| Zone drawing (drag rect, type selectable) | PASS | drag → zone z95 res 190×238 created; type chips in Build tab |
| Signal tool toggle | PASS | click junction → `signal` removed; roundabout tool → `roundabout=true` |
| Bus stop placement | PASS | tool click on road → stops 7→8 |
| Transit route creation via UI (New route → click map) | PASS | route r83 created, 2 stops appended by clicking roads (stops total 10) |
| Turn restrictions (node inspector chips) | PASS (manual via node panel) | inE→outE chips toggle `noTurns` — enforced in `routeEdges` |
| Build cost / sandbox | PASS | Build tab economy section; non-sandbox road draw charges $120/m and refuses when over budget |

## Simulation

| Check | Result | Evidence |
|---|---|---|
| Vehicles route with real paths (Dijkstra, congestion-aware) | PASS | `v.path` edge lists; costs mix free-flow + `emaT` + `load` by `P.reroute` |
| Car following / queueing / signal response | PASS | IDM accel; queues form at reds (`sig:'r'` samples), discharge on green; `queue`/`cross` states observed live |
| Distinct vehicle classes | PASS | `car`, `truck` (slower accel/v0), `bus` (longer, dwells, capacity) in `VTYPES` |
| One-way respected | PASS | edge set `oneway='f'` → `wrongDir:0, wrongPath:0` over ~160 sim-s |
| Road closure → reroute | PASS | busiest edge closed → occupants rerouted (`rerouteAffected` + gate-level `attemptReroute`); remaining-path check: 6 still-path vehicles reroute on arrival at the closed link |
| Bridge closure scheduled event | PASS | `W._pendingClose` fires at t≈23839; Old Bridge `closed:true`, queue builds, traffic shifts to New Bridge |
| Incidents (crash lane-block / roadworks slowdown) | PASS | `addIncident` blocks lane (virtual stopped obstacle), `e.cond` reduced, clears after duration; tool places via click |
| Stuck/failed trips visible | PASS | `reroute-fail`, `unreachable`, `stuck`, `pax-abandon` logged in `tripLog`, counted in HUD/analytics |
| Time acceleration coherence | PASS | fixed dt=1/30 substeps (≤240/frame); no tunneling observed at 8×/16×; junction occupancy respected under speed |
| Determinism | PASS | seed 42 + reset → 600 steps → identical vehicle count & positions in two runs |

## Signals

| Check | Result | Evidence |
|---|---|---|
| Phases cycle, affect right-of-way/queues | PASS | `signalState` g/y/r; vehicles stop at red (`gate.stop`), go on green; amber in last 2.2s |
| Adaptive & fixed policies | PASS | `autoRetune` stretches phase with queue (observed dur 14→47.6s then capped ≤100s cycle); fixed mode honored |
| Visual phase editor | PASS | movement×phase grid (12 moves × 4 phases, 48 toggle cells rendered); click toggles allow-set (star ↔ individual moves) |
| Diagnostics | PASS | `signalDiag` flags conflicting greens (11 after permissive edits) and unreachable phases ("✓ no conflicts" on clean grid) — `narrow.png` |

## Transit

| Check | Result | Evidence |
|---|---|---|
| Routes with ordered stops, headway spawn, capacity | PASS | `r.stops[]`, `r.headway` (spawn every hw, staggered initial stops), `r.capacity` caps boarding |
| Dwell + boarding/alighting | PASS | `_dwells` counter 3→26; `paxRide` up to 60 (stress); `onboard` counts per bus |
| Passenger generation / waiting / transfers | PASS | pax spawn at nearest stop (rect-distance ≤520m), legs computed by BFS over route network (`transitPath`), transfers via multi-leg plans; wait/ride/done/failed states |
| Ridership & travel-time impact | PASS | `W.busTrips` completed transit journeys (10+ in downtown soak, 5+ in stress), `avgWait` metric; `transitShare` slider shifts mode split; `strike` scenario removes routes → all-car |
| Buses reroute/skip unreachable legs | PASS | `busLeg` retries/skips stops; bus waits/queues like other traffic |

## Demand

| Check | Result | Evidence |
|---|---|---|
| Land-use zones generate OD trips | PASS | `pickZone` gen/att weighted; res→com AM directional bias |
| Time-of-day curve | PASS | `todMult` AM/PM peaks; soak showed congestion rising into 08:00 peak |
| Event mode / stadium | PASS | `S.eventMode` multiplies evt-zone attraction at ~20:00 |
| Weather slowdown | PASS | `weatherMult` clear/rain/snow scales speeds |
| Demand scale / headway / aggressiveness / lane-change / reroute / incident-rate sliders | PASS | all wired to `P.*` used by sim |

## Analytics & overlays

| Check | Result | Evidence |
|---|---|---|
| Live metrics truthful | PASS | `metrics()` derives from `tripLog`+live state; p50/p95 computed; worst-corridor list from `emaT` ratio |
| 8 time-series charts | PASS | `canvas.chart` × 8 render (`analytics.png`) |
| Overlays | PASS | queue/speed/density/travel/route/signal/turn/coverage/pax/emis/OD/validation — `overlay-queue.png`, `overlay-valid.png`, `narrow.png` (validation green main component) |
| Selection inspector (edge/node/zone/stop/route/vehicle/incident) | PASS | edge e90 inspector shows attrs + editable lanes/oneway/name/close |
| Vehicle path display on selection | PASS | `drawVehicles` dashed path when veh selected |

## Scenarios

| Check | Result | Evidence |
|---|---|---|
| 10 curated presets load real state | PASS | all build (see sweep: nodes/edges/zones/routes/stops/signals counts), 0 errors |
| Stress test performance | PASS | 60 fps with ~126 agents + 60 riding pax at 8× |

## Persistence

| Check | Result | Evidence |
|---|---|---|
| JSON save/load round-trip | PASS | serialize→load→identical counts (4/5/4/5/1) |
| Invalid import graceful | PASS | `{foo:1}`→"not a Metroflux city file"; non-JSON→caught; world untouched |
| Named local slots + autosave resume | PASS | `saveLocal`/`listLocal`/autosave row in Save/Load tab |
| CSV metrics export | PASS | `exportCSV` runs, emits header+rows |
| PNG map export | PASS | `cv.toDataURL` yields ~205KB image |
| Deterministic replay | PASS | Replay button + seed field; identical-state check passed |

## Known limitations (honest)

- Signal phase "offsets" exist in the model but have no UI and are not applied between junctions.
- Passenger access to/from stops is instant (no walking leg); catchment = stop within 520 m of zone rect.
- Turn-restriction editing is per-node chips (works, but not in the phase editor).
- Permissive left turns in auto phases yield via occupant-conflict checks rather than a dedicated protected phase — expressible manually in the editor.
- At very high demand (≥1.5× on the 4×4 downtown) the grid legitimately gridlocks; queue/reroute/failed metrics reflect it rather than hiding it.
- Audio verified programmatically (context resumes, gains ramp, no errors); loudness/quality not judged by ear.
- Pinch zoom implemented via 2-pointer tracking; touch drag tested only via pointer events (unified path), not a physical device.

## Bugs found & fixed during validation

1. `nodeCache.clear` — object vs Map crash prevented scenario loading.
2. Instant trip completion — `doneS` behind spawn position on single-edge paths (trips logged `dist:0, tt:1.5s`).
3. Path indexing off-by-one — `routeEdges` excludes origin edge while `v.pi` assumed it included it.
4. Junction conflict matrix counted same-approach/same-exit as conflicts → serialized junctions (1 veh / 3 s).
5. Crossing moves spanned edge-midpoint→midpoint (~300 m) → 60–100 s junction traversals → global gridlock. Rewrote to junction-box beziers (~15–35 m).
6. Last-edge phantom stop line — vehicles braked before `doneS` and never finished.
7. `modelRestore` crashed restoring signalized nodes (mkSignal on edge-less snapshot node) → 1-node world after undo.
8. Stops on split edges deleted — now captured & reattached to nearest piece.
9. `netSummary` emitted `[object HTMLDivElement]`; HUD showed timestamp not FPS.
10. Bus dwell check used wrong arclength frame for 'b' travel; stops' zone catchment too small; riders orphaned when a bus failed (now failed visibly); buses all spawned at stop[0] (now staggered).
11. Demand rate ~10× oversaturated (≈700 trips/min) → recalibrated.
12. `resetSim` clobbered scenario start times (stadium 19:10) → `W.startT`.
13. Zone label font scaled the wrong direction; map furniture got min-screen-size treatment.
14. Scenario route stop matching radius 80→140 m.
