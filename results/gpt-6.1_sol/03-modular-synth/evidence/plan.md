# Forma Studio Implementation Plan

Goal: finish the standalone workstation and genuine browser validation in one run.
Architecture: embedded pure project helpers, shared audio graph/voices, look-ahead transport, responsive editor, project/export controller.
Spec: evidence/design.md and user requirements.

- [x] 1. Write and run failing pure behavior tests for swing timing, deterministic randomization, project validation, polyphonic events and PCM WAV encoding. Implement core in index.html and pass tests.
- [x] 2. Build responsive interface, sequencer, polyphonic piano roll, drum lanes, note inspector, keyboard, presets and seeded editing. Run artifact syntax/core checks.
- [x] 3. Implement Web Audio graph, synthesis, bounded voices, percussion, mixer/effects, stable transport and output analysers. Exercise user-enabled playback and editing.
- [x] 4. Complete JSON import/export, local persistence and shared-graph offline WAV. Inspect downloads and malformed import behavior.
- [x] 5. Test desktop 1280x800 and phone 390x844 with actual controls, direct-file compatibility, external traffic blocking, focus/pointer cancellation, tempo/swing/length and analyser state. Fix failures and rerun affected flows and regression checks.
- [x] 6. Conduct final review and record commands, results, limitations and evidence in validation.md.

Review focus: pending audio on stop; voices exceeding polyphony; bad imported state; high-DPI/resized canvases; mobile scrolling while notes are held; effect tails and muted exports. Each belongs to browser behavior checks, not mock tests.
