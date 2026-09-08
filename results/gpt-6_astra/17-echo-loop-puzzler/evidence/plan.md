# ECHO implementation plan

Goal: Deliver the complete time-loop puzzle game and editor in one offline index.html.
Architecture: Canvas renderer, fixed 60 Hz AABB simulation, immutable input recordings, DOM application shell and editor, validated JSON persistence. Recordings replay through the same collision and interaction code as the player. Shared-world interference is detected against recorded states.
Design: Warm graphite research terminal, amber player, individually colored echoes, architectural chamber art, bottom timeline, right mission panel. Intro: stand on channel A plate, record an echo, independently reach the unlocked goal. Six chambers combine plates, carrying, lifts, timers, lasers, and multiple echoes.
Authorization: User explicitly requested one end-to-end autonomous run; execute inline without approval checkpoints. Workspace is empty and not a git repository.

- [x] Simulation: input replay, stable movement, jumping, crates/carry/throw, channels, doors, lifts, one-way platforms, hazards, resets and divergence.
- [x] Experience: responsive shell, six levels, tutorial, victory/ranks, timeline inspection, input, audio/accessibility and diagnostics.
- [x] Editor: grid/pan/zoom, palette, selection/multi-select, drag/properties, rotate, duplicate/delete, undo/redo, play-test, validation and persistence/import/export.
- [x] Verification: physics and JSON checks, actual browser cooperative puzzle and editor workflows, direct file/offline, desktop/mobile, errors/network, screenshots and evidence.

Verification contract: engine tests load the actual inline simulation; browser tests use actual pointer/keyboard and UI controls, with read-only live diagnostics to inspect non-DOM state. Do not manufacture outcomes. Verify persistence and malformed input handling. Keep exact commands and findings in validation.md.
