# City Traffic and Transit Simulator implementation plan

Goal: a polished, editable, offline miniature-city simulator in one index.html, with meaningful traffic and transit outcomes.
Architecture: embedded Canvas 2D renderer, directed road graph and turn-aware Dijkstra routing, fixed 0.1-second traffic updates, lane queues, junction reservations, phased signals, and demand-driven car / freight / passenger agents. Ordered-stop buses board real waiting passengers and complete destination trips. HTML controls and inspectors expose all state.
Tech stack: native HTML, CSS, JavaScript, Canvas, Web Audio, localStorage. No runtime dependencies.
Spec: the complete user requirements supplied in this session.

Global constraints: one self-contained index.html; no external requests; direct-file compatibility; deterministic seeded simulation; evidence kept next to the artifact.
Review focus: disconnected and deleted roads; invalid and oversized imports; resize during continuous drawing; conflicting signal phases; passenger destinations after transit edits.

- [x] 1. Core graph: snapping, crossing splits, directed / restricted routing, lane-following fixed-step vehicles, validated state schema. Verify with independent graph fixtures and live browser diagnostics.
- [x] 2. City workspace: procedural miniature buildings / vehicles, camera, continuous drawing and previews, editing and history, inspectors, responsive controls. Verify pointer and keyboard workflows at 1280x800 and 390x844.
- [x] 3. Transport operations: demand, signals, incidents, transit passengers, ordered routes, frequencies and capacity; curated real scenarios; analytics and overlays. Verify closures, signal queues, transit boarding and completions, stress preset, speed / pause / step.
- [x] 4. Persistence and delivery: complete validated JSON snapshot, autosave / named cities, deterministic replay, CSV / PNG, procedural audio after a gesture. Verify export / reload equivalence, error preservation, file:// operation and request / console logs.
- [x] 5. Diagnose observed failures, retest failed flows plus compact regression, final source and dependency review, honest evidence report.

The user explicitly requests one autonomous end-to-end run. Design approval handoffs are superseded by that instruction. The workspace has no existing app or Git repository. Build in the requested directory, with no worktree or build process. Implementation was performed inline; the requesting-code-review skill authorized a read-only final reviewer. Both Important findings were fixed and retested.
