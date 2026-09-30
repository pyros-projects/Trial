# Echo Chamber implementation plan

The requested outcome is a complete offline, single-file physics puzzle game and editor. The user's end-to-end instruction authorizes implementation and validation without intermediate approval gates. No repository or previous implementation exists. Work stays in this workspace, with no runtime dependencies.

Design: fixed 60 Hz deterministic simulation; recorded input masks and reference state for each echo; shared crates and real switch/door collisions. Canvas laboratory visuals and DOM controls. Six hand-authored chambers, timeline inspection through deterministic resimulation, editor with JSON-safe property controls, history and local slots. Procedural Web Audio begins on gesture.

1. Write behavior tests for bounded JSON validation, collision/jump, carry replay, switches, echo reset and divergence. Verify missing-engine failure, implement pure engine embedded in index.html, run tests.
2. Implement six levels, visual design, responsive shell, timeline, accessible input, victory and settings. Use the engine unchanged for gameplay and inspection.
3. Implement editor grid/pan/zoom, palette, selection/multi-selection, transform/property actions, history, validation, play-test, slots and JSON/trace I/O.
4. Exercise browser workflows with installed agent-browser on desktop and narrow widths; direct-file and isolated-network checks; inspect live physics state, console and requests. Record exact commands, failures and retests in validation.md.
5. Review and repair observed issues, rerun affected flows and compact regression suite; leave index.html and evidence.

Review focus: input release/cancel and focus loss; moving platform support and crate ownership; replay with altered shared geometry; imported nested values and object caps; editor history and saved draft; timeline cannot mutate live state; direct-file persistence exceptions and high-DPI resizing.
