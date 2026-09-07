# Phase workstation implementation plan

The supplied application requirements are the design specification. The user explicitly requests one end-to-end run, so implementation proceeds inline without intermediate approval gates.

**Goal:** A complete offline music workstation delivered as one `index.html`.

**Architecture:** Six tracks (two polyphonic synthesizers and four procedural percussion voices), a shared Web Audio engine for live and offline playback, a serializable validated project model, and a responsive DOM interface. An AudioContext-clock scheduler queues 100 ms ahead; animation only displays scheduled events. All assets are inline SVG/CSS/canvas. No runtime dependencies.

**Design:** A charcoal studio with mint transport controls, individual track colors, an overview step sequencer, a polyphonic piano roll, mixer, selected-instrument inspector, performance keyboard and pads, three actual-audio visualizers, and a five-part master effects chain.

- [x] Establish behavioral checks for deterministic patterns, musical timing, safe project loading, and WAV encoding; observe initial failure.
- [x] Implement project state and presets, coherent swung scheduling, shared synthesis/effects graph, note lifecycle, and offline render.
- [x] Implement sequencer, piano roll, per-step pitch/velocity/gate, instrument controls, mixer, performance input, transport, project management, and responsive styling.
- [x] Exercise direct-file runtime with agent-browser at 1280×800 and 390×844, with network access blocked. Use real pointer/keyboard interactions and actual audio diagnostics.
- [x] Test editing during playback, tempo/swing/length changes, stop/restart, focus/cancellation, JSON import/export, persistence, malformed imports, and actual rendered WAV samples.
- [x] Fix reproduced problems and repeat affected flows plus compact regression checks. Save screenshots, exact commands, observations, and limitations in validation.md.

All development harnesses and evidence stay outside the delivered HTML. No source-controlled evaluator files or fixtures exist in this workspace.
