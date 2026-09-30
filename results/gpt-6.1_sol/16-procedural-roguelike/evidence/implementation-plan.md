# Hollowkeep Implementation Plan

> For agentic workers: use superpowers:executing-plans, implementing inline in the authorized workspace.

Goal: deliver a polished complete deterministic tactical roguelike in index.html.
Architecture: pure deterministic engine script followed by code-generated rendering and DOM controls in the same HTML.
Tech stack: HTML, CSS, vanilla JavaScript, Canvas 2D, Web Audio, localStorage.
Spec: evidence/design.md and the complete user brief.

Global constraints: single-file runtime; no network, libraries, fonts or fetched assets; real-browser validation; preserve honest evidence; do not change supplied tests.

Review focus: malformed saves; fog leaking entities; summons acting on creation turn; pointer paths passing newly discovered danger; pause and repeated keys advancing time.

Task 1 — deterministic engine and map generation
- [x] Write engine tests before implementation and observe the missing-engine failure.
- [x] Implement HKCore.Engine, generation, validateFloor, los and pathfind in index.html.
- [x] Test connected maps across all styles/seeds/floors, door occlusion, legal occupancy, one action per enemy per accepted turn, and unchanged idle state.

Task 2 — tactical combat, progression and complete run loop
- [x] Add distinct enemy decisions, bounded memory, consumables/abilities/equipment, hazards, boss telegraphs, death/victory and checkpoints.
- [x] Test damage/status duration, inventory turn cost, descent, final encounter and action replay equality.

Task 3 — interface, rendering and settings
- [x] Add responsive canvas/vector art, log, minimap, live overlay, labeled dialogs and help.
- [x] Add keyboard/pointer/mobile paths and targeting, pause, accessibility and gesture-enabled procedural audio.
- [x] Inspect real browser screenshots at desktop and narrow widths and exercise input continuity.

Task 4 — persistence and diagnostics
- [x] Add validated save/load/import/export, records, deterministic replay and live system diagnostics.
- [x] Test exact turn-state round trip, rejection of invalid/old data, pause/idle and diagnostic overlays.

Task 5 — end-to-end validation and improvement
- [x] Use installed version-matched agent-browser core and exploratory workflows.
- [x] Test two actual seeds, doors, discovery, pathfinding, combat/items/equip, final preset, persistence/replay, both viewports and file://.
- [x] Reproduce/fix failures and repeat failed flows with compact regression checks.
- [x] Record exact commands, outcomes, screenshots, remaining limitations in evidence/validation.md.
