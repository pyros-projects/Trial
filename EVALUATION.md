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
- Spreadsheet values and charts follow parsed formulas, dependencies, and actual edits.
- Vector selection, grouping, transformations, and exports agree about geometry and order.
- Project dates follow calendars, dependencies, priorities, and resource capacity.
- The Capstone's chosen core system fulfills its declared behavior on inputs beyond its opening example.

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

## Capstone research and concept judgment

Prompt 24 uses `html-v1` for implementation quality. Also record qualitative observations about actual live research, distinctness from the other 23 briefs, the use of prior art, scope choices, and the three declared behavioral commitments. Verify the research evidence against tool history where available; a list of plausible links alone is insufficient. Unavailable web tools block the research requirement, while the artifact can still be assessed on its own merits.

Challenge new inputs and paths through the chosen system. The agent chooses a concept, not its own passing score: trivial functionality, invented evidence, decorative interactions, or unmet commitments remain shortcomings. Keep the original commitments and any scope revisions visible. Do not claim that a brief search establishes worldwide originality.

Different concepts are different briefs. Publish Capstone observations separately from comparisons where every model received the same product requirements, even though the gallery can display them together and uses the same HTML rubric. Numerical summaries do not turn this Vibe Benchmark into a controlled scientific ranking.

## Archived Real Apps evaluation

The previous `real-apps-v1` rubric, public scenarios, fixtures, and backend variation guidance remain on [`experimental/real-apps`](https://github.com/pyros-projects/Trial/tree/experimental/real-apps). The local gallery retains legacy report and project support. No current task claims to establish transactional durability, server authorization, or independent-device synchronization.

## Reports and comparison

Use `metadata.json` with a singular `score` (number or dimension object), or `report.json` with `total`, `rubric`, optional `artifact_sha256`, and `checks`. Metadata score takes display precedence, so do not leave conflicting scores in both files. Preserve a model's exact display name/version. The gallery is a viewer, not an automatic domain evaluator. Example scorecards in `schema/` are illustrative and never loaded into results automatically.

Public checks define observable exercises and expected outcomes. Independent variations may change data and execution order, not introduce undisclosed product rules. Tasks 21–23 include concrete small examples, but passing those examples alone does not establish general correctness. The package is not a fully implemented domain test harness.

`report.json` check statuses: pass, fail, blocked, not-run. Record evidence for each check. A hash mismatch marks a report stale in the gallery; an absent hash means the report has not been bound to these exact source bytes. The gallery excludes stale scores from summaries and labels unbound reports. The digest in `artifact_sha256` must match the displayed HTML/ZIP byte hash or the displayed authored-project source digest.

Keep any legacy Real Apps scores separate from HTML scores. On the leaderboard, repeated runs are averaged within each task, then task means are averaged per model and track. Different task coverage or budgets still make rankings incomparable; publish the coverage and per-task scores. Never replace missing scores with zero.

If inspecting legacy source projects, run them manually in an appropriate disposable environment; the local gallery never starts submitted commands. See the archived protocol for that separate experiment.
