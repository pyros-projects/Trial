# Task selection guide

Running all 24 tasks gives the broadest capability profile, but the set is intentionally modular. Use the matrix below to choose subsets without accidentally benchmarking the same implementation pattern repeatedly.

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
| `21-spreadsheet-chart-studio` | Data/editor | Formula grammar, mixed references, dependency recalculation, linked charts | Displayed answers that bypass cell semantics |
| `22-vector-layout-studio` | Creative/editor | Affine geometry, layers, selection, path editing, export fidelity | Shapes shift when grouped or exports differ from the artboard |
| `23-project-planning-studio` | Planning/editor | Calendars, dependencies, deterministic capacity scheduling, synchronized views | Gantt bars move without rescheduling dependent work |
| `24-capstone` | Research/creation | Live research, concept choice, distinct purpose, coherent implementation | A reskin, invented research, or a beautiful first frame without a working loop |

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

Use `08`, `15`, `19`, `21`, and `22`.

This focuses on selection, manipulation, typed or linked state, undo and redo, import and export, validation, responsive layouts, and the difficult transition between authoring and live simulation.

## Run discipline

Keep task sets, environments, tool access and budgets comparable. Let the agent test from the start. Freeze and hash the final artifact before independent evaluation. Record tool versions, actual usage and blocked checks.

## Everyday applications, single-file delivery

Use `21`, `22`, and `23` for familiar workflows with substantial state and algorithms beneath them. Formulas must recalculate, grouped objects must keep their geometry, and resource changes must alter an actual schedule. These are complete browser applications with embedded examples, explicit exports, and disposable session state. They require no backend or separately installed app stack.

## The Capstone

Use `24` when you want to see what an agent chooses to build as well as how it builds it. Supply the full prompt, permit the harness's live web tools, and retain the actual research trail. The agent compares candidate ideas against concise summaries of all 23 regular tasks, chooses one, and commits to observable behavior before implementing it.

Keep the same research access and overall budget across runs. Record unavailable tools separately from poor implementation. Assess research honesty, distinctness within Trial, scope choices, and how well the chosen experience works. Different agents may choose different products; comparing them does not provide the same evidence as giving everyone an identical product brief. Report Capstone observations separately from matched-task comparisons and do not use a short search as proof of worldwide novelty.

## Archived experimental track

The previous Real Apps prompts 21–30 live on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps), together with their fixtures, setup contracts, and backend evaluation guidance. Use that branch if you want to explore transactions, durability, concurrency, offline sync, or authorization. Those checks belong to that experiment; the current 24-prompt collection does not claim to test backend reliability.
