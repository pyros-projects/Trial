# Pulse Vector implementation plan

Goal: deliver the complete single-file rhythm bullet-hell game specified in the user's brief.
Architecture: embedded pure fixed-step simulation and musical timeline; Web Audio look-ahead synthesis; Canvas renderer; accessible HTML controls. All runtime code is in index.html. Native inline execution, as requested by the end-to-end brief.
Constraints: no imports, external assets, dependencies, build step, server requirement, or network access. Evidence and development harnesses remain outside the delivered file.

1. Build the deterministic core: seeded patterns, swept collisions, focus/dash/graze scoring, three boss phases, timeline tempo segments, replay validation. First run behavioral core tests red, then implement and run green.
2. Build the complete playable presentation: responsive neon arcade UI, canvas, title/countdown/run/pause/results, lab step grid, mixer, settings, records/replay. Connect real AudioContext scheduling and actual analyser output to the transport and rendering.
3. Validate with agent-browser 0.31.1 (core and dogfood workflows read): direct file, blocked-network HTTP, 1280x800 and 390x844, gestures, movement/focus/dash/damage, measures, pause/resume, tempo/editor, replay and malformed import, persistence, reduced effects. Record diagnostics, screenshots, console, failures and retests.
4. Review against every requirement and run final core/browser regression; preserve honest limitations.

Review focus: scheduler backlog after pause/focus loss; input release and canvas scaling on mobile; replay settings/action determinism; Web Audio unavailable; malformed imported data.
Decision: user explicitly requests one uninterrupted implementation run, so approval gates in planning skills are superseded. No git metadata exists; delivery is the working file and in-project evidence, with no git commits or worktree.

Status: implementation, behavior tests, genuine replay checks, desktop/mobile browser QA, and independent source review complete. Final fallback, configuration, dependency and console checks complete; physical gamepad and subjective listening limits documented.
