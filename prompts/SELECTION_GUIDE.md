# Task selection guide

Running all 30 tasks gives the broadest capability profile, but the set is intentionally modular. Use the matrix below to choose subsets without accidentally benchmarking the same implementation pattern repeatedly.

## Capability matrix

| Task | Family | Main capability pressure | Common false-success pattern |
|---|---|---|---|
| `01-fluid-simulation` | Numerical/GPU | Field solver, ping-pong state, pointer injection | Pretty particles masquerading as fluid |
| `02-hydraulic-erosion` | Numerical/3D | Coupled height, water, sediment, mutable rendering | Blue animation over immutable terrain |
| `03-modular-synth` | Audio/editor | Audio graph, scheduler, sequencing, offline export | UI that is not connected to sound |
| `04-deformable-physics` | Physics | Constraint solver, collisions, tearing, tools | Springy animation without stable constraints |
| `05-black-hole-lensing` | Shader/3D | Ray integration, disk intersection, diagnostics | Black circle over a warped texture |
| `06-wave-laboratory` | Numerical/editor | Wave equation, media, sources, probes | Expanding circles instead of a field |
| `07-orbital-mission-planner` | Scientific | Integrator, prediction, maneuvers, frames | Decorative ellipses disconnected from state |
| `08-sdf-csg-studio` | Shader/editor | SDF composition, picking, materials, export | Preset shader with a fake scene graph |
| `09-falling-sand-alchemy` | Cellular | Persistent material reactions and phase state | Independent pixels with scripted effects |
| `10-stealth-heist` | AI/game | Perception, pathfinding, memory, alarms, objectives | Vision cones and guards with no real state |
| `11-factory-automation` | Systems/game | Transport, recipes, blocking, power, metrics | Belts that animate without production logic |
| `12-rhythm-bullet-hell` | Audio/game | Shared transport, collisions, timing, replay | Music and bullets driven by unrelated clocks |
| `13-drone-racing` | 3D/game | Rigid flight state, input mapping, checkpoints | Camera translation pretending to be flight |
| `14-evolution-ecosystem` | Agents/simulation | Sensing, decisions, inheritance, ecology | Random walkers plus decorative family trees |
| `15-digital-logic-lab` | Engineering/editor | Typed graph, propagation, sequential state | Gate drawings with ad hoc output labels |
| `16-procedural-roguelike` | Game/algorithms | Generation, turns, FOV, pathfinding, save | Real-time shortcuts breaking turn semantics |
| `17-echo-loop-puzzler` | Physics/game/editor | Determinism, input replay, object links, editing | Ghost playback drifting from world state |
| `18-weather-storm-lab` | Numerical/3D | Coupled fields, clouds, intervention, probes | Noise clouds unrelated to atmosphere state |
| `19-node-graphics-studio` | Creative/editor | Typed node graph, evaluation, timeline, export | Static preset renderer beside a fake graph |
| `20-city-traffic-transit` | Agents/editor | Road graph, routing, signals, transit, metrics | Cars following hard-coded decorative paths |

## Suggested bundles

### Compact six-task frontier sweep

Use `01`, `03`, `07`, `10`, `17`, and `19`.

This covers numerical simulation, audio scheduling, scientific reasoning, autonomous game AI, deterministic physics and replay, and a sophisticated visual editor. It is a strong minimum set when model cost is high.

### Runtime validation stress test

Use `02`, `05`, `12`, `13`, `15`, and `18`.

These tasks frequently produce artifacts that look convincing at first glance while hiding shader failures, timing drift, disconnected controls, unstable integration, or state-propagation bugs. Use these to inspect whether the agent notices and fixes actual runtime failures during its normal development loop.

### Systems and agent behavior suite

Use `09`, `10`, `11`, `14`, `16`, and `20`.

This bundle emphasizes many interacting entities, persistent state, pathfinding, resource flow, agent decisions, emergent behavior, and evaluator tests that cannot be satisfied by a single polished screenshot.

### Game-development suite

Use `10`, `12`, `13`, `16`, and `17`.

This combines real-time AI, audio synchronization, 3D controls, turn-based determinism, and a replay-driven puzzle mechanic with an editor. Score game feel and completeness separately from visual polish.

### Editor and authoring suite

Use `08`, `15`, `17`, `19`, and `20`.

This focuses on selection, manipulation, typed or linked state, undo and redo, import and export, validation, responsive layouts, and the difficult transition between authoring and live simulation.

## Run discipline

Keep task sets, environments, tool access and budgets comparable. Let the agent test from the start. Freeze and hash the final artifact before independent evaluation. Record tool versions, actual usage and blocked checks.

## Real Apps track (21–30)

These are multi-file projects, not single-HTML demonstrations. Keep track-specific budgets and rubrics separate.

| Task | Core pressure | False-success pattern |
|---|---|---|
| 21 Import Studio | Parsing, transactional upsert, stable identities | A plausible preview that commits different changes |
| 22 Resource Booker | Local-time recurrence, overlap checks, concurrency | Two tabs both confirm the same slot |
| 23 Stockroom | Ledger, reservations, fulfillment, idempotency | Independently adjusted counters that diverge |
| 24 Workflow Desk | Durable execution, retry-safe real effects | Nodes animate while no persisted engine exists |
| 25 API Workbench | Async request identity, cancellation, streams | Late responses overwrite the wrong request |
| 26 Config Workbench | Typed structure, versioning, three-way merge | Missing and null collapse or one side silently wins |
| 27 Field Notebook | Offline outbox, blob persistence, conflicts | Offline UI works until reload or reconnect |
| 28 Approval Desk | Server authority, exact revision identity | Hidden buttons mistaken for access control |
| 29 Sheetcraft | Formula grammar, active dependencies, undo | Values update only for the demonstration formulas |
| 30 Project Planner | Deterministic constraints and resource capacity | Gantt bars move independently of the schedule |

### All ten: application engineering sweep

Use 21–30 for the full new track. Each task has six public scenarios and portable data.

### Transactional reliability

Use 21, 22, 23, 24, and 28 for imports, concurrent reservations, inventory accounting, durable execution, and authorization.

### Developer-tool correctness

Use 21, 25, 26, 29, and 30 for data tools, HTTP tooling, structural merge, expression evaluation, and constraint-based planning.

### Failure recovery

Use 22, 24, 25, 27, and 28. Exercise competing sessions, restart boundaries, response loss, delayed results, offline conflicts, and denied direct API calls.

Real Apps produce one project/ per run. A source-only gallery entry is expected until its reviewed app is manually started and its explicit local preview URL is supplied.
