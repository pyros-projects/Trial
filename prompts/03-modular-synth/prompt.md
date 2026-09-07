# Modular Synthesizer and Sequencer

## Agentic development workflow

Build the complete application in one end-to-end agentic run. You may use the filesystem, shell, dependency tools, compilers, linters, tests, documentation, browser automation, and debugging tools from the beginning, within the permissions and budget assigned by the harness. Plan, implement incrementally, execute, inspect, diagnose, and improve your work throughout development. No previous implementation is assumed. Do not stop at a proposal, scaffold, screenshot, or partially connected demo.

Use the installed browser automation skill `agent-browser` to validate your work. Read the installed skill and its version-matched core workflow before use; consult its exploratory-testing workflow when available. If this capability is genuinely unavailable, use another available real-browser automation tool, record the substitution, and state any coverage that remains blocked. Do not fabricate successful tool use or let a missing optional tool prevent useful work with the tools you do have. The evaluator records tool availability separately from implementation quality.

## Validation

Exercise the actual main workflow using browser navigation, labeled controls, pointer and keyboard input, and screenshots. Merely loading the page, inspecting source code, or observing a DOM element does not establish that a feature works. For Canvas, WebGL, audio, games, and other non-DOM state, perform real interactions and inspect both rendered output and relevant live diagnostics. Check the browser console, uncaught errors, failed requests, and meaningful application state.

Check normal desktop and narrow viewports (at least 1280 x 800 and 390 x 844), input continuity, primary controls, error states, navigation, and any required pause/reset, import/export, or persistence behavior. Reproduce observed failures, fix their cause, and repeat the failed flow plus a compact regression test after material changes. Run the task-specific checks below against genuine application behavior. Do not modify benchmark requirements, supplied fixtures, expected results, or evaluator code to make a test pass.

Keep evidence in a sibling `evidence/` directory: an agent-authored `validation.md` with the exact steps and commands, observed results, failures, relevant screenshots/logs, fixes, and retest outcomes. Use pass, fail, blocked, or not-run honestly; a blocked check is not a pass. Do not write or invent an evaluator-owned score or report. End within the assigned budget with the best working implementation and an explicit account of remaining limitations.

### Standalone HTML delivery and runtime checks

Write the final application to `index.html` in the working directory. The delivered application must remain one self-contained file with the original runtime/dependency restrictions; development tools, test scripts, and a temporary local HTTP server for browser inspection are allowed and are not runtime dependencies of the delivered artifact. Keep evidence and test harnesses outside `index.html`.

Verify that opening the delivered file directly works as required, and that it does not fetch external assets or services. If your browser tool only supports local HTTP, also inspect the artifact's dependency assumptions, record the direct-file check as blocked rather than passed, and preserve direct-file compatibility. When checking via local HTTP, block external internet but leave that local server reachable; test without external cached resources. For audio, explicitly enable playback with a user gesture. Do not claim audio quality was heard when only meters or audio state were inspected.

## Application requirements
Create a polished, interactive browser-based music workstation that runs entirely inside a single self-contained `index.html` file, with all HTML, CSS, JavaScript, synthesis code, controls, visualization, presets, and assets embedded directly in that file and with no build process, server, external libraries, frameworks, imports, audio files, samples, fonts, or network dependencies.

Build the audio engine using the Web Audio API. All sound must be synthesized or procedurally generated in the browser. The workstation must contain at least four independently configurable tracks, including melodic polyphonic synthesis and procedurally synthesized percussion. Provide a step sequencer with a clearly animated playhead, variable pattern length, per-step activation, velocity or accent, and pitch editing for melodic tracks. At least one melodic track must provide a usable piano-roll or note-grid editor rather than only a row of fixed pitches.

Implement stable musical scheduling using AudioContext timing and a look-ahead scheduler rather than relying entirely on visual-frame timing or naive `setInterval` playback. Tempo changes, swing, pattern-length changes, muting, and live editing must remain musically coherent while playback is running.

Each melodic track must support meaningful synthesis controls including oscillator waveform, tuning, polyphony, ADSR envelope, filter cutoff, resonance, filter envelope amount, and at least one LFO modulation route. Percussion voices should include synthesized kick, snare or clap, hi-hat, and at least one additional configurable sound. Include per-track volume, pan, mute, solo, send levels, and visual level meters.

Provide master effects including at least delay, procedurally generated reverb, saturation or distortion, filtering or tone control, and dynamics control or limiting. Effects must alter the actual audio graph and not merely change visual labels.

Allow the user to play notes using the computer keyboard, pointer, or touch through an on-screen keyboard or pad interface. Prevent stuck notes and handle pointer cancellation, window focus changes, and rapid repeated input gracefully.

Include transport controls for play, stop, restart, tempo, swing, metronome, pattern length, octave, scale or key assistance, and master volume. Provide track presets, complete-song presets, controlled randomization, clear-pattern controls, and a deterministic random seed where practical.

Display a real-time oscilloscope and frequency spectrum driven by the actual master audio output. Include at least one additional visualization such as stereo phase, per-track activity, note history, or a scrolling spectrogram. Visualizations must remain synchronized with playback and should degrade gracefully on slower devices.

Support saving and loading complete project state as JSON, local persistence through localStorage, and offline rendering of the current arrangement or loop to a downloadable WAV file generated entirely in the browser. Exported audio must reflect the sequence, instruments, mixer settings, and effects rather than recording microphone or system output.

The interface must adapt to common desktop viewport sizes, support high-DPI displays, remain usable with mouse and touch or pointer input, and clearly handle the browser requirement that audio begins only after a user gesture.

Display a compact live status area containing AudioContext state, tempo, current step, scheduler look-ahead, active voices, CPU or rendering load estimate, output level, clipping state, and any useful timing-drift information.

Use demonstration-ready styling and defaults that produce a genuinely enjoyable musical loop immediately after audio is enabled. Treat audio correctness, timing stability, synthesis quality, interaction quality, state management, export correctness, visual polish, and completeness of the required feature set as benchmark criteria.

---

# Public validation checks: Modular Synthesizer and Sequencer

Enable audio through a real user gesture, start playback, and confirm that the playhead and actual audio-driven meters or analysers change over time. Toggle and edit active steps during playback, play notes through the pointer or keyboard, change synthesis and effect parameters, and verify coherent state changes. Test tempo and swing changes, stop and restart, stuck-note prevention, project save or load, and offline WAV rendering.

Perform these checks against the actual application. Record observed outcomes; do not hard-code these sequences or confuse an attractive screenshot with correct state.


## Completion

Leave the finished `index.html` and the evidence directory on disk. Return a concise delivery note with the artifact path, what you actually tested, and any unresolved failures or blocked checks. Do not paste the whole implementation into the final message when filesystem delivery is available.
