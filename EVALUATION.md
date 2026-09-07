# Evaluation: end-to-end agentic application engineering

## One run, one artifact

The agent receives one prompt and may plan, execute, inspect, test and revise from the start. Evaluate the final delivered artifact independently. No previous generation or restricted-execution phase is required. Intermediate failures and successful fixes are useful trace evidence, not separate leaderboard submissions.

Freeze the final source and record its digest before independent evaluation. Keep agent-authored evidence separate from `report.json`, which is evaluator-owned. Unrun or harness-blocked scenarios are not passes. Pin model version, task set, hardware, runtime, browser/skill version, viewport, network policy and budgets; record actual tokens, duration, tool calls and browser actions. Repeat runs when resources permit and publish sample counts.

## 100-point HTML quality rubric (html-v1)

### 1. Launch correctness: 10 points

- 10: Loads without fatal errors; required capability initializes.
- 7: Loads with a recoverable warning or one non-critical subsystem failure.
- 3: Partial interface loads but core behavior is unavailable.
- 0: Does not launch or immediately fails.

### 2. Feature completeness: 15 points

Score the proportion and depth of explicitly required features. Decorative controls that do not alter application state do not count.

### 3. Behavioral correctness: 20 points

Judge whether the central domain system is real and coherent:

- Fluid behaves as a field rather than particles.
- Terrain state actually erodes.
- Audio scheduling drives actual audio.
- Constraints and collisions govern deformation.
- Lensing derives from ray behavior.
- Wave behavior emerges from a field solver.
- Maneuvers alter predicted and actual trajectories.
- CSG operations alter the distance field.
- Material reactions persist in cell state.
- Stealth agents use real occlusion, pathfinding, sound events, and state transitions.
- Factory items, machines, recipes, blocking, and power form one connected system.
- Rhythm-game audio and projectile events share one stable musical transport.
- Drone controls modify an integrated flight state rather than translating a camera.
- Ecosystem behavior, reproduction, inheritance, mutation, and lineage are connected.
- Logic outputs follow graph connectivity, propagation, clock edges, and stored state.
- Roguelike outcomes follow deterministic turns, field of view, and legal AI actions.
- Time-loop echoes replay deterministic actions and interact with actual puzzle physics.
- Weather visuals derive from evolving atmospheric fields and interventions.
- Node-graph connections and parameters determine the generated output.
- Traffic, signals, route choice, incidents, and transit affect actual agent movement.

### 4. Interaction quality: 10 points

Evaluate pointer continuity, keyboard behavior, touch or pointer support, control responsiveness, reset semantics, pause semantics, and conflict-free camera or editing controls.

### 5. Technical depth: 15 points

Reward coherent architecture, meaningful algorithms, connected subsystems, numerical safeguards, diagnostics derived from actual state, efficient data structures, and appropriate browser APIs.

### 6. Visual quality: 10 points

Judge legibility, composition, defaults, information hierarchy, animation quality, visual feedback, and whether the artifact is genuinely demonstration-ready.

### 7. Robustness: 10 points

Exercise prolonged runtime, rapid input, repeated reset, resolution changes, narrow viewports, extreme valid controls, lost pointer capture, focus changes, and unavailable capabilities.

### 8. Constraint compliance: 10 points

Check that the artifact is one self-contained HTML document, makes no external requests, uses no forbidden dependencies, adapts to resizing and high DPI, includes required diagnostics, and follows output constraints.

## Model-visible versus evaluator-only checks: HTML examples

The task prompt contains representative checks so the agent has a legitimate route to evidence. The evaluator should also run hidden tests that are not copied verbatim into the prompt.

Useful hidden tests across applications include:

- Rapid pointer movement across canvas boundaries
- Pointer cancellation and lost capture
- Repeated reset during active input
- Resize to very small dimensions and restore
- Repeated resolution changes while running
- Extreme but valid control values
- Five-minute stability run
- Rapid diagnostic-mode switching
- Offline load before first execution
- External-request inspection
- Device-pixel-ratio changes
- Reload and deterministic-state checks
- Resource-growth checks after repeated reset
- Controls whose labels change but state does not
- Diagnostics that are visually plausible but disconnected from real state
- Same-seed reset and deterministic replay comparison
- AI line-of-sight tests through open and closed doors
- Audio pause, resume, tempo-change, and scheduling-drift checks
- Save, reload, and import validation after meaningful state changes
- Undo and redo across editor mode changes and play-test transitions
- Invalid graph connections, combinational loops, malformed imports, and recovery
- Road closure, route invalidation, and congestion-aware rerouting
- Long accelerated simulation runs for population, traffic, factory, and weather drift
- Controller disconnect, focus loss, and simultaneous-input cleanup in games

## Real Apps quality rubric (real-apps-v1, tasks 21–30)

| Dimension | Points | What matters |
|---|---:|---|
| Launch | 10 | Reproducible declared setup/start, ready health, useful startup failures |
| Completeness | 10 | Every bounded core workflow is implemented, not a decorative menu |
| Behavior | 25 | Domain invariants, exact fixture semantics, meaningful business outcomes |
| Interaction | 10 | Usable primary flow, labels, error recovery, responsive editing |
| Technical depth | 15 | Coherent model, transactional persistence, identity/version design, real algorithms |
| Visual quality | 5 | Legibility and intentional product design, not spectacle |
| Robustness | 20 | Replays, stale writes, concurrency, crashes, offline conflicts where specified |
| Constraint compliance | 5 | Source delivery, manifest, local operation, seed/reset/test isolation |

Weights are also in evaluator/rubrics.json. Evaluate each run using the same track-specific rubric and the same scenarios. Do not compare a 90-point simulation score directly with a 90-point transactional-app score as though the measurements were interchangeable.


## Reports and comparison

Use `metadata.json` with a singular `score` (number or dimension object), or `report.json` with `total`, `rubric`, optional `artifact_sha256`, and `checks`. Metadata score takes display precedence, so do not leave conflicting scores in both files. Preserve a model's exact display name/version. The gallery is a viewer, not an automatic domain evaluator. Example scorecards in `schema/` are illustrative and never loaded into results automatically.

Each public Real Apps scenario has observable exercises and expected outcomes. Test true concurrent requests, repeat operation keys, restart against the same data, direct unauthorized API calls and offline conflicts where required. Variation tests may change data and execution order, not introduce undisclosed product rules. The files under `evaluator/` are suggestions for the operator, not a fully implemented hidden test harness.

`report.json` check statuses: pass, fail, blocked, not-run. Record evidence for each check. A hash mismatch marks a report stale in the gallery; an absent hash means the report has not been bound to these exact source bytes. The gallery excludes stale scores from summaries and labels unbound reports. The digest in `artifact_sha256` must match the displayed HTML/ZIP byte hash or the displayed authored-project source digest.

Compare the HTML and Real Apps rubrics separately. On the leaderboard, repeated runs are averaged within each task, then task means are averaged per model and track. Different task coverage or budgets still make rankings incomparable; publish the coverage and per-task scores. Never replace missing scores with zero.

Source projects must be run manually inside an appropriate disposable environment, with dedicated data directories and isolated browser contexts. A local gallery, an iframe or a second port is not a security sandbox. Offline validation for Real Apps blocks external internet while retaining explicitly permitted local services, except in the task that requires true disconnected editing.
